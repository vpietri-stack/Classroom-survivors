// Temporary, account-enabled remote recorder. Never reads/writes Students.
const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const auth = require('./shared/auth');
const { validateApiKey } = require('./shared/validateApiKey');
let container;
function getDiagnosticsContainer() {
    if (!container) {
        const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY,
            connectionPolicy: { requestTimeout: 4000, retryOptions: { maxRetryAttemptCount: 0, maxWaitTimeInSeconds: 0 } } });
        container = client.database(process.env.COSMOS_DIAGNOSTICS_DB_NAME || process.env.COSMOS_DB_NAME || 'Val-EslApp')
            .container(process.env.COSMOS_DIAGNOSTICS_CONTAINER || 'client_diagnostics');
    }
    return container;
}
const DAY = 86400000;
const MAX_EVENTS = 1000;
const MAX_BYTES = 480000;
const TYPES = new Set(('boot activity heartbeat error promise_error console_error console_warn console_log resource_error network visibility pagehide pageshow freeze resume context_lost speech app_navigation long_task client_report logout').split(' '));
function redact(value, max = 1200) {
    return String(value == null ? '' : value)
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token]')
        .replace(/((?:password|authToken|authorization|x-auth-token|x-app-key|appKey|APP_API_KEY|token)["']?\s*[:=]\s*["']?)[^\s,"'&}]+/gi, '$1[redacted]')
        .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, '$1')
        .slice(0, max);
}
function safeId(s) { return typeof s === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(s); }
function isEnabled(config, now = Date.now()) { return !!(config && config.enabled && Date.parse(config.endsAt) > now); }
function publicConfig(config, now = Date.now()) {
    return { enabled: isEnabled(config, now), endsAt: config && config.endsAt || null, heartbeatMs: 15000, uploadMs: 30000 };
}
function sanitizeEvent(e, now = Date.now()) {
    if (!e || !safeId(e.boot) || !Number.isSafeInteger(e.seq) || e.seq < 1 || !TYPES.has(e.type)) return null;
    const date = Date.parse(e.ts);
    if (!Number.isFinite(date) || date < now - 14 * DAY || date > now + 5 * 60000) return null;
    const context = {};
    for (const key of ['mode', 'round', 'word', 'letter', 'exercise', 'checkpoint', 'version']) {
        if (e.context && e.context[key] != null) context[key] = redact(e.context[key], 100);
    }
    if (e.context && typeof e.context.active === 'boolean') context.active = e.context.active;
    return { eventId: e.boot + ':' + e.seq, boot: e.boot, seq: e.seq, ts: new Date(date).toISOString(),
        type: e.type, context, detail: redact(e.detail), elapsedMs: Math.max(0, Math.min(Number(e.elapsedMs) || 0, 7 * DAY)) };
}
function sanitizeDevice(d) {
    const out = {};
    for (const k of ['ua', 'platform', 'screen', 'viewport', 'version', 'label']) if (d && d[k] != null) out[k] = redact(d[k], k === 'ua' ? 450 : 100);
    for (const k of ['dpr', 'touch', 'timezoneOffset', 'heapMB']) if (d && Number.isFinite(d[k])) out[k] = d[k];
    return out;
}
function mergeEvents(existing, incoming) {
    const seen = new Set(existing.map(e => e.eventId));
    const events = existing.concat(incoming.filter(e => { if (seen.has(e.eventId)) return false; seen.add(e.eventId); return true; }))
        .sort((a, b) => a.ts.localeCompare(b.ts) || a.seq - b.seq).slice(-MAX_EVENTS);
    while (events.length && Buffer.byteLength(JSON.stringify(events), 'utf8') > MAX_BYTES) events.shift();
    return events;
}
async function readOptional(c, id, pk) {
    try { return (await c.item(id, pk).read()).resource || null; }
    catch (e) { if (e.code === 404) return null; throw e; }
}
function makeHandler(getContainer = getDiagnosticsContainer) {
    return async function handler(request, context) {
        // Strong auth even if legacy progress endpoints allow unauthenticated clients.
        if (!validateApiKey(request)) return { status: 403, jsonBody: { error: 'Forbidden' } };
        const token = auth.verifyToken(request, auth.SESSION_SECRET());
        if (!token) return auth.unauthorized();
        const privileged = auth.isPrivileged(token);
        const studentId = request.query.get('studentId') || token.sub;
        if (!safeId(studentId)) return { status: 400, jsonBody: { error: 'Invalid student' } };
        if (studentId !== token.sub && !privileged) return auth.forbidden();
        const headers = { 'Cache-Control': 'no-store' };
        try {
            const c = getContainer();
            const config = await readOptional(c, 'config', studentId);
            if (request.method === 'GET') {
                if (request.query.get('view') !== 'events') return { status: 200, headers, jsonBody: publicConfig(config) };
                if (!privileged) return auth.forbidden();
                const { resources } = await c.items.query({
                    query: "SELECT TOP 12 c.browserId, c.device, ARRAY_SLICE(c.events, -200) AS events, c.updatedAt, c.dropped FROM c WHERE c.type = 'client_diagnostics_day' ORDER BY c.updatedAt DESC"
                }, { partitionKey: studentId }).fetchAll();
                return { status: 200, headers, jsonBody: { config: publicConfig(config), days: resources, serverTime: new Date().toISOString() } };
            }
            const raw = await request.text();
            if (Buffer.byteLength(raw, 'utf8') > 24000) return { status: 413, jsonBody: { error: 'Batch too large' } };
            let body;
            try { body = JSON.parse(raw); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON' } }; }
            if (body.action === 'configure') {
                if (!privileged) return auth.forbidden();
                const days = Math.max(1, Math.min(Number(body.days) || 7, 14));
                const next = { id: 'config', studentId, type: 'client_diagnostics_config', enabled: body.enabled === true,
                    endsAt: new Date(Date.now() + days * DAY).toISOString(), updatedAt: new Date().toISOString(), ttl: -1 };
                await c.items.upsert(next);
                return { status: 200, headers, jsonBody: publicConfig(next) };
            }
            // Ingestion is always scoped to the signed-in student, never a body owner.
            if (studentId !== token.sub || privileged) return auth.forbidden();
            if (!isEnabled(config)) return { status: 200, headers, jsonBody: { enabled: false, ack: [] } };
            if (!safeId(body.browserId) || !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 40)
                return { status: 400, jsonBody: { error: 'Invalid batch' } };
            const incoming = body.events.map(e => sanitizeEvent(e));
            if (incoming.some(e => !e)) return { status: 400, jsonBody: { error: 'Invalid event' } };
            const id = 'day_' + new Date().toISOString().slice(0, 10) + '_' + body.browserId;
            for (let attempt = 0; attempt < 3; attempt++) {
                const prev = await readOptional(c, id, studentId);
                const all = mergeEvents(prev && prev.events || [], incoming);
                const next = { id, studentId, browserId: body.browserId, type: 'client_diagnostics_day', schema: 1,
                    device: sanitizeDevice(body.device), events: all, updatedAt: new Date().toISOString(), ttl: 14 * 86400,
                    dropped: (prev && prev.dropped || 0) + Math.max(0, new Set((prev && prev.events || []).concat(incoming).map(e => e.eventId)).size - all.length) };
                try {
                    if (prev) await c.item(id, studentId).replace(next, { accessCondition: { type: 'IfMatch', condition: prev._etag } });
                    else await c.items.create(next);
                    return { status: 200, headers, jsonBody: { enabled: true, ack: incoming.map(e => e.eventId), receivedAt: next.updatedAt } };
                } catch (e) { if ((e.code === 412 || e.code === 409) && attempt < 2) continue; throw e; }
            }
        } catch (e) {
            context.warn('Client diagnostics unavailable', e.code || e.name); // no bodies/tokens in logs
            return { status: 503, headers, jsonBody: { error: 'Diagnostics temporarily unavailable' } };
        }
    };
}
const handler = makeHandler();
app.http('clientDiagnostics', { methods: ['GET', 'POST'], authLevel: 'anonymous', route: 'clientDiagnostics', handler });
module.exports = { handler, makeHandler, redact, sanitizeEvent, mergeEvents, publicConfig };
