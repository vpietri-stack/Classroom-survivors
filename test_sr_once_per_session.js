// Unit tests for the "SR state is written ONCE per session at the first check"
// invariant (spelling/grammar/sentenceMatch + study, shared engine).
//
// Rules under test (from the user's spec):
//   A. fail once this session  -> item reprompted until success; on success-after-
//      fail it is NOT reprompted again; SR interval reset to 1.
//   B. first-attempt success   -> item NOT reprompted again; SR interval doubles
//      (1 -> 2 -> 4 -> 8 ...).
//   Failure interval is ALWAYS 1 (due next session) even if the game ends before
//   the student succeeds. Only interval determines due-ness next session.
//
// These exercise the pure logic in sr_engine.js + the canonical-collapse in
// frontend_auth.js (finalizeSession). No DOM is required.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const src = fs.readFileSync(path.join(root, 'sr_engine.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(root, 'frontend_auth.js'), 'utf8');

// Minimal stubs so frontend_auth.js / sr_engine.js evaluate outside the browser.
const sandbox = {
  console,
  API_BASE_URL: '',
  document: { addEventListener: () => {} },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  authActiveUser: null,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const { updateSRStateForSession, finalizeSession, getCurrentSession } = sandbox;

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS:', name); }
  else { fail++; console.log('FAIL:', name); }
}

// Helper: feed a set of sessionResults through finalizeSession against a user
// whose srState we control, then read back the resulting srState.
function runFinalize(initialSR, sessionResults, initialSession = 0) {
  sandbox.authActiveUser = {
    srState: initialSR || { vocab: {}, sentences: {}, sentencePairs: {} },
    sessionCount: initialSession,
  };
  sandbox.isTestMode = false;
  finalizeSession(sessionResults, true);
  return sandbox.authActiveUser.srState;
}

// ---- updateSRStateForSession: the raw math ----

// First-time success -> interval 2 (1 -> 2).
let s = updateSRStateForSession({ vocab: {} }, [{ type: 'vocab', key: 'cat', firstAttempt: true }], 0);
ok('success first-time -> interval 2', s.vocab.cat.interval === 2 && s.vocab.cat.lastResult === 'success');

// Consecutive success -> doubles (2 -> 4, 4 -> 8).
s = updateSRStateForSession(
  { vocab: { cat: { interval: 2, dueAfterSession: 2, lastSession: 0, lastResult: 'success' } } },
  [{ type: 'vocab', key: 'cat', firstAttempt: true }], 2);
ok('success consecutive -> interval 4', s.vocab.cat.interval === 4);
s = updateSRStateForSession(
  { vocab: { cat: { interval: 4, dueAfterSession: 6, lastSession: 2, lastResult: 'success' } } },
  [{ type: 'vocab', key: 'cat', firstAttempt: true }], 6);
ok('success consecutive -> interval 8', s.vocab.cat.interval === 8);

// Failure ALWAYS resets interval to 1 (rule: failure -> interval 1, no matter prior).
s = updateSRStateForSession(
  { vocab: { cat: { interval: 8, dueAfterSession: 14, lastSession: 6, lastResult: 'success' } } },
  [{ type: 'vocab', key: 'cat', firstAttempt: false }], 6);
ok('failure after high interval -> interval 1', s.vocab.cat.interval === 1 && s.vocab.cat.lastResult === 'failure');
ok('failure -> due next session (current+1)', s.vocab.cat.dueAfterSession === 7);

// Failure with no prior state -> interval 1.
s = updateSRStateForSession({ vocab: {} }, [{ type: 'vocab', key: 'dog', firstAttempt: false }], 3);
ok('failure first-time -> interval 1', s.vocab.dog.interval === 1 && s.vocab.dog.dueAfterSession === 4);

// ---- finalizeSession: canonical collapse (first check wins) ----

// fail-then-success on the SAME item in one session -> recorded ONCE as failure
// (interval 1), NOT as a doubled success. This is the core "first check wins".
let init = { vocab: {} };
let res = runFinalize(init, [
  { type: 'vocab', key: 'cat', firstAttempt: false }, // first check = wrong
  { type: 'vocab', key: 'cat', firstAttempt: true },  // later correct
], 0);
ok('fail-then-success -> single failure record', res.vocab.cat.lastResult === 'failure');
ok('fail-then-success -> interval 1 (not doubled)', res.vocab.cat.interval === 1);

// Two DIFFERENT items in one session: one success, one failure.
res = runFinalize({ vocab: {} }, [
  { type: 'vocab', key: 'cat', firstAttempt: true },
  { type: 'vocab', key: 'dog', firstAttempt: false },
], 0);
ok('mixed session: cat success interval 2', res.vocab.cat.interval === 2 && res.vocab.cat.lastResult === 'success');
ok('mixed session: dog failure interval 1', res.vocab.dog.interval === 1 && res.vocab.dog.lastResult === 'failure');

// sessionCount bumped exactly once per finalizeSession call.
ok('sessionCount incremented once', sandbox.authActiveUser.sessionCount === 1);

// ---- selection: this-session success is EXCLUDED (bug B) ----

// Re-run selection through getGameItemSR-style priority: build a tiny srState
// where 'cat' already succeeded THIS session and assert it is not re-selected.
// We exercise getSRPriority directly (the function the selectors use).
const { getSRPriority } = sandbox;
const successes = new Set(['cat']);
const fails = new Set();
// 'cat' success this session -> group 5; but selection now EXCLUDES group 5.
// Verify getSRPriority still tags it 5, and that the pool filter drops it.
ok('success-this-session -> group 5 priority', getSRPriority('cat', {}, 0, fails, successes).group === 5);
ok('failure-this-session -> group 0 priority', getSRPriority('dog', {}, 0, new Set(['dog']), null).group === 0);

// Simulate sortPoolBySR filtering: a success-this-session item must be dropped.
const { sortPoolBySR } = sandbox;
const pool = [
  { item: 'cat', key: 'cat', pageAbsIndex: 0 },
  { item: 'dog', key: 'dog', pageAbsIndex: 0 },
];
const sorted = sortPoolBySR(pool, {}, 0, 0, fails, successes);
ok('this-session success excluded from selection', !sorted.some(e => e.key === 'cat'));
ok('other items still selectable', sorted.some(e => e.key === 'dog'));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
