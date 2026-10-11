const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getHandwritingContainer } = require('./shared/db');
const auth = require('./shared/auth');
const policy = require('./shared/handwritingSamples');

// Research intake for handwriting traces: the pen strokes a student actually
// drew, the letter they were aiming at, and the verdict the shipped geometry
// reached. See shared/handwritingSamples.js for why this collection exists.
//
// WHY A SEPARATE ENDPOINT AND CONTAINER: routing traces through saveAnalytics
// would append them verbatim to each student's own document, where they would
// churn the 700-event archive, count against the 2 MB item limit and be
// impossible to bulk-export without pulling every child's progress record with
// them. Research data gets its own container and its own write path, so it can
// never disturb the pipeline that saves student progress.
//
// SAFETY PROPERTIES — do not remove without replacing them:
//   • the capture window and the enable list are enforced HERE as well as
//     client-side, so a stale or hand-built client cannot keep uploading;
//   • a student may only upload their own traces (token sub === partition key);
//   • every numeric field is clamped and every stroke bounded, so neither a
//     runaway client nor a crafted request can write an oversized item into the
//     request-unit pool shared with student progress.

const MAX_WORDS_PER_STUDENT_PER_DAY = 40;  // a study session is ~10 words
const MAX_LETTERS_PER_WORD = 20;
// Bounds chosen so that anything a finger can physically produce survives intact:
// a real letter is 1-4 strokes of 20-100 points, and a child who goes over the
// same letter again and again still lands well inside these. Only a scribble
// that covers the box hundreds of times gets trimmed, and its verdict numbers
// are kept either way. The point of the budget is that a legal payload can never
// hit MAX_DOC_CHARS, so a real word is never refused for being too big.
const MAX_STROKES_PER_LETTER = 40;
const MAX_NUMBERS_PER_STROKE = 320;        // 160 points; the client sends ≤160
const MAX_NUMBERS_PER_LETTER = 1600;       // 800 points across all its strokes
const MAX_COORD = 256;                     // grid units; the client grid is 128
const MAX_DOC_CHARS = 200_000;             // backstop; far below Cosmos's 2 MB limit

const { cleanText, cleanNumber } = policy;

