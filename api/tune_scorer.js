/* tune_scorer.js — parameter sweep for the variant-D scorer against real field
 * data, constrained by must-pass / must-fail regression cases. */
global.window = global;
require('../speech_scorer.js');
const S = global.Scorer;
const d = require('./speech_events_dump_full.json');

const norm = S.normalize;
const lev = S.levenshtein;
function charAcc(t, g) { t = norm(t); g = norm(g); if (!t || !g) return 0; return Math.max(0, 1 - lev(t, g) / Math.max(t.length, g.length, 1)); }
function phonRatio(t, g) {
    const tt = norm(t).split(' ').filter(Boolean), gt = norm(g).split(' ').filter(Boolean);
    if (!tt.length || !gt.length) return 0;
    let hits = 0;
    for (const tw of tt) if (gt.some(gw => S.phoneticMatch(tw, gw))) hits++;
    return hits / tt.length;
}
function wer(t, g) {
    const tt = norm(t).split(' ').filter(Boolean), gt = norm(g).split(' ').filter(Boolean);
    if (!tt.length) return 1;
    return lev(tt, gt) / tt.length;
}
function isHallu(t) {
    const x = (t || '').trim();
    if (!x) return true;
    return /^\[.*\]$/.test(x) || /^\(.*\)$/.test(x) || /^(you|bye!?|thank you\.?|thanks for watching!?|\.)$/i.test(x);
}

// must-pass: genuinely good readings the old scorer rejected
const MUST_PASS = [
    ['You must wear a helmet and knee pads when you go skating.', 'You must work on helmet and knee pads when you go skate'],
    ["They aren't my brothers.", 'The Aunt My Brothers'],
    ['Do you have to vacuum the floor everyday?', 'Do you have to became the floor every day?'],
    ['What time is the break? It\'s at half past ten.', 'Good time is a break, it\'s a half past 10.'],
    ['There is a bin on the laptop screen.', 'There is a bean on the laptop.']
];
// must-fail: wrong content or garbage that must never earn a pass
const MUST_FAIL = [
    ['The kite is a triangle.', 'The guide is a rectangle.'],
    ['The zoo is opposite the park.', '[BLANK_AUDIO]'],
    ["It's got long ears.", 'Bye!'],
    ["Grandpa's farm is in the countryside.", 'Gwen Halfbaum is in the countryside.'],
    ['The parrot is near the cage.', 'The pair is near the king.'],
    ['It slept in the garden.', 'He flapped in the garden.']
];

function rule(minAcc, maxWER, phonPass) {
    return (t, g) => charAcc(t, g) >= minAcc || wer(t, g) <= maxWER || phonRatio(t, g) >= phonPass;
}

console.log(pad('minAcc', 8) + pad('maxWER', 8) + pad('phon', 6) + pad('mustPass', 10) + pad('mustFail', 10) + pad('all', 12) + 'realSpeech');
function pad(s, w) { s = String(s); return s.length >= w ? s : s + ' '.repeat(w - s.length); }
const nonHallu = d.attempts.filter(a => !isHallu(a.transcript));
const results = [];
for (const minAcc of [0.70, 0.72, 0.75, 0.78, 0.80]) {
    for (const maxWER of [0.25, 0.30, 0.34, 0.40]) {
        for (const phonPass of [0.70, 0.75, 0.80]) {
            const fn = rule(minAcc, maxWER, phonPass);
            const mp = MUST_PASS.filter(([t, g]) => fn(t, g)).length;
            const mf = MUST_FAIL.filter(([t, g]) => !fn(t, g)).length;
            let all = 0, real = 0;
            for (const a of d.attempts) {
                if (fn(a.target, a.transcript)) { all++; if (!isHallu(a.transcript)) real++; }
            }
            results.push({ minAcc, maxWER, phonPass, mp, mf, all, real });
        }
    }
}
// show only configs satisfying ALL regression constraints, sorted by pass yield
const good = results.filter(r => r.mp === MUST_PASS.length && r.mf === MUST_FAIL.length);
for (const r of good.sort((a, b) => b.real - a.real)) {
    console.log(pad(r.minAcc, 8) + pad(r.maxWER, 8) + pad(r.phonPass, 6) + pad(r.mp + '/' + MUST_PASS.length, 10) + pad(r.mf + '/' + MUST_FAIL.length, 10) + pad(r.all + '/272 (' + (100 * r.all / 272).toFixed(0) + '%)', 12) + r.real + '/' + nonHallu.length + ' (' + (100 * r.real / nonHallu.length).toFixed(0) + '%)');
}
if (!good.length) {
    console.log('NO config satisfies all constraints. Best mustFail performers:');
    for (const r of results.sort((a, b) => (b.mp + b.mf) - (a.mp + a.mf)).slice(0, 8)) {
        console.log(JSON.stringify(r));
    }
}
