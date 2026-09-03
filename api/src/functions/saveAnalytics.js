const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

const ARCHIVE_TRIGGER_COUNT = 700;
const RETENTION_DAYS_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const RETENTION_MAX_RECENT_EVENTS = 500; // 500 recent events

/**
 * Splits an analytics array into retained events and events to archive.
 * Retains:
 *   1. All `type === 'session'` events from the last 90 days (for target calculations).
 *   2. The 500 most recent events (for recent activity, speech analysis, and diagnostics).
 *
 * @param {Array} analytics
 * @param {number} [now]
 * @returns {{ shouldArchive: boolean, retained: Array, toArchive: Array }}
 */
function splitAnalyticsForArchive(analytics, now = Date.now()) {
    if (!analytics || !Array.isArray(analytics) || analytics.length < ARCHIVE_TRIGGER_COUNT) {
        return { shouldArchive: false, retained: analytics || [], toArchive: [] };
    }

    const cutoffTs = now - RETENTION_DAYS_MS;

    // 1. All session events from the last 90 days
    const recentSessions = analytics.filter(e => {
        if (!e || e.type !== 'session') return false;
        if (!e.timestamp) return false;
        const t = new Date(e.timestamp).getTime();
        return !isNaN(t) && t >= cutoffTs;
    });

    // 2. The most recent 500 events
    const recentEvents = analytics.slice(-RETENTION_MAX_RECENT_EVENTS);

    // Merge and deduplicate retained events
    const retainedMap = new Map();
    recentSessions.forEach(e => retainedMap.set(e.eventId || JSON.stringify(e), e));
    recentEvents.forEach(e => retainedMap.set(e.eventId || JSON.stringify(e), e));

    const retainedList = Array.from(retainedMap.values()).sort((a, b) => {
        const ta = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return ta - tb;
    });

    const retainedIds = new Set(retainedList.map(e => e.eventId || JSON.stringify(e)));
    const archiveList = analytics.filter(e => !retainedIds.has(e.eventId || JSON.stringify(e)));

    if (archiveList.length === 0) {
        return { shouldArchive: false, retained: analytics, toArchive: [] };
    }

    return { shouldArchive: true, retained: retainedList, toArchive: archiveList };
}

/**
 * Applies incoming events to an existing analytics array with idempotent
 * de-dup (stable eventId) and returns per-event acks. Exported pure so tests
 * can pin the contract the client relies on (2026-09-03a, "Doris silent-200").
 *
 * Events WITH an eventId are either added (acked in addedEventIds) or skipped
 * as already-seen (acked in duplicateEventIds). Events WITHOUT an eventId are
 * always added and carry no ack id — the client treats them as delivered on
 * any 2xx (no client code path enqueues an event without one today).
 *
 * @param {Array} existingAnalytics - the student's analytics array (mutated)
 * @param {Array} events - incoming events
 * @returns {{ addedCount: number, addedEventIds: string[], duplicateEventIds: string[] }}
 */
function applyEventsWithAck(existingAnalytics, events) {
    const addedEventIds = [];
    const duplicateEventIds = [];
    let addedCount = 0;
    (events || []).forEach(event => {
        if (event && event.eventId) {
            const seen = (existingAnalytics || []).some(a => a && a.eventId === event.eventId);
            if (seen) {
                duplicateEventIds.push(event.eventId);
                return;
            }
            addedEventIds.push(event.eventId);
        }
        existingAnalytics.push(event);
        addedCount++;
    });
    return { addedCount, addedEventIds, duplicateEventIds };
}

/**
 * Checks if the student document's analytics array has grown too large (>=700 events).
 * If so, creates a permanent archive document in Cosmos DB before trimming the active
 * document's analytics array. Fail-safe: if archive creation fails, active document
 * is NOT trimmed.
 *
 * @param {Object} container Cosmos DB container
 * @param {Object} user Student document
 * @param {Object} [context] Azure Functions context
 */
