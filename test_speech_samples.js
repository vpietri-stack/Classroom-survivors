/* test_speech_samples.js — regression tests for the TEMPORARY speech-sample
 * research collection (consented students only, one week from 2026-10-10).
 *
 * These exist because the failure modes here are consent violations and
 * unbounded writes into the account that also holds student progress — both
 * silent, both bad. Run: node test_speech_samples.js  (part of root npm test)
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
// 1. Server-side policy: consent list + capture window
// ---------------------------------------------------------------------------
const policy = require('./api/src/functions/shared/speechSamples');

function setEnv(ids, ends) {
    if (ids === undefined) delete process.env.SPEECH_SAMPLE_CONSENTED_IDS;
    else process.env.SPEECH_SAMPLE_CONSENTED_IDS = ids;
    if (ends === undefined) delete process.env.SPEECH_SAMPLE_CAPTURE_ENDS;
    else process.env.SPEECH_SAMPLE_CAPTURE_ENDS = ends;
}

console.log('=== consent list (must fail CLOSED) ===');
setEnv(undefined, undefined);
eq(policy.isConsented('student_andy_panyian'), false, 'unset app setting consents nobody');
setEnv('', undefined);
eq(policy.isConsented('student_andy_panyian'), false, 'empty app setting consents nobody');
setEnv('   ', undefined);
eq(policy.isConsented('student_andy_panyian'), false, 'whitespace-only app setting consents nobody');

setEnv('student_andy_panyian,student_cody_lijunlong', undefined);
eq(policy.isConsented('student_andy_panyian'), true, 'listed id is consented');
eq(policy.isConsented('student_cody_lijunlong'), true, 'second listed id is consented');
eq(policy.isConsented('student_someone_else'), false, 'unlisted id is NOT consented');
eq(policy.isConsented(''), false, 'empty id is not consented');
eq(policy.isConsented(null), false, 'null id is not consented');
eq(policy.isConsented(undefined), false, 'undefined id is not consented');

console.log('\n=== consent list parsing tolerances ===');
setEnv('aaa; bbb   ccc', undefined);
eq(policy.consentedIds().size, 3, 'accepts semicolon and whitespace separators');
setEnv('"aaa", "bbb"', undefined);
eq(policy.isConsented('aaa'), true, 'strips surrounding quotes');
setEnv('Student_Andy_Panyian', undefined);
eq(policy.isConsented('student_andy_panyian'), true, 'matching is case-insensitive');
eq(policy.isConsented('  student_andy_panyian  '), true, 'surrounding whitespace on the id is tolerated');

console.log('\n=== display names must never be the consent key ===');
// Three consented children share a display name with a DIFFERENT live student
// ("Annie", "Simon", "Cindy"), so name matching could record a child whose
// parents never agreed. Consent is keyed on studentId only.
setEnv('student_cindy_zhangxiyi', undefined);
eq(policy.isConsented('Cindy'), false, 'a display name is never consented, even when it matches');
eq(policy.isConsented('student_cindy_zhangxinyun'), false, 'the same-name OTHER student is not consented');

console.log('\n=== capture window ===');
setEnv('aaa', undefined);
const defaultEnd = policy.captureEndsAt();
eq(defaultEnd, Date.parse(policy.DEFAULT_CAPTURE_ENDS), 'default window end is the documented instant');
eq(policy.withinCaptureWindow(defaultEnd - 1), true, 'open just before the deadline');
eq(policy.withinCaptureWindow(defaultEnd), false, 'closed exactly AT the deadline');
eq(policy.withinCaptureWindow(defaultEnd + 1), false, 'closed after the deadline');
eq(policy.withinCaptureWindow(Date.parse('2020-01-01T00:00:00Z')), true, 'open well before the deadline');
check(Date.now() < defaultEnd, 'the default deadline is still in the future (bump it deliberately if this fails)');

setEnv('aaa', '2026-01-01T00:00:00+08:00');
eq(policy.withinCaptureWindow(), false, 'an override can close collection early');
setEnv('aaa', 'not-a-date');
eq(policy.captureEndsAt(), Date.parse(policy.DEFAULT_CAPTURE_ENDS), 'an unparseable override falls back to the default');

// ---------------------------------------------------------------------------
// 2. Endpoint sanitizers + the size guard
// ---------------------------------------------------------------------------
console.log('\n=== endpoint input sanitizing ===');
const ep = require('./api/src/functions/saveSpeechSample');

const CTRL = String.fromCharCode(1) + String.fromCharCode(27) + String.fromCharCode(127);
eq(ep.cleanText('  hello  '), 'hello', 'cleanText trims');
eq(ep.cleanText('a' + CTRL + 'b'), 'a   b', 'cleanText replaces control characters with spaces');
eq(ep.cleanText(42), '', 'cleanText rejects non-strings');
eq(ep.cleanText(null), '', 'cleanText rejects null');
eq(ep.cleanText('x'.repeat(900)).length, 400, 'cleanText clamps length');

eq(ep.cleanNumber(0.5, 0, 1), 0.5, 'cleanNumber passes an in-range value');
eq(ep.cleanNumber(5, 0, 1), 1, 'cleanNumber clamps high');
eq(ep.cleanNumber(-5, 0, 1), 0, 'cleanNumber clamps low');
eq(ep.cleanNumber('nope', 0, 1), null, 'cleanNumber rejects non-numeric');
eq(ep.cleanNumber(NaN, 0, 1), null, 'cleanNumber rejects NaN');
eq(ep.cleanNumber(Infinity, 0, 1), null, 'cleanNumber rejects Infinity');

console.log('\n=== base64 WAV guard ===');
const RIFF_HEADER = Buffer.from('RIFF....WAVEfmt ', 'latin1').toString('base64');
const longEnough = RIFF_HEADER + 'A'.repeat(120);
eq(ep.looksLikeWavBase64(longEnough), true, 'accepts base64 that decodes to a RIFF header');
eq(ep.looksLikeWavBase64(Buffer.from('NOT A WAV FILE AT ALL, no really', 'latin1').toString('base64') + 'A'.repeat(120)),
    false, 'rejects base64 that is not a WAV');
eq(ep.looksLikeWavBase64(''), false, 'rejects empty');
eq(ep.looksLikeWavBase64(null), false, 'rejects null');
eq(ep.looksLikeWavBase64(12345), false, 'rejects non-strings');
eq(ep.looksLikeWavBase64('A'.repeat(200)), false, 'rejects too-short payloads');
eq(ep.looksLikeWavBase64('!!!!not-base64!!!!' + 'A'.repeat(200)), false, 'rejects non-base64 characters');

console.log('\n=== size guard protects the Cosmos 2 MB item limit ===');
// 15 s at 48 kHz mono 16-bit = 1.44 MB of PCM; base64 inflates by 4/3.
const worstCasePcm = 15 * 48000 * 2;
const worstCaseB64 = Math.ceil(worstCasePcm / 3) * 4;
check(worstCaseB64 > ep.MAX_WAV_BASE64_CHARS,
    'the cap genuinely rejects the worst case (' + worstCaseB64 + ' chars > cap ' + ep.MAX_WAV_BASE64_CHARS + ')');
check(ep.MAX_WAV_BASE64_CHARS < 2 * 1024 * 1024 - 65536,
    'the cap leaves room for metadata under the 2 MB item limit');
eq(ep.MAX_SAMPLES_PER_STUDENT, 60, 'per-student sample cap');

// ---------------------------------------------------------------------------
// 3. Client-side decision (loaded in a VM — the module is browser-only)
// ---------------------------------------------------------------------------
console.log('\n=== client decideCapture (fail-closed rules) ===');
const captureSrc = fs.readFileSync(path.join(ROOT, 'speech_sample_capture.js'), 'utf8');
const sandbox = { window: {}, console: console, Date: Date, Number: Number, String: String, Promise: Promise, setTimeout: setTimeout };
sandbox.global = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(captureSrc, sandbox, { filename: 'speech_sample_capture.js' });

const cap = sandbox.window.SpeechSampleCapture;
check(!!cap, 'module exposes window.SpeechSampleCapture');
check(typeof cap.maybeCapture === 'function', 'exposes maybeCapture()');
check(typeof cap.ensureConsent === 'function', 'exposes ensureConsent()');
check(typeof cap.decideCapture === 'function', 'exposes decideCapture() for unit tests');

const ENDS = Date.parse('2026-10-17T00:00:00+08:00');
const BEFORE = ENDS - 60000;
const good = { consented: true, endsAt: ENDS, nowMs: BEFORE, blobSize: 160000, sentCount: 0 };

eq(cap.decideCapture(good).ok, true, 'captures when consented, in window, under cap');
eq(cap.decideCapture(Object.assign({}, good, { consented: false })).ok, false, 'refuses when not consented');
eq(cap.decideCapture(Object.assign({}, good, { consented: false })).reason, 'not_consented', 'names the consent reason');
eq(cap.decideCapture(Object.assign({}, good, { nowMs: ENDS })).ok, false, 'refuses exactly at the deadline');
eq(cap.decideCapture(Object.assign({}, good, { nowMs: ENDS + 1 })).ok, false, 'refuses after the deadline');
eq(cap.decideCapture(Object.assign({}, good, { nowMs: ENDS + 1 })).reason, 'window_closed', 'names the window reason');
eq(cap.decideCapture(Object.assign({}, good, { blobSize: 0 })).ok, false, 'refuses an empty recording');
eq(cap.decideCapture(Object.assign({}, good, { blobSize: undefined })).ok, false, 'refuses a missing blob size');
eq(cap.decideCapture(Object.assign({}, good, { blobSize: 5 * 1024 * 1024 })).ok, false, 'refuses an oversized recording');
eq(cap.decideCapture(Object.assign({}, good, { blobSize: 5 * 1024 * 1024 })).reason, 'too_large', 'names the size reason');
eq(cap.decideCapture(Object.assign({}, good, { sentCount: 60 })).ok, false, 'refuses once the cap is reached');
eq(cap.decideCapture(Object.assign({}, good, { sentCount: 61 })).ok, false, 'refuses past the cap');
eq(cap.decideCapture(Object.assign({}, good, { sentCount: 59 })).ok, true, 'still captures just under the cap');
eq(cap.decideCapture(undefined).ok, false, 'refuses an undefined input');
eq(cap.decideCapture({}).ok, false, 'refuses an empty input');
eq(cap.decideCapture(Object.assign({}, good, { endsAt: 'garbage' })).ok, true,
    'a garbage endsAt falls back to the built-in deadline rather than failing open');

console.log('\n=== client never records without asking the server first ===');
check(/ensureConsent/.test(captureSrc) && /maybeCapture/.test(captureSrc),
    'maybeCapture path references ensureConsent');
const maybeIdx = captureSrc.indexOf('function maybeCapture');
const ensureIdx = captureSrc.indexOf('ensureConsent(function', maybeIdx);
check(maybeIdx > 0 && ensureIdx > maybeIdx, 'maybeCapture calls ensureConsent before queueing anything');
check(!/consentedIds|CONSENTED_IDS/.test(captureSrc), 'the consent list is NOT embedded in client code (repo is public)');

console.log('\n=== recordings cannot be committed ===');
const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
check(/speech_samples/.test(gi), '.gitignore excludes the speech_samples output directory');
check(/^\*\.wav$/m.test(gi), '.gitignore excludes *.wav');

console.log('\n=== the collection is wired into the page ===');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check(/speech_sample_capture\.js\?v=\d+/.test(html), 'index.html loads speech_sample_capture.js with a cache-buster');
const ui = fs.readFileSync(path.join(ROOT, 'speech_ui.js'), 'utf8');
check(/SpeechSampleCapture/.test(ui), 'speech_ui.js hands the recording to the capture module');
check(/blob: blob/.test(ui), 'the record button passes the WAV blob through onResult meta');

console.log('\n=== both endpoints are registered for CORS preflight ===');
// Called cross-origin from GitHub Pages with X-App-Key / X-Auth-Token, so a
// missing OPTIONS route makes the browser block the request outright — and it
// fails silently as a network error the client is designed to swallow.
const corsSrc = fs.readFileSync(path.join(ROOT, 'api', 'src', 'functions', 'corsOptions.js'), 'utf8');
check(/'speechSampleConsent'/.test(corsSrc), 'speechSampleConsent is in the OPTIONS route list');
check(/'saveSpeechSample'/.test(corsSrc), 'saveSpeechSample is in the OPTIONS route list');

console.log('\n=== samples must not share a container with student progress ===');
const dbSrc = fs.readFileSync(path.join(ROOT, 'api', 'src', 'functions', 'shared', 'db.js'), 'utf8');
check(/getSamplesContainer/.test(dbSrc), 'db.js exposes a separate getSamplesContainer()');
check(/speech_samples/.test(dbSrc), 'the samples container is distinct from Students');
const saveSrc = fs.readFileSync(path.join(ROOT, 'api', 'src', 'functions', 'saveSpeechSample.js'), 'utf8');
check(/getSamplesContainer/.test(saveSrc) && !/[^s]getContainer\(\)/.test(saveSrc),
    'saveSpeechSample writes ONLY to the samples container');
check(!/require\([^)]*saveAnalytics/.test(saveSrc),
    'sample uploads never require the saveAnalytics module');
check(!/queueExerciseEvent|analyticsQueue/.test(saveSrc),
    'sample uploads never enter the analytics queue');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
console.log(ok ? 'ALL SPEECH-SAMPLE TESTS PASS' : 'SPEECH-SAMPLE TESTS FAILED');
process.exit(ok ? 0 : 1);
