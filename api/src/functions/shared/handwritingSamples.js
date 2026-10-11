// Shared policy for the handwriting-trace research collection.
//
// WHY THIS EXISTS: study mode's handwriting round decides accept/reject from
// geometry alone (see handwriting.js), and the bars were tuned against
// synthetic pen paths, not real children. Nothing was ever kept, so a rejected
// letter could never be inspected afterwards — the same blind spot the speech
// pipeline had until the sample collection was added. Traces are small (a few
// KB per word) so this can run for months, over every student, and still cost
// nothing beyond the request units the free tier already allows.
//
// Three rules live here so the upload endpoint, the config endpoint and the
// tests cannot drift apart:
//
//   1. WHO — HANDWRITING_SAMPLE_IDS. Fail-closed: unset or empty records
//      nobody. Set it to `*` to record every signed-in student (the intended
//      live setting), or to a comma-separated list of student IDs to narrow it
//      to specific children — e.g. if a parent asks for their child to be left
//      out, which must not need a redeploy. Keyed on studentId, never a display
//      name: several live students share one.
//
//   2. WHEN — the collection closes at a fixed instant, enforced server-side as
//      well as in the client, so a stale page cannot keep uploading afterwards.
//      Override with HANDWRITING_SAMPLE_CAPTURE_ENDS to close early or extend.
//
//   3. HOW MUCH — a per-student per-day word cap, so one stuck client cannot
//      fill the container that shares its request-unit pool with student
//      progress.
//
// cleanText / cleanNumber deliberately duplicate saveSpeechSample.js's copies
// rather than being hoisted into a shared module: that endpoint is live and
// collecting until 2026-10-19, and refactoring it to save ten lines here would
// put a running research collection at risk.

const ALL_STUDENTS = '*';

// Roughly one school term. The client treats this as a fallback only — it takes
// the authoritative instant from the config endpoint, so the window can be
// extended or closed by app setting without shipping a new frontend.
const DEFAULT_CAPTURE_ENDS = '2027-01-31T00:00:00+08:00';

// The daily cap is counted in China time, because that is the school's day: a
// UTC midnight boundary would split one morning's lesson across two days.
const CN_OFFSET_MS = 8 * 60 * 60 * 1000;

function captureEndsAt() {
    const raw = process.env.HANDWRITING_SAMPLE_CAPTURE_ENDS || DEFAULT_CAPTURE_ENDS;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : Date.parse(DEFAULT_CAPTURE_ENDS);
}

function withinCaptureWindow(nowMs = Date.now()) {
    return nowMs < captureEndsAt();
}

// Accepts comma-, semicolon- or whitespace-separated IDs; case-insensitive;
// surrounding quotes stripped so a JSON-ish app setting still works.
function enabledIds() {
    const raw = process.env.HANDWRITING_SAMPLE_IDS || '';
    return new Set(
        raw.split(/[\s,;]+/)
            .map(s => s.replace(/^["']|["']$/g, '').trim().toLowerCase())
            .filter(Boolean)
    );
}

function isCaptureEnabled(studentId) {
    if (!studentId || typeof studentId !== 'string') return false;
    const ids = enabledIds();
    if (!ids.size) return false;
    if (ids.has(ALL_STUDENTS)) return true;
    return ids.has(studentId.trim().toLowerCase());
}

// Midnight China time for the given instant, as a UTC epoch-ms value.
function cnDayStartMs(nowMs = Date.now()) {
    return Math.floor((nowMs + CN_OFFSET_MS) / 86400000) * 86400000 - CN_OFFSET_MS;
}

const MAX_TEXT_CHARS = 400;

function cleanText(value, max = MAX_TEXT_CHARS) {
    if (typeof value !== 'string') return '';
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function cleanNumber(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, n));
}

module.exports = {
    ALL_STUDENTS,
    DEFAULT_CAPTURE_ENDS,
    CN_OFFSET_MS,
    captureEndsAt,
    withinCaptureWindow,
    enabledIds,
    isCaptureEnabled,
    cnDayStartMs,
    cleanText,
    cleanNumber,
};
