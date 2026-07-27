// Unit tests for the "SR state is written ONCE per session at the first check"
// invariant (spelling/grammar/sentenceMatch + study, shared engine).
//
// Rules under test (from the user's spec):
//   A. fail once this session  -> item reprompted until success; on success-after-
//      fail it is NOT reprompted again; SR interval reset to 1.
//   B. first-attempt success   -> item NOT reprompted while other material
//      exists (group 5 sorts LAST as an absolute fallback — never an empty pick).
//   Failure interval is 1 (due next session) even if the game ends before the
//   student succeeds — except leeches (4+ lifetime lapses), which get interval 2.
//   Success after a lapse resumes at half the pre-failure interval (soft reset).
//   1 in 5 picked items is reserved for NEW (never-seen) material.
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

// ---- selection: this-session success sorts LAST (absolute fallback) ----

// Re-run selection through getGameItemSR-style priority: build a tiny srState
// where 'cat' already succeeded THIS session and assert it only surfaces when
// nothing else remains.
const { getSRPriority } = sandbox;
const successes = new Set(['cat']);
const fails = new Set();
// 'cat' success this session -> group 5; selection keeps group 5 LAST as an
// absolute fallback (never served while other material exists).
ok('success-this-session -> group 5 priority', getSRPriority('cat', {}, 0, fails, successes).group === 5);
ok('failure-this-session -> group 0 priority', getSRPriority('dog', {}, 0, new Set(['dog']), null).group === 0);

// Simulate sortPoolBySR ordering: a success-this-session item must sort last.
const { sortPoolBySR, selectItemsSR } = sandbox;
const pool = [
  { item: 'cat', key: 'cat', pageAbsIndex: 0 },
  { item: 'dog', key: 'dog', pageAbsIndex: 0 },
];
const sorted = sortPoolBySR(pool, {}, 0, 0, fails, successes);
ok('this-session success sorts last (fallback only)', sorted.length === 2 && sorted[1].key === 'cat');
ok('other items still selectable first', sorted[0].key === 'dog');
const fbOnly = selectItemsSR([{ item: 'cat', key: 'cat', pageAbsIndex: 0 }], 1, {}, 0, 0, fails, successes);
ok('group-5 absolute fallback: sole succeeded item still served', fbOnly.length === 1 && fbOnly[0] === 'cat');

// ---- leech guard + soft reset ----

// 4th lifetime lapse -> leech: due every 2 sessions instead of every session.
s = updateSRStateForSession(
  { vocab: { cat: { interval: 1, dueAfterSession: 4, lastSession: 3, lastResult: 'failure', lapses: 3, priorInterval: 8 } } },
  [{ type: 'vocab', key: 'cat', firstAttempt: false }], 4);
ok('leech (4th lapse) -> interval 2', s.vocab.cat.interval === 2 && s.vocab.cat.lapses === 4);

// Failure preserves the pre-failure interval for the soft reset.
s = updateSRStateForSession(
  { vocab: { cat: { interval: 8, dueAfterSession: 14, lastSession: 6, lastResult: 'success' } } },
  [{ type: 'vocab', key: 'cat', firstAttempt: false }], 14);
ok('failure preserves priorInterval', s.vocab.cat.priorInterval === 8 && s.vocab.cat.interval === 1);

// Success after the lapse resumes at half the prior interval, not back at 2.
s = updateSRStateForSession(s, [{ type: 'vocab', key: 'cat', firstAttempt: true }], 15);
ok('soft reset: success after lapse resumes at priorInterval/2', s.vocab.cat.interval === 4);

// ---- new-content quota (1 in 5) ----

// 10 due review items + 5 unseen items, pick 5 -> exactly 4 review + 1 new
// (count=5 makes the quota deterministic: floor(5*0.2)=1, no fractional part).
const quotaState = {};
const quotaPool = [];
for (let i = 0; i < 10; i++) {
  quotaState['r' + i] = { interval: 1, dueAfterSession: 0, lastSession: 0, lastResult: 'failure' };
  quotaPool.push({ item: 'r' + i, key: 'r' + i, pageAbsIndex: 0 });
}
for (let i = 0; i < 5; i++) quotaPool.push({ item: 'n' + i, key: 'n' + i, pageAbsIndex: 0 });
const qPick = selectItemsSR(quotaPool, 5, quotaState, 5, 0);
const qNew = qPick.filter(k => k.startsWith('n')).length;
ok('quota: 5-item pick reserves exactly 1 slot for NEW content', qPick.length === 5 && qNew === 1);

// ---- avoidKey: no back-to-back repeat ----

const aPick = selectItemsSR(quotaPool, 1, quotaState, 5, 0, null, null, 'r3');
ok('avoidKey: last-served item skipped when alternatives exist', aPick.length === 1 && aPick[0] !== 'r3');
const aOnly = selectItemsSR([{ item: 'r3', key: 'r3', pageAbsIndex: 0 }], 1, quotaState, 5, 0, null, null, 'r3');
ok('avoidKey: sole remaining item still served', aOnly.length === 1 && aOnly[0] === 'r3');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
