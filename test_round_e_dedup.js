// Unit test for Round E (study mode sentence matching) sub-round pair selection.
//
// Rules under test (user spec):
//   1. SR due-status ALWAYS wins first — a due/failed pair on ANY page is picked
//      before new material, regardless of sub-round.
//   2. For NEW items only (nothing due):
//        - E1 favors the CURRENT page.
//        - E2/E3 AVOID the current page and review a PREVIOUS page, weighted by
//          proximity (closer = higher chance). Falls back to current page only
//          when no previous page has unseen pairs (first-page student).
//   3. A pair is never repeated within one Round E session.
//
// We load sr_engine.js + teaching_content.js in a VM with a small fixture and
// drive the sub-rounds exactly as nextRoundESubRound does.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
let src =
  fs.readFileSync(path.join(root, 'sr_engine.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'teaching_content.js'), 'utf8');

// teaching_content.js declares `const TEACHING_CONTENT` / `const AVAILABLE_CONTENT`.
// Populate them via appended in-scope code (vm const isn't reachable from outside).
// Book has 3 pages, each with several distinct pairs. Student is on page p3.
src += `
TEACHING_CONTENT.test = {
  u0: {
    p1: {
      vocab: ['a'], sentences: ['s.'],
      sentencePairs: [
        { a: 'p1q1', b: 'p1a1' }, { a: 'p1q2', b: 'p1a2' },
        { a: 'p1q3', b: 'p1a3' }, { a: 'p1q4', b: 'p1a4' },
      ],
    },
    p2: {
      vocab: ['b'], sentences: ['s.'],
      sentencePairs: [
        { a: 'p2q1', b: 'p2a1' }, { a: 'p2q2', b: 'p2a2' },
        { a: 'p2q3', b: 'p2a3' }, { a: 'p2q4', b: 'p2a4' },
      ],
    },
    p3: {
      vocab: ['c'], sentences: ['s.'],
      sentencePairs: [
        { a: 'p3q1', b: 'p3a1' }, { a: 'p3q2', b: 'p3a2' },
        { a: 'p3q3', b: 'p3a3' }, { a: 'p3q4', b: 'p3a4' },
      ],
    },
  },
};
AVAILABLE_CONTENT.test = { u0: ['p1', 'p2', 'p3'] };
`;

const sandbox = {
  console,
  API_BASE_URL: '',
  document: { addEventListener: () => {} },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  isTestMode: false,
  getCurrentSession: () => 5,   // current session index
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
// teaching_content.js declares `var authActiveUser = null` (attaches to context),
// so set it AFTER running via in-context assignment.
vm.runInContext(`authActiveUser = { srState: { vocab: {}, sentences: {}, sentencePairs: {} } };`, sandbox);

const { getStudySentencePairsSubRoundSR, itemKey } = sandbox;
sandbox.selectedClassContent = { book: 'test', unit: 'u0', page: 'p3' };

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS:', name); }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}
function keyOf(a, b) { return itemKey({ a, b }); }

// Helper: reset SR state on the in-context user object.
function setSR(state) { sandbox.authActiveUser.srState.sentencePairs = state || {}; }

// ---------------------------------------------------------------------------
// Rule 1: a DUE pair on a previous page wins even for E1 (preferPrevious=false).
// Mark p1q1 as due (dueAfterSession <= currentSession, lastResult failure => group 1).
setSR({ [keyOf('p1q1', 'p1a1')]: { interval: 1, dueAfterSession: 5, lastSession: 4, lastResult: 'failure' } });
const due = getStudySentencePairsSubRoundSR('test', 'u0', 'p3', new Set(), false);
ok('Rule1: due pair on previous page wins E1',
  due && due.pairs.some(p => itemKey(p) === keyOf('p1q1', 'p1a1')), due && due.pairs.map(itemKey));

// ---------------------------------------------------------------------------
// Rule 2: NEW items only (empty SR state).
setSR({});

// E1 (preferPrevious=false) -> CURRENT page is PRIORITIZED (weighted, not guaranteed).
// Over 20k trials the current page wins ~90%; use 1000 trials + 85% threshold
// (proves "prioritizes" while tolerating normal sampling variance).
let e1Current = 0, e1Trials = 1000;
for (let i = 0; i < e1Trials; i++) {
  const r = getStudySentencePairsSubRoundSR('test', 'u0', 'p3', new Set(), false);
  if (r && r.pairs.every(p => itemKey(p).startsWith('p3'))) e1Current++;
}
ok('Rule2: E1 (new items) PRIORITIZES the current page (>=85% of trials)',
  e1Current >= e1Trials * 0.85, { e1Current, e1Trials });

// E2/E3 (preferPrevious=true) -> a PREVIOUS page (p1 or p2), never p3.
// Run many times to confirm it NEVER returns the current page for new items.
let e2CurrentPageHits = 0, e2PrevHits = 0;
const closerWins = { p2: 0, p1: 0 };
for (let i = 0; i < 200; i++) {
  const r = getStudySentencePairsSubRoundSR('test', 'u0', 'p3', new Set(), true);
  if (!r) continue;
  const prefix = itemKey(r.pairs[0]).slice(0, 2);
  if (prefix === 'p3') e2CurrentPageHits++;
  else { e2PrevHits++; if (prefix === 'p2') closerWins.p2++; if (prefix === 'p1') closerWins.p1++; }
}
ok('Rule2: E2/E3 (new items) NEVER pick the current page', e2CurrentPageHits === 0, { e2CurrentPageHits });
ok('Rule2: E2/E3 pick a previous page', e2PrevHits > 0, { e2PrevHits });
ok('Rule2: closer previous page (p2) picked more often than farther (p1)',
  closerWins.p2 > closerWins.p1, closerWins);

// ---------------------------------------------------------------------------
// Rule 2 fallback: first-page student (page p1, no previous pages).
// E2/E3 with preferPrevious=true must fall back to the current page.
sandbox.selectedClassContent = { book: 'test', unit: 'u0', page: 'p1' };
setSR({});
const fb = getStudySentencePairsSubRoundSR('test', 'u0', 'p1', new Set(), true);
ok('Rule2 fallback: first-page E2 falls back to current page (p1)',
  fb && fb.pairs.every(p => itemKey(p).startsWith('p1')), fb && fb.pairs.map(itemKey));

// ---------------------------------------------------------------------------
// Rule 3: no pair repeats across sub-rounds. Drive 3 sub-rounds on p3.
sandbox.selectedClassContent = { book: 'test', unit: 'u0', page: 'p3' };
setSR({});
const used = new Set();
const rounds = [];
for (let i = 0; i < 3; i++) {
  const r = getStudySentencePairsSubRoundSR('test', 'u0', 'p3', used, i > 0);
  if (!r || r.pairs.length === 0) break;
  r.pairs.forEach(p => used.add(itemKey(p)));
  rounds.push(r.pairs.map(itemKey));
}
const flat = rounds.flat();
ok('Rule3: no pair repeats across E1/E2/E3', new Set(flat).size === flat.length, { flat });
ok('Rule3: E1 was current page, later rounds reviewed previous pages',
  rounds.length >= 2 && rounds[0].every(k => k.startsWith('p3')) &&
  rounds[1].every(k => !k.startsWith('p3')), rounds);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
