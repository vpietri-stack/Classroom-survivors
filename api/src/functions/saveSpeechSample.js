const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getSamplesContainer } = require('./shared/db');
const auth = require('./shared/auth');
const policy = require('./shared/speechSamples');

// Temporary research intake for consented students' speech recordings.
//
// WHY THIS EXISTS: the app has never stored audio (recognition is fully local,
// by design), so no candidate ASR model or scoring change can be evaluated
// against real classroom voices. The teacher obtained face-to-face consent from
// a specific list of students and their parents for a ONE-WEEK collection to
// build that calibration set. See docs/research/2026-10-10-speech-improvement-
// research.md.
//
// WHY A SEPARATE ENDPOINT: base64 audio is ~200 KB-1.6 MB per call. Routing it
// through saveAnalytics would put large writes into the same pipeline, the same
// container and the same etag-retry path that saves student progress. This keeps
// research traffic unable to disturb it.
//
// SAFETY PROPERTIES — do not remove without replacing them:
//   • the capture window is enforced HERE as well as client-side, so a stale or
//     hand-built client cannot keep uploading children's audio after it closes;
//   • a student may only upload their own samples (token sub === student);
//   • per-student and per-request size caps bound both Cosmos storage and the
//     request-unit cost, which matters because the database's 1000 RU/s autoscale
//     ceiling is exactly the Cosmos free-tier allowance and is SHARED with the
//     container that holds student progress.

// Capture window and consent live in shared/speechSamples.js so the upload
// endpoint, the consent endpoint and the tests cannot drift apart.

// 15 s at 48 kHz mono 16-bit is ~1.44 MB, which base64-inflates to ~1.92 MB and
// would breach Cosmos's 2 MB item limit once metadata is added. Capping here
// rejects only the longest recordings on high-sample-rate devices (about 1% of
// attempts, all of which are also the least useful — they are mostly trailing
// room noise past the end of the sentence).
const MAX_WAV_BASE64_CHARS = 1_600_000;
const MAX_SAMPLES_PER_STUDENT = 60;
const MAX_TEXT_CHARS = 400;

// Only plain text metadata is stored; strip anything control-character-ish and
// clamp length so a runaway transcript cannot bloat the item.
function cleanText(value) {
    if (typeof value !== 'string') return '';
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_TEXT_CHARS);
}

function cleanNumber(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, n));
}

// A base64 WAV must at least start with the RIFF magic once decoded, otherwise
// we would happily store arbitrary bytes against a child's name.
function looksLikeWavBase64(b64) {
    if (typeof b64 !== 'string' || b64.length < 64) return false;
    if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) return false;
    try {
        const head = Buffer.from(b64.slice(0, 16), 'base64');
        return head.length >= 4 && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
    } catch (_) {
        return false;
    }
}

async function countForStudent(container, studentId) {
    const { resources } = await container.items
        .query({
            query: 'SELECT VALUE COUNT(1) FROM c WHERE c.studentId = @sid',
            parameters: [{ name: '@sid', value: studentId }],
        })
        .fetchAll();
    return Number(resources && resources[0]) || 0;
}

app.http('saveSpeechSample', {
    route: 'saveSpeechSample',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            let body;
            try {
                body = await request.json();
            } catch (_) {
                return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
            }

            // Window check first and cheapest: after the collection closes this
            // endpoint is inert for everyone, including a privileged caller.
            if (!policy.withinCaptureWindow()) {
                return { status: 410, jsonBody: { error: 'Speech sample collection has closed.' } };
            }

            const authGate = auth.requireAuth(request, body.authToken);
            if (authGate.error) return authGate.error;
            const token = authGate.token;

            // Consent is keyed on the AUTHENTICATED identity (token.sub), never
            // on a client-supplied id or display name — a client cannot widen
            // its own consent by claiming someone else's.
            const studentId = token && token.sub;
            if (!studentId) return auth.unauthorized();
            if (!policy.isConsented(studentId)) {
                // Quiet 200, not 403: a non-consented student should never see
                // an error, and the client uses this to stop trying.
                return { status: 200, jsonBody: { success: true, skipped: 'not_consented' } };
            }

            const student = cleanText(body.student);
            if (!student) return { status: 400, jsonBody: { error: 'Missing student.' } };

            if (!looksLikeWavBase64(body.wavBase64)) {
                return { status: 400, jsonBody: { error: 'Missing or malformed wavBase64.' } };
            }
            if (body.wavBase64.length > MAX_WAV_BASE64_CHARS) {
                return { status: 413, jsonBody: { error: 'Recording too large to store.' } };
            }

            const container = getSamplesContainer();
            const existing = await countForStudent(container, studentId);
            if (existing >= MAX_SAMPLES_PER_STUDENT) {
                // Not an error worth surfacing to the child — the sample set is
                // complete for them. 200 with a flag keeps the client quiet.
                return { status: 200, jsonBody: { success: true, skipped: 'cap_reached' } };
            }

            const capturedAt = cleanNumber(body.capturedAt, 0, Date.now() + 60_000) || Date.now();
            const doc = {
                id: `${studentId}-${capturedAt}-${Math.random().toString(36).slice(2, 8)}`,
                studentId, // partition key
                student,   // display name, metadata only — never used for consent
                capturedAt,
                target: cleanText(body.target),
                transcript: cleanText(body.transcript),
                pass: !!body.pass,
                accuracy: cleanNumber(body.accuracy, 0, 1),
                phoneticRatio: cleanNumber(body.phoneticRatio, 0, 1),
                attempt: cleanNumber(body.attempt, 1, 20),
                level: cleanNumber(body.level, 1, 5),
                book: cleanText(body.book).slice(0, 24),
                mode: cleanText(body.mode).slice(0, 16),
                audioMs: cleanNumber(body.audioMs, 0, 600_000),
                durMs: cleanNumber(body.durMs, 0, 600_000),
                peak: cleanNumber(body.peak, 0, 1),
                sampleRate: cleanNumber(body.sampleRate, 1000, 192_000),
                transcribeMs: cleanNumber(body.transcribeMs, 0, 600_000),
                details: cleanText(body.details),
                ua: cleanText(body.ua).slice(0, 160),
                wavBase64: String(body.wavBase64).replace(/\s+/g, ''),
            };

            await container.items.create(doc);

            return {
                status: 201,
                jsonBody: { success: true, id: doc.id, stored: existing + 1, cap: MAX_SAMPLES_PER_STUDENT },
            };
        } catch (error) {
            context.error('saveSpeechSample failed:', error);
            return { status: 500, body: 'Server error while storing speech sample.' };
        }
    },
});

module.exports = {
    cleanText,
    cleanNumber,
    looksLikeWavBase64,
    countForStudent,
    MAX_WAV_BASE64_CHARS,
    MAX_SAMPLES_PER_STUDENT,
};
