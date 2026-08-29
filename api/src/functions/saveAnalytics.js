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
            let added = 0;
            events.forEach(event => {
                // Idempotent de-dup: the client stamps each event with a stable
                // eventId so a retried flush (tab-close re-send + next-launch
                // retry) cannot double-count a session or exercise.
                if (event && event.eventId) {
                    const seen = user.analytics.some(a => a && a.eventId === event.eventId);
                    if (seen) return;
                }
                user.analytics.push(event);
                added++;
            });
            if (srState && typeof srState === 'object') user.srState = srState;
            if (incrementSession) user.sessionCount = (user.sessionCount || 0) + 1;

            // Automatic rolling archival: if user.analytics gets too large (>=700 events),
            // safely archive older events (keeping 90-day sessions + 500 recent events)
            // before saving the active record.
            await maybeArchiveAnalytics(getContainer(), user, context);

            await getContainer().items.upsert(user);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `${added} event(s) saved (${events.length - added} duplicate(s) skipped).`,
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
    ARCHIVE_TRIGGER_COUNT,
    RETENTION_DAYS_MS,
    RETENTION_MAX_RECENT_EVENTS
};

