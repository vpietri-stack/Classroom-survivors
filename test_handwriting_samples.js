/* test_handwriting_samples.js — regression tests for the handwriting-trace
 * research collection (temporary; see docs/wiki/05-study-mode.md).
 *
 * These exist because the failure modes here are silent and bad: recording a
 * student who should not be recorded, unbounded writes into the account that
 * also holds student progress, and a stored trace that cannot be interpreted
 * later because the engine constants were not kept with it.
 *
 * Run: node test_handwriting_samples.js  (part of root npm test)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
let ok = true;
let passed = 0, failed = 0;

function check(cond, msg) {
    if (cond) { passed++; console.log('PASS ' + msg); }
    else { failed++; ok = false; console.log('FAIL ' + msg); }
}
function eq(actual, expected, msg) {
    check(actual === expected, msg + ' (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + ')');
}

// ---------------------------------------------------------------------------
// 1. Server-side policy: enable list, capture window, day boundary
// ---------------------------------------------------------------------------
const policy = require('./api/src/functions/shared/handwritingSamples');

function setEnv(ids, ends) {
    if (ids === undefined) delete process.env.HANDWRITING_SAMPLE_IDS;
    else process.env.HANDWRITING_SAMPLE_IDS = ids;
    if (ends === undefined) delete process.env.HANDWRITING_SAMPLE_CAPTURE_ENDS;
    else process.env.HANDWRITING_SAMPLE_CAPTURE_ENDS = ends;
}

console.log('=== enable list (must fail CLOSED) ===');
setEnv(undefined, undefined);
eq(policy.isCaptureEnabled('student_andy_panyian'), false, 'unset app setting records nobody');
setEnv('', undefined);
eq(policy.isCaptureEnabled('student_andy_panyian'), false, 'empty app setting records nobody');
setEnv('   ', undefined);
eq(policy.isCaptureEnabled('student_andy_panyian'), false, 'whitespace-only app setting records nobody');

console.log('\n=== `*` is the explicit all-students switch ===');
setEnv('*', undefined);
eq(policy.isCaptureEnabled('student_andy_panyian'), true, '`*` enables an ordinary student');
eq(policy.isCaptureEnabled('student_anyone_else'), true, '`*` enables every student');
eq(policy.isCaptureEnabled(''), false, '`*` still refuses an empty id');
eq(policy.isCaptureEnabled(null), false, '`*` still refuses a null id');
eq(policy.isCaptureEnabled(undefined), false, '`*` still refuses an undefined id');
eq(policy.isCaptureEnabled({ sub: 'x' }), false, '`*` refuses a non-string id');

console.log('\n=== an explicit list narrows capture ===');
setEnv('student_andy_panyian,student_cody_lijunlong', undefined);
eq(policy.isCaptureEnabled('student_andy_panyian'), true, 'listed id is recorded');
eq(policy.isCaptureEnabled('student_cody_lijunlong'), true, 'second listed id is recorded');
eq(policy.isCaptureEnabled('student_someone_else'), false, 'unlisted id is NOT recorded');

console.log('\n=== enable-list parsing tolerances ===');
setEnv('aaa; bbb   ccc', undefined);
eq(policy.enabledIds().size, 3, 'accepts semicolon and whitespace separators');
setEnv('"aaa", "bbb"', undefined);
eq(policy.isCaptureEnabled('aaa'), true, 'strips surrounding quotes');
setEnv('Student_Andy_Panyian', undefined);
eq(policy.isCaptureEnabled('student_andy_panyian'), true, 'matching is case-insensitive');
eq(policy.isCaptureEnabled('  student_andy_panyian  '), true, 'surrounding whitespace on the id is tolerated');

console.log('\n=== display names are never the key ===');
// Several live students share a display name, so name matching could record a
// child who was meant to be left out.
setEnv('Cindy', undefined);
eq(policy.isCaptureEnabled('student_cindy_zhangxiyi'), false, 'a display name in the list matches nobody');
setEnv('*', undefined);
eq(policy.isCaptureEnabled('Cindy'), true, 'only the id form is ever accepted from a token');

console.log('\n=== capture window ===');
setEnv('aaa', undefined);
const defaultEnd = policy.captureEndsAt();
eq(defaultEnd, Date.parse(policy.DEFAULT_CAPTURE_ENDS), 'default window end is the documented instant');
eq(policy.withinCaptureWindow(defaultEnd - 1), true, 'open just before the deadline');
eq(policy.withinCaptureWindow(defaultEnd), false, 'closed exactly AT the deadline');
eq(policy.withinCaptureWindow(defaultEnd + 1), false, 'closed after the deadline');
check(Date.now() < defaultEnd, 'the default deadline is still in the future (bump it deliberately if this fails)');
check(defaultEnd - Date.now() > 30 * 86400000, 'the window is long-running, as intended (months, not days)');

setEnv('aaa', '2026-01-01T00:00:00+08:00');
eq(policy.withinCaptureWindow(), false, 'an override can close collection early');
setEnv('aaa', 'not-a-date');
eq(policy.captureEndsAt(), Date.parse(policy.DEFAULT_CAPTURE_ENDS), 'an unparseable override falls back to the default');

console.log('\n=== the daily cap counts China-time days ===');
// The Functions run in UTC; a UTC midnight would split one morning's lesson
// across two counters and let a student send double the cap.
const CN = policy.CN_OFFSET_MS;
const cnNoon = Date.parse('2026-10-11T04:00:00Z');      // 12:00 in China
eq(policy.cnDayStartMs(cnNoon), Date.parse('2026-10-10T16:00:00Z'), 'day starts at China midnight');
eq(policy.cnDayStartMs(Date.parse('2026-10-10T16:00:00Z')), Date.parse('2026-10-10T16:00:00Z'),
    'exactly at China midnight belongs to the new day');
eq(policy.cnDayStartMs(Date.parse('2026-10-10T15:59:59Z')), Date.parse('2026-10-09T16:00:00Z'),
    'one second earlier belongs to the previous day');
eq(policy.cnDayStartMs(cnNoon + 86400000), policy.cnDayStartMs(cnNoon) + 86400000, 'days are exactly 24h apart');
eq(CN, 8 * 3600 * 1000, 'China offset is +08:00');

// ---------------------------------------------------------------------------
// 2. Endpoint sanitizers and the size guards
// ---------------------------------------------------------------------------
console.log('\n=== stroke sanitizing ===');
const ep = require('./api/src/functions/saveHandwritingSample');

eq(ep.cleanStroke([10, 20, 30, 40]).join(','), '10,20,30,40', 'a clean stroke survives');
eq(ep.cleanStroke([10.4, 20.6]).join(','), '10,21', 'coordinates are rounded to integers');
eq(ep.cleanStroke([-5, 300]).join(','), '0,' + ep.MAX_COORD, 'coordinates are clamped into the grid');
eq(ep.cleanStroke([10, 20, 'x', 40, 50, 60]).join(','), '10,20,50,60', 'a non-finite pair is dropped, not repaired');
eq(ep.cleanStroke([10, 20, NaN]).join(','), '10,20', 'a trailing half-pair is dropped');
eq(ep.cleanStroke([10]), null, 'a single number is not a stroke');
eq(ep.cleanStroke([]), null, 'an empty stroke is dropped');
eq(ep.cleanStroke('nope'), null, 'a non-array stroke is refused');
eq(ep.cleanStroke(null), null, 'a null stroke is refused');
const long = [];
for (let i = 0; i < 5000; i++) long.push(i % ep.MAX_COORD, i % ep.MAX_COORD);
eq(ep.cleanStroke(long).length, ep.MAX_NUMBERS_PER_STROKE, 'an enormous stroke is truncated to the cap');

console.log('\n=== letter sanitizing ===');
const goodLetter = { ch: 'a', ok: true, att: 1, gui: false, rev: false, ms: 1200, p: 0.8, r: 0.9, mi: 0.02, wr: 1, hr: 1, st: 1, mn: 1, ov: false, s: [[10, 20, 30, 40]] };
const cleaned = ep.cleanLetter(goodLetter);
check(!!cleaned, 'a well-formed letter is kept');
eq(cleaned.ch, 'a', 'keeps the target character');
eq(cleaned.ok, true, 'keeps the verdict');
eq(cleaned.s.length, 1, 'keeps the stroke');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { s: [] })), null, 'a letter with no strokes is refused');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { s: 'junk' })), null, 'a letter with junk strokes is refused');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { ch: '' })), null, 'a letter with no target is refused');
eq(ep.cleanLetter(null), null, 'a null letter is refused');
eq(ep.cleanLetter('a'), null, 'a non-object letter is refused');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { p: 99 })).p, 1, 'precision is clamped to 1');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { r: -3 })).r, 0, 'recall is clamped to 0');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { ms: 1e9 })).ms, 600000, 'a runaway duration is clamped');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { att: 0 })).att, 1, 'attempt is at least 1');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { ov: 'yes' })).ov, true, 'overfilled is coerced to a boolean');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { p: 'junk' })).p, null, 'a non-numeric score becomes null, not 0');
eq(ep.cleanLetter(Object.assign({}, goodLetter, { ch: 'abcdefgh' })).ch, 'ab', 'the character field cannot hold a string');

const many = [];
for (let i = 0; i < 500; i++) many.push(goodLetter);
eq(ep.cleanLetters(many).length, ep.MAX_LETTERS_PER_WORD, 'a word cannot carry more letters than the cap');
eq(ep.cleanLetters('junk').length, 0, 'a non-array letter list yields nothing');
eq(ep.cleanLetters([goodLetter, null, 'junk', goodLetter]).length, 2, 'junk entries are dropped, good ones kept');

console.log('\n=== size guards protect the shared request-unit pool ===');
check(ep.MAX_DOC_CHARS < 2 * 1024 * 1024 - 65536, 'the document cap leaves room under the 2 MB item limit');
// The field caps must bound a legal payload BELOW the document cap: a real
// word should never be refused for being too big, so the 413 can only ever
// fire on a hand-built request.
const worstDoc = { letters: ep.cleanLetters(new Array(ep.MAX_LETTERS_PER_WORD).fill({
    ch: 'x', ok: true, s: new Array(ep.MAX_STROKES_PER_LETTER).fill(long)
})) };
const worstChars = JSON.stringify(worstDoc).length;
check(worstChars < ep.MAX_DOC_CHARS,
    'the worst legal payload fits the document cap, so real words are never refused (' +
    worstChars + ' < ' + ep.MAX_DOC_CHARS + ')');
check(worstChars < 2 * 1024 * 1024 - 65536, 'and stays far under a Cosmos item (' + worstChars + ' chars)');
eq(worstDoc.letters.length, ep.MAX_LETTERS_PER_WORD, 'a legal word keeps every letter up to the cap');
const perLetterNumbers = worstDoc.letters[0].s.reduce((n, s) => n + s.length, 0);
eq(perLetterNumbers, ep.MAX_NUMBERS_PER_LETTER,
    'the per-letter point budget binds, so fat strokes cannot outrun it');
const manyStrokes = [];
for (let i = 0; i < 500; i++) manyStrokes.push([10, 20, 30, 40]);
eq(ep.cleanStrokes(manyStrokes).length, ep.MAX_STROKES_PER_LETTER,
    'an absurd stroke count is trimmed rather than stored whole');
const typical = { letters: ep.cleanLetters([{ ch: 'a', ok: true, s: [[10, 20, 30, 40, 50, 60]] }]) };
check(JSON.stringify(typical).length < 2000, 'an ordinary letter stays small');
eq(ep.MAX_COORD, 256, 'coordinate ceiling');
check(ep.MAX_WORDS_PER_STUDENT_PER_DAY > 0 && ep.MAX_WORDS_PER_STUDENT_PER_DAY <= 200,
    'the daily word cap is sane (' + ep.MAX_WORDS_PER_STUDENT_PER_DAY + ')');

// ---------------------------------------------------------------------------
// 3. Client-side decision + daily counter (module is browser-only: load in a VM)
// ---------------------------------------------------------------------------
console.log('\n=== client decideCapture (fail-closed rules) ===');
const captureSrc = fs.readFileSync(path.join(ROOT, 'handwriting_sample_capture.js'), 'utf8');
const store = {};
const sandbox = {
    window: {},
    console: console,
    Date: Date, Number: Number, String: String, Math: Math, JSON: JSON,
    Array: Array, Object: Object, Promise: Promise, setTimeout: setTimeout,
    navigator: { userAgent: 'test-agent' },
    localStorage: {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; }
    }
};
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.navigator = sandbox.navigator;
sandbox.global = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(captureSrc, sandbox, { filename: 'handwriting_sample_capture.js' });

const cap = sandbox.window.HandwritingSampleCapture;
check(!!cap, 'module exposes window.HandwritingSampleCapture');
['beginWord', 'recordLetter', 'endWord', 'ensureConfig', 'decideCapture', 'status'].forEach(fn => {
    check(typeof cap[fn] === 'function', 'exposes ' + fn + '()');
});

const ENDS = Date.parse(policy.DEFAULT_CAPTURE_ENDS);
const BEFORE = ENDS - 60000;
const good = { enabled: true, endsAt: ENDS, nowMs: BEFORE, letters: 6, maxPerDay: 40, sentToday: 0 };

eq(cap.decideCapture(good).ok, true, 'records when enabled, in window, under cap');
eq(cap.decideCapture(Object.assign({}, good, { enabled: false })).ok, false, 'refuses when not enabled');
eq(cap.decideCapture(Object.assign({}, good, { enabled: false })).reason, 'not_enabled', 'names the enable reason');
eq(cap.decideCapture(Object.assign({}, good, { nowMs: ENDS })).ok, false, 'refuses exactly at the deadline');
eq(cap.decideCapture(Object.assign({}, good, { nowMs: ENDS + 1 })).reason, 'window_closed', 'names the window reason');
eq(cap.decideCapture(Object.assign({}, good, { letters: 0 })).ok, false, 'refuses a word with no traces');
eq(cap.decideCapture(Object.assign({}, good, { letters: 0 })).reason, 'no_traces', 'names the empty reason');
eq(cap.decideCapture(Object.assign({}, good, { sentToday: 40 })).ok, false, 'refuses once the daily cap is reached');
eq(cap.decideCapture(Object.assign({}, good, { sentToday: 40 })).reason, 'cap_reached', 'names the cap reason');
eq(cap.decideCapture(Object.assign({}, good, { sentToday: 39 })).ok, true, 'still records just under the cap');
eq(cap.decideCapture(Object.assign({}, good, { maxPerDay: 0, sentToday: 40 })).ok, false,
    'a missing maxPerDay falls back to the built-in cap rather than failing open');
eq(cap.decideCapture(undefined).ok, false, 'refuses an undefined input');
eq(cap.decideCapture({}).ok, false, 'refuses an empty input');
eq(cap.decideCapture(Object.assign({}, good, { endsAt: 'garbage' })).ok, true,
    'a garbage endsAt falls back to the built-in deadline rather than failing open');

console.log('\n=== client and server cannot drift apart ===');
eq(cap.DEFAULT_MAX_WORDS_PER_DAY, ep.MAX_WORDS_PER_STUDENT_PER_DAY,
    'the client fallback cap equals the server cap');
const clientEnds = /CAPTURE_ENDS_AT = Date\.parse\('([^']+)'\)/.exec(captureSrc);
check(!!clientEnds, 'the client carries its own fallback deadline');
eq(Date.parse(clientEnds[1]), Date.parse(policy.DEFAULT_CAPTURE_ENDS),
    'the client fallback deadline equals the server default');

console.log('\n=== the daily counter rolls over instead of accumulating keys ===');
const now = Date.parse('2026-10-11T04:00:00Z');   // 12:00 in China
cap.writeSentToday('student_a', 3, now);
eq(cap.readSentToday('student_a', now), 3, 'counts what was sent today');
eq(Object.keys(store).filter(k => k.indexOf('csHwWordsSent_') === 0).length, 1, 'one key per student');
cap.writeSentToday('student_a', 4, now);
eq(cap.readSentToday('student_a', now), 4, 'the counter increments');
eq(Object.keys(store).filter(k => k.indexOf('csHwWordsSent_') === 0).length, 1, 'still one key after a second write');
eq(cap.readSentToday('student_a', now + 86400000), 0, 'yesterday\'s count does not carry into today');
eq(cap.readSentToday('student_b', now), 0, 'an unknown student starts at zero');
store.csHwWordsSent_student_c = 'not json';
eq(cap.readSentToday('student_c', now), 0, 'a corrupt counter reads as zero, and does not throw');
eq(cap.dayKey(now), '20261011', 'the day key is the China-time date');
eq(cap.dayKey(Date.parse('2026-10-11T15:00:00Z')), '20261011', 'late UTC hours are still the same China day');
eq(cap.dayKey(Date.parse('2026-10-11T16:30:00Z')), '20261012', 'past China midnight the key rolls over');

console.log('\n=== nothing is recorded without asking the server first ===');
check(!/HANDWRITING_SAMPLE_IDS|enabledIds/.test(captureSrc), 'the enable list is NOT embedded in client code (repo is public)');
const endWordIdx = captureSrc.indexOf('function endWord');
const ensureIdx = captureSrc.indexOf('ensureConfig(function', endWordIdx);
check(endWordIdx > 0 && ensureIdx > endWordIdx, 'endWord asks the server before queueing anything');
const recordIdx = captureSrc.indexOf('function recordLetter');
check(recordIdx > 0 && recordIdx < endWordIdx, 'letters are buffered before any decision is made');
check(!/localStorage/.test(captureSrc.slice(0, captureSrc.indexOf('function readSentToday'))),
    'buffered traces are held in memory only, never in localStorage');

// ---------------------------------------------------------------------------
// 4. Stroke compaction in the engine
// ---------------------------------------------------------------------------
console.log('\n=== stroke compaction (engine side) ===');
const hw = require('./handwriting.js');
eq(hw.HW_ENGINE_VERSION, 1, 'the engine carries a version so stored traces stay interpretable');
eq(hw.hwCompactStroke([]).length, 0, 'an empty stroke compacts to nothing');
eq(hw.hwCompactStroke(null).length, 0, 'a null stroke compacts to nothing');
const three = [{ x: 1.4, y: 2.6 }, { x: 10, y: 20 }, { x: 30.5, y: 40.5 }];
eq(hw.hwCompactStroke(three).join(','), '1,3,10,20,31,41', 'short strokes keep every point, rounded');
const dense = [];
for (let i = 0; i < 5000; i++) dense.push({ x: i % 128, y: (i * 7) % 128 });
const compact = hw.hwCompactStroke(dense);
eq(compact.length, hw.HW_MAX_TRACE_POINTS * 2, 'a dense stroke is bounded to the point cap');
eq(compact[0], Math.round(dense[0].x), 'compaction keeps the first point');
eq(compact[compact.length - 2], Math.round(dense[4999].x), 'compaction keeps the last point');
check(compact.every(n => Number.isInteger(n) && n >= 0 && n <= 128), 'every stored coordinate is an integer in the grid');
// A compacted trace must still rasterise to the same ink, or the stored data
// could not be replayed against the geometry that judged it. Measured on a
// realistic sweep — consecutive samples ~1 unit apart, the spacing pointermove
// delivers from a finger — not on a synthetic path that jumps the box in one
// step, which a finger cannot produce and which decimation is lossy for by
// construction (every jump becomes a long drawn line).
const sweep = [];
{
    let x = 10, y = 10, dx = 1.2, dy = 0.6;
    for (let i = 0; i < 1200; i++) {
        x += dx; y += dy;
        if (x > 118 || x < 10) { dx = -dx; x = Math.max(10, Math.min(118, x)); }
        if (y > 118 || y < 10) { dy = -dy; y = Math.max(10, Math.min(118, y)); }
        sweep.push({ x: x, y: y });
    }
}
const maskFull = hw.hwRasterise([sweep], hw.HW_SIZE, hw.HW_PEN);
const repacked = [];
const compactSweep = hw.hwCompactStroke(sweep);
for (let i = 0; i < compactSweep.length; i += 2) repacked.push({ x: compactSweep[i], y: compactSweep[i + 1] });
const maskCompact = hw.hwRasterise([repacked], hw.HW_SIZE, hw.HW_PEN);
let same = 0;
for (let i = 0; i < maskFull.length; i++) if (maskFull[i] === maskCompact[i]) same++;
check(same / maskFull.length > 0.99,
    'a compacted realistic trace rasterises to the same ink: ' + (100 * same / maskFull.length).toFixed(2) + '% identical');
// The snapshot must be a copy: the round wipes the ink right after a rejection.
const original = [{ x: 5, y: 5 }, { x: 50, y: 50 }];
const snapshot = hw.hwCompactStroke(original);
original[0].x = 999;
eq(snapshot[0], 5, 'the snapshot is not aliased to the live stroke');

// ---------------------------------------------------------------------------
// 5. Wiring
// ---------------------------------------------------------------------------
console.log('\n=== the collection is wired into the page ===');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check(/handwriting_sample_capture\.js\?v=/.test(html), 'index.html loads the capture module with a cache-buster');
const study = fs.readFileSync(path.join(ROOT, 'study_mode.js'), 'utf8');
check(/hwCaptureBeginWord\(/.test(study), 'the round opens a trace buffer per word');
check(/hwCaptureLetter\(true/.test(study) && /hwCaptureLetter\(false/.test(study),
    'both accepted and rejected letters are recorded');
check(/hwCaptureEndWord\(\)/.test(study), 'the round flushes the buffer');
const exitIdx = study.indexOf('function exitStudyMode');
check(exitIdx > 0 && study.indexOf('hwCaptureEndWord()', exitIdx) > exitIdx,
    'leaving study mode mid-word still flushes the buffer');
const rejectIdx = study.indexOf('function roundDRejectLetter');
const clearIdx = study.indexOf('roundDTrace.clearInk()', rejectIdx);
const recordIdx2 = study.indexOf('hwCaptureLetter(false', rejectIdx);
check(rejectIdx > 0 && recordIdx2 > rejectIdx && recordIdx2 < clearIdx,
    'a rejection is recorded BEFORE the ink is wiped');

const engineSrc = fs.readFileSync(path.join(ROOT, 'handwriting.js'), 'utf8');
check(/takeTrace: function/.test(engineSrc), 'the trace box exposes takeTrace()');
check(/HW_ENGINE_VERSION/.test(engineSrc), 'the engine stamps a version into every trace');

console.log('\n=== both endpoints are registered for CORS preflight ===');
// Called cross-origin from GitHub Pages with X-App-Key / X-Auth-Token, so a
// missing OPTIONS route makes the browser block the request outright — and it
// fails silently as a network error the client is designed to swallow.
const corsSrc = fs.readFileSync(path.join(ROOT, 'api', 'src', 'functions', 'corsOptions.js'), 'utf8');
check(/'handwritingCaptureConfig'/.test(corsSrc), 'handwritingCaptureConfig is in the OPTIONS route list');
check(/'saveHandwritingSample'/.test(corsSrc), 'saveHandwritingSample is in the OPTIONS route list');

console.log('\n=== traces must not share a container with student progress ===');
const dbSrc = fs.readFileSync(path.join(ROOT, 'api', 'src', 'functions', 'shared', 'db.js'), 'utf8');
check(/getHandwritingContainer/.test(dbSrc), 'db.js exposes a separate getHandwritingContainer()');
check(/handwriting_samples/.test(dbSrc), 'the trace container is distinct from Students');
const saveSrc = fs.readFileSync(path.join(ROOT, 'api', 'src', 'functions', 'saveHandwritingSample.js'), 'utf8');
check(/getHandwritingContainer/.test(saveSrc), 'saveHandwritingSample writes to the trace container');
check(!/getContainer\(\)/.test(saveSrc), 'saveHandwritingSample never touches the Students container');
check(!/getSamplesContainer/.test(saveSrc), 'handwriting traces never land in the speech container');
check(!/queueExerciseEvent|analyticsQueue/.test(saveSrc), 'traces never enter the analytics queue');
check(/token\.sub/.test(saveSrc), 'the stored student comes from the token, not the body');
check(/withinCaptureWindow/.test(saveSrc), 'the window is enforced server-side too');
check(/isCaptureEnabled/.test(saveSrc), 'the enable list is enforced server-side too');

console.log('\n=== traces cannot be committed ===');
const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
check(/handwriting_samples/.test(gi), '.gitignore excludes the handwriting_samples output directory');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
console.log(ok ? 'ALL HANDWRITING-SAMPLE TESTS PASS' : 'HANDWRITING-SAMPLE TESTS FAILED');
process.exit(ok ? 0 : 1);
