// Unit test for Round E (study mode sentence matching) sub-round pair uniqueness.
//
// Bug under test: a student on the FIRST page of a book got the SAME 3 sentence
// pairs in E1, E2 and E3 (the SR picker excluded the only page as "used", the
// fallback re-used it, so nothing changed). This made E2/E3 trivially skippable.
//
// Fix: getStudySentencePairsSubRoundSR now excludes already-SHOWN pairs (not just
// used pages) and returns null when no unseen pairs remain, so nextRoundESubRound
// ends Round E cleanly instead of repeating.
//
// We load sr_engine.js + teaching_content.js in a VM with a tiny TEACHING_CONTENT
// fixture (one book, one page, only 3 pairs) and drive 3 sub-rounds as the real
// UI would, asserting pairs never repeat and the picker returns null on the 2nd call.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
let src =
  fs.readFileSync(path.join(root, 'sr_engine.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'teaching_content.js'), 'utf8');

// teaching_content.js declares `const TEACHING_CONTENT` / `const AVAILABLE_CONTENT`.
// In a vm context, top-level `const` is NOT exposed on the sandbox object, so we
// can't mutate it from outside. Instead we append fixture-population code INTO the
// script string (it runs in the same scope where those consts are visible).
src += `
TEACHING_CONTENT.test = {
  u0: {
    p1: {
      vocab: ['apple', 'banana'],
      sentences: ['I like apples.', 'Bananas are yellow.'],
      sentencePairs: [
        { a: 'I think Chinese', b: 'is more difficult than English.' },
        { a: 'Bears are', b: 'more dangerous than rabbits.' },
        { a: 'I think doing homework is', b: 'more boring than playing games.' },
      ],
    },
  },
};
AVAILABLE_CONTENT.test = { u0: ['p1'] };
__fixtureReady = true;
`;

// Minimal browser-ish stubs.
const sandbox = {
  console,
  API_BASE_URL: '',
  document: { addEventListener: () => {} },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  authActiveUser: { srState: { vocab: {}, sentences: {}, sentencePairs: {} } },
  isTestMode: false,
  __fixtureReady: false,
  // current session index used by the SR engine
  getCurrentSession: () => 0,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const { getStudySentencePairsSubRoundSR, itemKey } = sandbox;
// teaching_content defines selectedClassContent via globals; set it so the
// function's fallback (unused now) would have context.
sandbox.selectedClassContent = { book: 'test', unit: 'u0', page: 'p1' };

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS:', name); }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const usedPages = new Set();
const usedPairs = new Set();

// Sub-round 1: should return the 3 pairs (whole page fits in one sub-round).
const r1 = getStudySentencePairsSubRoundSR('test', 'u0', 'p1', usedPages, usedPairs);
ok('E1: returns 3 pairs from the only page', r1 && r1.pairs.length === 3, r1);
const e1Keys = (r1 ? r1.pairs : []).map(p => itemKey(p)).sort();
ok('E1: exactly the 3 expected pairs',
  e1Keys.length === 3 &&
  e1Keys.includes(itemKey({ a: 'I think Chinese', b: 'is more difficult than English.' })) &&
  e1Keys.includes(itemKey({ a: 'Bears are', b: 'more dangerous than rabbits.' })) &&
  e1Keys.includes(itemKey({ a: 'I think doing homework is', b: 'more boring than playing games.' })));

// Simulate the UI recording the shown pairs + page.
if (r1) { r1.pairs.forEach(p => usedPairs.add(itemKey(p))); usedPages.add(r1.pageAbsIndex); }

// Sub-round 2: only page is used AND all its pairs are used -> must return null
// (so the UI ends Round E instead of repeating).
const r2 = getStudySentencePairsSubRoundSR('test', 'u0', 'p1', usedPages, usedPairs);
ok('E2: returns null (no unseen pairs remain) -> Round E ends, no repeat', r2 === null, r2);

// Sub-round 3: still null.
const r3 = getStudySentencePairsSubRoundSR('test', 'u0', 'p1', usedPages, usedPairs);
ok('E3: still null', r3 === null, r3);

// --- Control: a 2-page book with 6 distinct pairs should yield 2 distinct sub-rounds ---
// Mutate the in-scope consts via a second runInContext (same context, same scope).
vm.runInContext(`
TEACHING_CONTENT.test.u0.p2 = {
  vocab: ['cat'],
  sentences: ['Cats meow.'],
  sentencePairs: [
    { a: 'The sky is', b: 'blue.' },
    { a: 'Water is', b: 'wet.' },
    { a: 'Snow is', b: 'cold.' },
  ],
};
AVAILABLE_CONTENT.test.u0.push('p2');
`, sandbox);
const usedPages2 = new Set();
const usedPairs2 = new Set();
const a = getStudySentencePairsSubRoundSR('test', 'u0', 'p2', usedPages2, usedPairs2);
if (a) { a.pairs.forEach(p => usedPairs2.add(itemKey(p))); usedPages2.add(a.pageAbsIndex); }
const b = getStudySentencePairsSubRoundSR('test', 'u0', 'p2', usedPages2, usedPairs2);
if (b) { b.pairs.forEach(p => usedPairs2.add(itemKey(p))); usedPages2.add(b.pageAbsIndex); }

ok('multi-page E1 non-empty', a && a.pairs.length > 0, a);
ok('multi-page E2 non-empty', b && b.pairs.length > 0, b);
if (a && b) {
  const ka = a.pairs.map(p => itemKey(p)).sort();
  const kb = b.pairs.map(p => itemKey(p)).sort();
  const overlap = ka.filter(k => kb.includes(k));
  ok('multi-page E1 and E2 share NO pair keys', overlap.length === 0, { overlap });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