async function maybeArchiveAnalytics(container, user, context) {
    if (!container || !user || !user.analytics) return;

    const { shouldArchive, retained, toArchive } = splitAnalyticsForArchive(user.analytics);
    if (!shouldArchive || toArchive.length === 0) return;

    const archiveDoc = {
        id: `archive_${user.id}_${Date.now()}`,
        type: 'student_analytics_archive',
        studentId: user.id,
        login: user.login,
        fullName: user.fullName,
        archivedAt: new Date().toISOString(),
        totalArchivedEvents: toArchive.length,
        sessionCountAtArchive: user.sessionCount,
        events: toArchive
    };

    try {
        await container.items.create(archiveDoc);
        // Only trim active document if archive creation succeeded in Cosmos DB
        user.analytics = retained;
        if (context && typeof context.log === 'function') {
            context.log(`Archived ${toArchive.length} events for ${user.id} to ${archiveDoc.id}. Retained ${retained.length} events.`);
        }
    } catch (archiveErr) {
        if (context && typeof context.warn === 'function') {
            context.warn(`Failed to create analytics archive for ${user.id}:`, archiveErr);
        }
        // Do not trim user.analytics if archive fails — ensures zero data loss
    }
}

app.http('saveAnalytics', {
    route: 'saveAnalytics',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            // Parse first so we can read a token the unload beacon ships in the
            // body (sendBeacon/keepalive can't set headers; SWA drops POST query
            // params). Identity still comes from the verified token — never
            // trusted from the body's studentId — and legacy (no-token) mode
            // falls back to the client-supplied id.
            const body = await request.json();
            const authGate = auth.requireAuth(request, body.authToken);
            if (authGate.error) return authGate.error;
            const token = authGate.token;

            const studentId = token ? token.sub : body.studentId; // scope to self only
            const { events, srState, incrementSession } = body;

            if (!events || !Array.isArray(events) || events.length === 0) {
                return { status: 400, body: 'Missing events array.' };
            }

            const { resources: items } = await getContainer().items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: studentId }] })
                .fetchAll();
            if (items.length === 0) return { status: 404, body: 'Student not found.' };

            const user = items[0];
            if (!user.analytics) user.analytics = [];
            // Idempotent de-dup with per-event acks: the client stamps each
            // event with a stable eventId, and (2026-09-03a, "Doris silent-200")
            // the response now lists EXACTLY which eventIds were added vs
            // skipped-as-duplicate so the client only clears its persisted
            // queue when the server accounts for every shipped event.
            const { addedCount: added, addedEventIds, duplicateEventIds } = applyEventsWithAck(user.analytics, events);
            if (srState && typeof srState === 'object') user.srState = srState;
            if (incrementSession) user.sessionCount = (user.sessionCount || 0) + 1;

            // Automatic rolling archival: if user.analytics gets too large (>=700 events),
            // safely archive older events (keeping 90-day sessions + 500 recent events)
            // before saving the active record.
            await maybeArchiveAnalytics(getContainer(), user, context);

            await getContainer().items.upsert(user);

            // Delivery diagnostics (2026-09-03a): one tiny record per accepted
            // saveAnalytics request, in a separate telemetry doc. Purpose: the
            // 2026-08-28→09-03 Doris iPad blackout proved a client can receive
            // ok-looking responses while nothing persists server-side — with no
            // App Insights on the SWA, this doc is the only server-side trace.
            // Best-effort: diagnostics failures must NEVER fail the save.
            try {
                const ua = request.headers.get('user-agent') || '';
                await getContainer().items.upsert({
                    id: 'delivery_diag_saveAnalytics',
                    type: 'delivery_diagnostics',
                    updatedAt: new Date().toISOString(),
                    // Single-slot ring: last accepted request only. If Doris's
                    // fetch flushes go missing again, absence of her UA here
                    // while her device events keep arriving proves the
                    // requests never reach the function (edge/network loss).
                    recent: [{
                        ts: new Date().toISOString(),
                        studentId, added, total: events.length,
                        ua: ua.slice(0, 120),
                        transport: request.headers.get('x-auth-token') ? 'header' : 'body'
                    }]
                });
            } catch (diagErr) {
                context.warn('delivery diagnostics write failed (non-fatal):', diagErr);
            }

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `${added} event(s) saved (${events.length - added} duplicate(s) skipped).`,
                    addedEventIds,
                    duplicateEventIds,
                    sessionCount: user.sessionCount || 0
                }
            };
        } catch (error) {
            context.error('saveAnalytics failed:', error);
            return { status: 500, body: 'Server error saving analytics.' };
        }
    }
});

module.exports = {
    splitAnalyticsForArchive,
    maybeArchiveAnalytics,
    applyEventsWithAck,
    ARCHIVE_TRIGGER_COUNT,
    RETENTION_DAYS_MS,
    RETENTION_MAX_RECENT_EVENTS
};

