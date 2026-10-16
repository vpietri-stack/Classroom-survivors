const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getSamplesContainer } = require('./shared/db');
const auth = require('./shared/auth');
const policy = require('./shared/speechSamples');
const store = require('./shared/speechSampleStore');

const MAX_TEXT_CHARS = 400;
function cleanText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_TEXT_CHARS);
}
function cleanNumber(value, min, max) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
}
function looksLikeWavBase64(b64) {
    if (typeof b64 !== 'string' || b64.length < 64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
    const head = Buffer.from(b64.slice(0, 24), 'base64');
    return head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WAVE';
}

async function handler(request, context) {
    let container, lease;
    const usage = store.meter();
    let outcome = { skipped: 'dropped' };
    try {
        if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
        const gate = auth.requireAuth(request);
        if (gate.error) return gate.error;
        const studentId = gate.token && gate.token.sub;
        if (!studentId) return auth.unauthorized();
        if (!policy.captureEnabled() || !policy.maxSamples()) return { status: 200, jsonBody: { skipped: 'closed' } };
        if (!policy.withinCaptureWindow()) return { status: 410, jsonBody: { skipped: 'closed' } };
        if (!policy.isConsented(studentId)) return { status: 200, jsonBody: { skipped: 'not_consented' } };
        const declaredLength = Number(request.headers.get('content-length')) || 0;
        if (declaredLength > policy.MAX_WAV_BASE64_CHARS + 16_384) return { status: 413 };
        let body;
        try { body = await request.json(); } catch (_) { return { status: 400 }; }
        if (body.studentId !== studentId) return { status: 403 };
        if (!store.validSampleId(body.sampleId) || typeof body.reservation !== 'string') {
            return { status: 200, jsonBody: { skipped: 'reservation_required' } };
        }
        if (typeof body.wavBase64 !== 'string' || body.wavBase64.length > policy.MAX_WAV_BASE64_CHARS) return { status: 413 };
        if (!looksLikeWavBase64(body.wavBase64)) return { status: 400 };
        container = getSamplesContainer();
        const current = await store.readItem(container, store.CONTROL_ID, store.CONTROL_PK, usage);
        if (!current || current.nonce !== body.reservation || current.ownerId !== studentId ||
            current.sampleId !== body.sampleId || current.uploading || Date.now() >= current.leaseUntil) {
            return { status: 200, jsonBody: { skipped: 'expired' } };
        }
        // Consume the nonce once. A duplicate concurrent POST cannot release
        // the original request's lease while its batch is still running.
        lease = usage.add(await container.item(store.CONTROL_ID, store.CONTROL_PK).replace(
            { ...current, uploading: true }, { accessCondition: { type: 'IfMatch', condition: current._etag } }
        )).resource;
        const doc = {
            id: 'sample-' + body.sampleId, studentId, type: 'speech_sample', schemaVersion: 2,
            student: cleanText(body.student), sampleId: body.sampleId,
            capturedAt: cleanNumber(body.capturedAt, 0, Date.now()) || Date.now(),
            target: cleanText(body.target), transcript: cleanText(body.transcript),
            // A rejected recording was never graded. Null must not become false.
            pass: typeof body.pass === 'boolean' ? body.pass : null,
            outcome: ['graded', 'too_short', 'too_quiet', 'hallucination', 'empty'].includes(body.outcome) ? body.outcome : 'graded',
            accuracy: cleanNumber(body.accuracy, 0, 1), phoneticRatio: cleanNumber(body.phoneticRatio, 0, 1),
            attempt: cleanNumber(body.attempt, 1, 20), level: cleanNumber(body.level, 1, 5),
            book: cleanText(body.book).slice(0, 24), mode: cleanText(body.mode).slice(0, 16),
            audioMs: cleanNumber(body.audioMs, 0, 600_000), durMs: cleanNumber(body.durMs, 0, 600_000),
            peak: cleanNumber(body.peak, 0, 1), sampleRate: cleanNumber(body.sampleRate, 1000, 192_000),
            transcribeMs: cleanNumber(body.transcribeMs, 0, 600_000),
            details: cleanText(body.details), ua: cleanText(body.ua).slice(0, 160),
            wavBase64: body.wavBase64,
        };
        outcome = await store.save(container, lease, doc, usage);
        if (outcome.stored) outcome.bytes = body.wavBase64.length;
        if (outcome.skipped) return { status: 200, jsonBody: { ...outcome, retryAfterMs: 30_000 } };
        if (context && context.log) context.log(JSON.stringify({
            event: 'speech_sample_write', bytes: body.wavBase64.length,
            writeRu: outcome.writeRu || 0, totalRu: usage.ru, writeMs: outcome.writeMs || 0,
            duplicate: !!outcome.duplicate,
        }));
        return { status: outcome.duplicate ? 200 : 201, jsonBody: { success: true, id: doc.id, ...outcome, cap: policy.maxSamples() } };
    } catch (e) {
        outcome = { skipped: 'storage_busy' };
        if (context && context.warn) context.warn('Speech sample dropped', e.code || 'unavailable');
        return { status: 200, jsonBody: { ...outcome, retryAfterMs: 30_000 } };
    } finally {
        if (container && lease) await store.finish(container, lease, usage, outcome);
    }
}

app.http('saveSpeechSample', { route: 'saveSpeechSample', methods: ['POST'], authLevel: 'anonymous', handler });
module.exports = {
    handler, cleanText, cleanNumber, looksLikeWavBase64,
    MAX_WAV_BASE64_CHARS: policy.MAX_WAV_BASE64_CHARS,
    MAX_SAMPLES_PER_STUDENT: policy.MAX_SAMPLES_PER_STUDENT,
};
