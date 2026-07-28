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
console.log(ok ? '\nALL REGRESSION CASES PASS' : '\nREGRESSIONS REMAIN');
process.exit(ok ? 0 : 1);
