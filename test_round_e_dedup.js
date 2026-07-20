// Unit test for Round E (study mode sentence matching) sub-round pair selection.
//
// Bug under test: a student on the FIRST page of a book got the SAME 3 sentence
// pairs pre-filled green in E1, E2 and E3, so E2/E3 were trivially skippable.
// Root cause: the picker locked out the whole page after E1, so later sub-rounds
// had nothing new and either repeated or (after the first fix) got skipped.
//
// Fix: getStudySentencePairsSubRoundSR excludes only the individual pairs already
// SHOWN (not the whole page). A page with >3 pairs keeps feeding FRESH pairs to
// E2/E3, so all three sub-rounds run with distinct pairs. Only when there are
// genuinely no unseen pairs left does it return null (UI ends Round E cleanly).
//
// We load sr_engine.js + teaching_content.js in a VM with a small TEACHING_CONTENT
// fixture and drive the 3 sub-rounds exactly as nextRoundESubRound would.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
let src =
  fs.readFileSync(path.join(root, 'sr_engine.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'teaching_content.js'), 'utf8');

// teaching_content.js declares `const TEACHING_CONTENT` / `const AVAILABLE_CONTENT`.
// In a vm context, top-level `const` is NOT exposed on the sandbox object, so we
// append fixture-population code INTO the script string (runs in the same scope).
// First page has 9 distinct pairs -> enough for 3 sub-rounds of 3 each.
src += `
TEACHING_CONTENT.test = {
  u0: {
    p1: {
      vocab: ['apple'],
      sentences: ['x.'],
      sentencePairs: [
        { a: 'q1', b: 'a1' }, { a: 'q2', b: 'a2' }, { a: 'q3', b: 'a3' },
        { a: 'q4', b: 'a4' }, { a: 'q5', b: 'a5' }, { a: 'q6', b: 'a6' },
        { a: 'q7', b: 'a7' }, { a: 'q8', b: 'a8' }, { a: 'q9', b: 'a9' },
      ],
    },
    p2: {
      vocab: ['cat'],
      sentences: ['y.'],
      sentencePairs: [
        { a: 'only1', b: 'oa1' }, { a: 'only2', b: 'oa2' }, { a: 'only3', b: 'oa3' },
      ],
    },
  },
};
AVAILABLE_CONTENT.test = { u0: ['p1', 'p2'] };
`;

const sandbox = {
  console,
  API_BASE_URL: '',
  document: { addEventListener: () => {} },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  authActiveUser: { srState: { vocab: {}, sentences: {}, sentencePairs: {} } },
  isTestMode: false,
  getCurrentSession: () => 0,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const { getStudySentencePairsSubRoundSR, itemKey } = sandbox;
sandbox.selectedClassContent = { book: 'test', unit: 'u0', page: 'p1' };

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS:', name); }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

// Drive Round E exactly like nextRoundESubRound: keep a usedPairKeys set, record
// each shown pair, expect a fresh set each sub-round.
function driveRoundE(book, unit, page, maxSubRounds) {
  const usedPairs = new Set();
  const rounds = [];
  for (let i = 0; i < maxSubRounds; i++) {
    const res = getStudySentencePairsSubRoundSR(book, unit, page, usedPairs);
    if (!res || !res.pairs || res.pairs.length === 0) break;  // UI ends Round E
    res.pairs.forEach(p => usedPairs.add(itemKey(p)));
    rounds.push(res.pairs.map(p => itemKey(p)));
  }
  return rounds;
}

// --- Main scenario: first page, 9 pairs -> E1/E2/E3 all run, all distinct ---
const rounds = driveRoundE('test', 'u0', 'p1', 3);
ok('first page (9 pairs): all 3 sub-rounds run (no skip)', rounds.length === 3, { got: rounds.length });
ok('each sub-round has 3 pairs', rounds.every(r => r.length === 3), rounds);
const allShown = rounds.flat();
ok('no pair repeats across E1/E2/E3', new Set(allShown).size === allShown.length, { allShown });

// --- Edge case: page with only 3 pairs -> E1 runs, then Round E ends (no fake E2/E3) ---
const rounds2 = driveRoundE('test', 'u0', 'p2', 3);
ok('3-pair page: E1 runs', rounds2.length >= 1 && rounds2[0].length === 3, rounds2);
ok('3-pair page: no repeated pairs (ends after unseen exhausted)',
  (() => { const f = rounds2.flat(); return new Set(f).size === f.length; })(), rounds2);
// p2's own 3 pairs get consumed; any further sub-rounds must NOT repeat them.
// (There are no earlier pages beyond p1; p1's pairs are also eligible as review,
//  so rounds2 may legitimately pull p1 pairs for E2/E3 — the key invariant is
//  simply "never repeat a pair", already asserted above.)

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
