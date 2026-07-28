/* whatif_scorer.js — replay all real attempts under alternative scoring rules
 * to find where the ceiling is WITHOUT touching the model. */
const d = require('./speech_events_dump_full.json');
const A = d.attempts;

function norm(s) { return (s || '').toLowerCase().replace(/[.,!?;:'"()\-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[m][n];
}
function charAcc(t, g) { if (!t || !g) return 0; return Math.max(0, 1 - lev(t, g) / Math.max(t.length, g.length, 1)); }
// token-level WER: word edits / target words
function wer(tTok, gTok) {
    if (!tTok.length) return 1;
    return lev(tTok, gTok) / tTok.length; // lev works on arrays too (=== compare)
}
function levTok(a, b) { // levenshtein over token arrays
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[m][n];
}
function phonMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return lev(a, b) / Math.max(a.length, b.length, 1) <= 1 / 3;
}
function phonRatio(tTok, gTok) {
    if (!tTok.length || !gTok.length) return 0;
    let hits = 0;
    for (const tw of tTok) if (gTok.some(gw => phonMatch(tw, gw))) hits++;
    return hits / tTok.length;
}
function isHallu(t) {
    const x = (t || '').trim();
    if (!x) return true;
    return /^\[.*\]$/.test(x) || /^\(.*\)$/.test(x) || /^(you|bye!?|thank you\.?|thanks for watching!?|\.)$/i.test(x);
}

const variants = {
    'CURRENT level2 (acc>=.65 AND edits<=2) OR phon>=.8': (t, g) => {
        const tt = t.split(' '), gt = g.split(' ');
        return (charAcc(t, g) >= 0.65 && levTok(tt, gt) <= 2) || phonRatio(tt, gt) >= 0.8;
    },
    'A: acc>=.65 alone (drop edit cap)': (t, g) => charAcc(t, g) >= 0.65 || phonRatio(t.split(' '), g.split(' ')) >= 0.8,
    'B: acc>=.60 alone': (t, g) => charAcc(t, g) >= 0.60 || phonRatio(t.split(' '), g.split(' ')) >= 0.8,
    'C: WER<=.4 (edits scale with length)': (t, g) => {
        const tt = t.split(' '), gt = g.split(' ');
        return levTok(tt, gt) / Math.max(tt.length, 1) <= 0.4 || phonRatio(tt, gt) >= 0.8;
    },
    'D: acc>=.65 OR WER<=.4 OR phon>=.7': (t, g) => {
        const tt = t.split(' '), gt = g.split(' ');
        return charAcc(t, g) >= 0.65 || levTok(tt, gt) / Math.max(tt.length, 1) <= 0.4 || phonRatio(tt, gt) >= 0.7;
    },
    'E: (D) + phon>=.6': (t, g) => {
        const tt = t.split(' '), gt = g.split(' ');
        return charAcc(t, g) >= 0.65 || levTok(tt, gt) / Math.max(tt.length, 1) <= 0.4 || phonRatio(tt, gt) >= 0.6;
    }
};

console.log('Total attempts: ' + A.length);
const nonHallu = A.filter(a => !isHallu(a.transcript));
console.log('Attempts with REAL speech heard (non-hallucination): ' + nonHallu.length);
console.log();
console.log('Pass rates under each rule (all attempts | real-speech attempts only):');
for (const [name, fn] of Object.entries(variants)) {
    let all = 0, real = 0;
    for (const a of A) {
        const t = norm(a.target), g = norm(a.transcript);
        const p = t && g && fn(t, g);
        if (p) { all++; if (!isHallu(a.transcript)) real++; }
    }
    console.log('  ' + name);
    console.log('      all: ' + all + '/' + A.length + ' (' + (100 * all / A.length).toFixed(0) + '%)   real-speech: ' + real + '/' + nonHallu.length + ' (' + (100 * real / nonHallu.length).toFixed(0) + '%)');
}

// sentence-level (did student EVER pass) under variant D
console.log();
for (const vn of ['CURRENT level2 (acc>=.65 AND edits<=2) OR phon>=.8', 'D: acc>=.65 OR WER<=.4 OR phon>=.7']) {
    const fn = variants[vn];
    const gates = new Map();
    for (const a of A) {
        const k = a.student + '||' + a.target;
        const t = norm(a.target), g = norm(a.transcript);
        const p = !!(t && g && fn(t, g));
        gates.set(k, (gates.get(k) || false) || p);
    }
    const passed = [...gates.values()].filter(Boolean).length;
    console.log('Sentence-level under [' + vn + ']: ' + passed + '/' + gates.size + ' (' + (100 * passed / gates.size).toFixed(0) + '%)');
}