// A stroke is a flat [x0,y0,x1,y1,...] list of grid coordinates. Anything that
// is not a finite pair is dropped rather than clamped into meaning: a malformed
// stroke is worth less than no stroke, and silently repairing it would put
// invented ink into the data set.
function cleanStroke(raw, maxNumbers = MAX_NUMBERS_PER_STROKE) {
    if (!Array.isArray(raw)) return null;
    const out = [];
    for (let i = 0; i + 1 < raw.length && out.length < maxNumbers; i += 2) {
        const x = Number(raw[i]);
        const y = Number(raw[i + 1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        out.push(Math.round(Math.max(0, Math.min(MAX_COORD, x))));
        out.push(Math.round(Math.max(0, Math.min(MAX_COORD, y))));
    }
    return out.length >= 2 ? out : null;
}

function cleanStrokes(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    let budget = MAX_NUMBERS_PER_LETTER;
    for (const s of raw.slice(0, MAX_STROKES_PER_LETTER)) {
        if (budget < 2) break;
        const stroke = cleanStroke(s, Math.min(MAX_NUMBERS_PER_STROKE, budget));
        if (stroke) {
            out.push(stroke);
            budget -= stroke.length;
        }
    }
    return out;
}

function cleanLetter(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const ch = cleanText(raw.ch, 2);
    if (!ch) return null;
    const strokes = cleanStrokes(raw.s);
    if (!strokes.length) return null;
    return {
        ch,
        ok: !!raw.ok,
        att: cleanNumber(raw.att, 1, 30),
        gui: !!raw.gui,
        rev: !!raw.rev,
        ms: cleanNumber(raw.ms, 0, 600_000),
        p: cleanNumber(raw.p, 0, 1),
        r: cleanNumber(raw.r, 0, 1),
        mi: cleanNumber(raw.mi, 0, 1),
        wr: cleanNumber(raw.wr, 0, 10),
        hr: cleanNumber(raw.hr, 0, 10),
        st: cleanNumber(raw.st, 0, 64),
        mn: cleanNumber(raw.mn, 0, 16),
        ov: !!raw.ov,
        s: strokes,
    };
}

function cleanLetters(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const l of raw.slice(0, MAX_LETTERS_PER_WORD)) {
        const letter = cleanLetter(l);
        if (letter) out.push(letter);
    }
    return out;
}

async function countTodayForStudent(container, studentId, dayStartMs) {
    const { resources } = await container.items
        .query({
            query: 'SELECT VALUE COUNT(1) FROM c WHERE c.studentId = @sid AND c.capturedAt >= @day',
            parameters: [{ name: '@sid', value: studentId }, { name: '@day', value: dayStartMs }],
        })
        .fetchAll();
    return Number(resources && resources[0]) || 0;
}

app.http('saveHandwritingSample', {
    route: 'saveHandwritingSample',
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
                return { status: 410, jsonBody: { error: 'Handwriting sample collection has closed.' } };
            }

            const authGate = auth.requireAuth(request, body.authToken);
            if (authGate.error) return authGate.error;
            const token = authGate.token;

            // Identity comes from the token, never from the body: a client
            // cannot file traces against another student, or widen its own
            // enable list by claiming someone else's id.
            const studentId = token && token.sub;
            if (!studentId) return auth.unauthorized();
            if (!policy.isCaptureEnabled(studentId)) {
                // Quiet 200, not 403: a student who is not being recorded should
                // never see an error, and the client uses this to stop trying.
                return { status: 200, jsonBody: { success: true, skipped: 'not_enabled' } };
            }

            const letters = cleanLetters(body.letters);
            if (!letters.length) {
                return { status: 400, jsonBody: { error: 'No usable letter traces.' } };
            }

            const container = getHandwritingContainer();
            const dayStart = policy.cnDayStartMs();
            const storedToday = await countTodayForStudent(container, studentId, dayStart);
            if (storedToday >= MAX_WORDS_PER_STUDENT_PER_DAY) {
                return { status: 200, jsonBody: { success: true, skipped: 'cap_reached' } };
            }

            const capturedAt = cleanNumber(body.capturedAt, 0, Date.now() + 60_000) || Date.now();
            const doc = {
                id: `${studentId}-${capturedAt}-${Math.random().toString(36).slice(2, 8)}`,
                studentId, // partition key
                student: cleanText(body.student, 60),
                capturedAt,
                word: cleanText(body.word, 60),
                book: cleanText(body.book, 24),
                unit: cleanText(body.unit, 24),
                mode: cleanText(body.mode, 16),
                // Engine revision and the constants it ran with, so a trace stays
                // interpretable after the geometry changes.
                engine: cleanNumber(body.engine, 0, 999),
                size: cleanNumber(body.size, 16, 1024),
                pen: cleanNumber(body.pen, 1, 64),
                tol: cleanNumber(body.tol, 0, 64),
                boxPx: cleanNumber(body.boxPx, 16, 4096),
                dpr: cleanNumber(body.dpr, 0.5, 8),
                ua: cleanText(body.ua, 160),
                letters,
            };

            const serialized = JSON.stringify(doc);
            if (serialized.length > MAX_DOC_CHARS) {
                return { status: 413, jsonBody: { error: 'Trace too large to store.' } };
            }

            await container.items.create(doc);

            return {
                status: 201,
                jsonBody: { success: true, id: doc.id, storedToday: storedToday + 1, cap: MAX_WORDS_PER_STUDENT_PER_DAY },
            };
        } catch (error) {
            context.error('saveHandwritingSample failed:', error);
            return { status: 500, body: 'Server error while storing handwriting sample.' };
        }
    },
});

module.exports = {
    cleanStroke,
    cleanStrokes,
    cleanLetter,
    cleanLetters,
    countTodayForStudent,
    MAX_WORDS_PER_STUDENT_PER_DAY,
    MAX_LETTERS_PER_WORD,
    MAX_STROKES_PER_LETTER,
    MAX_NUMBERS_PER_STROKE,
    MAX_NUMBERS_PER_LETTER,
    MAX_COORD,
    MAX_DOC_CHARS,
};
