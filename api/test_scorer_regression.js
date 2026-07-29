/* test_scorer_regression.js — regression suite for speech_scorer.js against
 * real field transcripts (2026-07-27 dataset). Run: node test_scorer_regression.js
 * Exit 0 = all cases pass. Keep MUST_FAIL cases when retuning thresholds. */
global.window = global;
require('../speech_scorer.js');
const S = global.Scorer;

// [target, transcript, expectedPass, why]
const CASES = [
    // must-pass: genuinely good readings the old fixed-edit-cap scorer rejected
    ['You must wear a helmet and knee pads when you go skating.', 'You must work on helmet and knee pads when you go skate', true, 'long sentence, 2 small word errors'],
    ['Do you have to vacuum the floor everyday?', 'Do you have to became the floor every day?', true, 'one garbled word in 8'],
    ["What time is the break? It's at half past ten.", "Good time is a break, it's a half past 10.", true, 'accent + digit rendering'],
    ['There is a bin on the laptop screen.', 'There is a bean on the laptop.', true, 'bin/bean L1 confusion'],
    ["They aren't my brothers.", 'The Aunt My Brothers', true, 'phonetically close short sentence'],
    // must-fail: wrong content / hallucinations must never pass
    ['The kite is a triangle.', 'The guide is a rectangle.', false, 'wrong shape words (template frame match)'],
    ['The zoo is opposite the park.', '[BLANK_AUDIO]', false, 'Whisper silence hallucination'],
    ["It's got long ears.", 'Bye!', false, 'noise hallucination'],
    ['The parrot is near the cage.', 'The pair is near the king.', false, 'both content words wrong'],
    ['It slept in the garden.', 'He flapped in the garden.', false, 'wrong verb'],
    ['', '', false, 'empty target must not pass']
];

const d = require('./speech_events_dump_full.json');
let fieldPass = 0;
for (const a of d.attempts) if (S.score(a.target, a.transcript, 2).pass) fieldPass++;
console.log('Field replay (272 attempts of 2026-07-27): ' + fieldPass + ' pass (' +
    Math.round(100 * fieldPass / d.attempts.length) + '% — was 18% under the old scorer)');

let ok = true;
for (const [t, g, want, why] of CASES) {
    const r = S.score(t, g, 2);
    const good = r.pass === want;
    if (!good) ok = false;
    console.log((good ? 'OK    ' : 'WRONG ') + 'pass=' + r.pass + ' want=' + want +
        '  [' + why + ']  heard:"' + g.slice(0, 45) + '"');
}

// ---- Book-tier leniency ladder --------------------------------------------
console.log('\n--- BOOK TIERS ---');

// Anchor equivalence: PU3/Think1 must behave exactly like the tuned level 2.
for (const [t, g, want] of CASES) {
    for (const book of ['PU3', 'Think1']) {
        const r = S.scoreForBook(t, g, book);
        if (r.pass !== want) {
            ok = false;
            console.log('WRONG anchor mismatch [' + book + '] pass=' + r.pass + ' want=' + want + '  heard:"' + g.slice(0, 40) + '"');
        }
    }
}
console.log('OK    PU3/Think1 anchor matches level-2 verdict on all ' + CASES.length + ' cases');

// Gibberish must fail at EVERY tier, including the most lenient (PU0/PU1).
const GIBBERISH = [
    ['The zoo is opposite the park.', '[BLANK_AUDIO]'],
    ["It's got long ears.", 'Bye!'],
    ['Fred went to the shop.', 'me?'],
    ['The dolphins are cleverer than a lot of animals.', '[Music]']
];
for (const book of ['PU0', 'PU1', 'PU2', 'Think0', 'PU3', 'Think1', 'PU4', 'Think2']) {
    for (const [t, g] of GIBBERISH) {
        const r = S.scoreForBook(t, g, book);
        if (r.pass) { ok = false; console.log('WRONG gibberish passed at ' + book + ': "' + g + '"'); }
    }
}
console.log('OK    gibberish fails at every tier (incl. PU0/PU1)');

// Ladder ordering on real field pairs: lenient passes, strict rejects.
const jojo = ['She wants a big purple teddy.', 'same what a big purple taking.']; // acc ~0.66
checkTier(jojo, 'PU1', true, 'Jojo-style near-miss passes at PU1');
checkTier(jojo, 'Think2', false, 'Jojo-style near-miss fails at Think2');
const helmet = ['You must wear a helmet and knee pads when you go skating.', 'You must work on helmet and knee pads when you go skate']; // acc 0.86
checkTier(helmet, 'Think2', true, 'helmet sentence (acc .86) passes even at Think2');
function checkTier(pair, book, want, why) {
    const r = S.scoreForBook(pair[0], pair[1], book);
    const good = r.pass === want;
    if (!good) ok = false;
    console.log((good ? 'OK    ' : 'WRONG ') + why + ' (pass=' + r.pass + ')');
}

// Unknown / missing book falls back to the anchor tier.
const fb1 = S.scoreForBook(jojo[0], jojo[1], undefined);
const fb2 = S.scoreForBook(jojo[0], jojo[1], 'SomeFutureBook');
const anchor = S.scoreForBook(jojo[0], jojo[1], 'PU3');
if (fb1.pass !== anchor.pass || fb2.pass !== anchor.pass) { ok = false; console.log('WRONG unknown-book fallback != anchor'); }
else console.log('OK    unknown/missing book falls back to PU3 anchor');

// Field replay ladder: pass rate must be monotonically non-increasing from
// most lenient tier to strictest.
console.log('\n--- FIELD REPLAY LADDER (272 attempts of 2026-07-27) ---');
const LADDER = ['PU0', 'PU1', 'PU2', 'Think0', 'PU3', 'PU4', 'Think2'];
let prev = Infinity;
for (const book of LADDER) {
    let p = 0;
    for (const a of d.attempts) if (S.scoreForBook(a.target, a.transcript, book).pass) p++;
    const mono = p <= prev;
    if (!mono) ok = false;
    console.log((mono ? 'OK    ' : 'WRONG ') + book + ': ' + p + '/' + d.attempts.length + ' (' + Math.round(100 * p / d.attempts.length) + '%)');
    prev = p;
}

console.log(ok ? '\nALL REGRESSION CASES PASS' : '\nREGRESSIONS REMAIN');
process.exit(ok ? 0 : 1);
