// Shared policy for the temporary speech-sample research collection.
//
// Two rules live here so the upload endpoint, the consent endpoint and the
// tests cannot drift apart:
//
//   1. WHO — consent is a list of student IDs held in an app setting, never in
//      the repository. The repo is public and student IDs embed children's full
//      pinyin names. The list is also deliberately fail-closed: if the setting
//      is missing or empty, nobody is consented and no audio is accepted.
//      Display names must NOT be used: three of the consented children share a
//      display name with a different live student ("Annie", "Simon", "Cindy"),
//      so name matching could record a child whose parents never agreed.
//
//   2. WHEN — the collection closes at a fixed instant, enforced server-side as
//      well as in the client, so a stale page or a hand-built request cannot
//      keep uploading children's audio afterwards.

// Collection window agreed with the teacher: went live 2026-10-11, extended the
// same day to close at the start of 2026-10-19 China time. Override with
// SPEECH_SAMPLE_CAPTURE_ENDS (any Date.parse-able instant) to close early.
const DEFAULT_CAPTURE_ENDS = '2026-10-19T00:00:00+08:00';
const MAX_SAMPLES_PER_STUDENT = 30;
const MAX_WAV_BYTES = 300_000;
const MAX_WAV_BASE64_CHARS = 400_000;
const LEASE_MS = 15_000;
const MIN_UPLOAD_GAP_MS = 2_000;
const TARGET_RU_PER_SECOND = 100;
const RESERVATION_OVERHEAD_RU = 20;

// Deliberate, fail-closed launch/kill switch. Consent alone does not turn on
// the expanded collector. No account list is ever bundled into the game.
function captureEnabled() {
    return process.env.SPEECH_SAMPLE_CAPTURE_ENABLED === 'true';
}

function maxSamples() {
    const raw = process.env.SPEECH_SAMPLE_MAX_PER_STUDENT;
    if (raw === undefined || raw === '') return MAX_SAMPLES_PER_STUDENT;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= MAX_SAMPLES_PER_STUDENT ? n : 0;
}

function captureEndsAt() {
    const raw = process.env.SPEECH_SAMPLE_CAPTURE_ENDS || DEFAULT_CAPTURE_ENDS;
    const t = Date.parse(raw);
    // An invalid override closes collection; extending the consented window
    // requires a deliberate code/release change, not just an app setting.
    return Number.isFinite(t) ? Math.min(t, Date.parse(DEFAULT_CAPTURE_ENDS)) : 0;
}

function withinCaptureWindow(nowMs = Date.now()) {
    return nowMs < captureEndsAt();
}

// Consent list, parsed once per call (app settings can be read at any time).
// Accepts comma-, semicolon- or whitespace-separated IDs; case-insensitive;
// surrounding quotes stripped so a JSON-ish app setting still works.
function consentedIds() {
    const raw = process.env.SPEECH_SAMPLE_CONSENTED_IDS || '';
    return new Set(
        raw.split(/[\s,;]+/)
            .map(s => s.replace(/^["']|["']$/g, '').trim().toLowerCase())
            .filter(Boolean)
    );
}

function isConsented(studentId) {
    if (!studentId || typeof studentId !== 'string') return false;
    return consentedIds().has(studentId.trim().toLowerCase());
}

module.exports = {
    DEFAULT_CAPTURE_ENDS,
    captureEndsAt,
    withinCaptureWindow,
    consentedIds,
    isConsented,
    captureEnabled,
    maxSamples,
    MAX_SAMPLES_PER_STUDENT,
    MAX_WAV_BYTES,
    MAX_WAV_BASE64_CHARS,
    LEASE_MS,
    MIN_UPLOAD_GAP_MS,
    TARGET_RU_PER_SECOND,
    RESERVATION_OVERHEAD_RU,
};
