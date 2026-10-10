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

// 7-day collection agreed with the teacher on 2026-10-10. Override with
// SPEECH_SAMPLE_CAPTURE_ENDS (any Date.parse-able instant) to close early.
const DEFAULT_CAPTURE_ENDS = '2026-10-17T00:00:00+08:00';

function captureEndsAt() {
    const raw = process.env.SPEECH_SAMPLE_CAPTURE_ENDS || DEFAULT_CAPTURE_ENDS;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : Date.parse(DEFAULT_CAPTURE_ENDS);
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
};
