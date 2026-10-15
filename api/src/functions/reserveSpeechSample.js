const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getSamplesContainer } = require('./shared/db');
const auth = require('./shared/auth');
const policy = require('./shared/speechSamples');
const store = require('./shared/speechSampleStore');

async function handler(request, context) {
    try {
        if (!validateApiKey(request)) return { status: 403 };
        const gate = auth.requireAuth(request);
        if (gate.error) return gate.error;
        const studentId = gate.token && gate.token.sub;
        if (!studentId) return auth.unauthorized();
        if (!policy.captureEnabled() || !policy.withinCaptureWindow() || !policy.maxSamples()) return { status: 200, jsonBody: { skipped: 'closed' } };
        if (!policy.isConsented(studentId)) return { status: 200, jsonBody: { skipped: 'not_consented' } };
        const body = await request.json();
        if (body.studentId !== studentId || !store.validSampleId(body.sampleId)) return { status: 400 };
        if (!(body.blobBytes > 0 && body.blobBytes <= policy.MAX_WAV_BYTES)) return { status: 413 };
        const usage = store.meter();
        const result = await store.reserve(getSamplesContainer(), studentId, body.sampleId, Date.now(), usage);
        if (!result.lease) return { status: 200, jsonBody: result };
        return {
            status: 200, headers: { 'Cache-Control': 'no-store' },
            jsonBody: { reservation: result.lease.nonce, expiresAt: result.lease.leaseUntil, stored: result.stored },
        };
    } catch (e) {
        if (context && context.warn) context.warn('Speech reservation dropped', e.code || 'unavailable');
        return { status: 200, jsonBody: { skipped: 'storage_busy', retryAfterMs: 30_000 } };
    }
}

app.http('reserveSpeechSample', { route: 'reserveSpeechSample', methods: ['POST'], authLevel: 'anonymous', handler });
module.exports = { handler };
