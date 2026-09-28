// Security follow-ups from the geo v2 whole-branch review (2026-09-27):
//  1. sanitizeAvatar (updateAvatar.js): `avatar` is student-writable
//     (updateAvatar self-scope) yet lands in the TEACHER dashboard's
//     innerHTML (table rows + bulk chips) — stored XSS with a privileged
//     token as the payoff. Server must reject anything HTML-significant or
//     oversized; the picker only ever sends short emoji. Client-side _esc at
//     both sinks is the primary defense; this is the belt.
//  2. authorizeClearGeo (clearGeo.js): privileged gate for the PII-deleting
//     endpoint, pinned as TRACKED coverage (api/test_auth.js is deliberately
//     gitignored, so without this the gate has no committed test).
const assert = require('assert');
const { sanitizeAvatar } = require('./api/src/functions/updateAvatar.js');
const { authorizeClearGeo } = require('./api/src/functions/clearGeo.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS: ' + name); passed++; }
    catch (e) { console.error('FAIL: ' + name); console.error(e); failed++; }
}

console.log('=== TEST SUITE: Dashboard Security ===\n');

// Emoji written as \u escapes: ZWJ sequences corrupt when round-tripped
// through editors that normalize them. CAT = U+1F431, FOX = U+1F98A,
// FAMILY = man ZWJ woman ZWJ boy (8 UTF-16 units, under the 32 cap).
const CAT = '\uD83D\uDC31';
const FOX = '\uD83E\uDD8A';
const FAMILY = '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC66';

// ---- sanitizeAvatar ----
test('picker emoji avatars pass through unchanged', () => {
    assert.strictEqual(sanitizeAvatar(CAT), CAT);
    assert.strictEqual(sanitizeAvatar(FAMILY), FAMILY);
});
test('HTML-significant characters are rejected', () => {
    assert.strictEqual(sanitizeAvatar('<img src=x onerror=alert(1)>'), null);
    assert.strictEqual(sanitizeAvatar('a"b'), null);
    assert.strictEqual(sanitizeAvatar("o'brien"), null);
    assert.strictEqual(sanitizeAvatar('x&y'), null);
    assert.strictEqual(sanitizeAvatar('`code`'), null);
});
test('length capped at 32 chars', () => {
    assert.strictEqual(sanitizeAvatar('a'.repeat(32)), 'a'.repeat(32));
    assert.strictEqual(sanitizeAvatar('a'.repeat(33)), null);
});
test('non-strings and blanks rejected', () => {
    assert.strictEqual(sanitizeAvatar(null), null);
    assert.strictEqual(sanitizeAvatar(undefined), null);
    assert.strictEqual(sanitizeAvatar(''), null);
    assert.strictEqual(sanitizeAvatar('   '), null);
    assert.strictEqual(sanitizeAvatar({}), null);
    assert.strictEqual(sanitizeAvatar(42), null);
});
test('surrounding whitespace trimmed', () => {
    assert.strictEqual(sanitizeAvatar(' ' + FOX + ' '), FOX);
});

// ---- authorizeClearGeo ----
test('teacher/BM/admin tokens pass (null error)', () => {
    assert.strictEqual(authorizeClearGeo({ role: 'teacher' }), null);
    assert.strictEqual(authorizeClearGeo({ role: 'BM' }), null);
    assert.strictEqual(authorizeClearGeo({ role: 'admin' }), null);
});
test('student and missing tokens get 403', () => {
    assert.strictEqual(authorizeClearGeo({ role: 'student' }).status, 403);
    assert.strictEqual(authorizeClearGeo(null).status, 403);
    assert.strictEqual(authorizeClearGeo(undefined).status, 403);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
