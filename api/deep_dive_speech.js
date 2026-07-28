/* deep_dive_speech.js — one-off deep analysis of speech_events_dump_full.json
 * Cuts the summary report doesn't show: hallucination-vs-real-fail per student,
 * permission errors per student, transcript samples by failure bucket,
 * first-attempt-of-session effects, sentence-length effects. */
const d = require('./speech_events_dump_full.json');
const A = d.attempts, E = d.errors, S = d.skips;

function norm(s) {
    return (s || '').toLowerCase().replace(/[.,!?;:'"()\-]/g, ' ').replace(/\s+/g, ' ').trim();
}
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
function acc(t, g) { t = norm(t); g = norm(g); if (!t || !g) return 0; return Math.max(0, 1 - lev(t, g) / Math.max(t.length, g.length, 1)); }

// Whisper hallucination tokens: what tiny.en emits for silence/noise/music
function isHallu(t) {
    const x = (t || '').trim();
    if (!x) return true;
    return /^\[.*\]$/.test(x) || /^\(.*\)$/.test(x) || /^(you|bye!?|thank you\.?|thanks for watching!?|\.)$/i.test(x);
}

function dev(ua) {
    ua = ua || '';
    const os = /iPad|iPhone|Macintosh/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'Win';
    const br = /MicroMessenger/i.test(ua) ? 'WeChat' : /CriOS|Chrome/.test(ua) ? 'Chrome' : 'Safari';
    return os + '/' + br;
}
function pad(s, w) { s = String(s); return s.length >= w ? s : s + ' '.repeat(w - s.length); }

// ---- A. errors per student ----
console.log('=== A. PERMISSION ERRORS per student ===');
const em = new Map();
for (const e of E) {
    const k = e.student + '  (' + dev(e.ua) + ')';
    em.set(k, (em.get(k) || 0) + 1);
}
for (const [k, v] of [...em.entries()].sort((a, b) => b[1] - a[1])) console.log(pad(v + 'x', 6) + k);

// ---- B. per-student: pass / hallucination / real-transcript fail ----
console.log('\n=== B. PER STUDENT: pass vs hallucination vs real-fail ===');
const st = new Map();
for (const a of A) {
    if (!st.has(a.student)) st.set(a.student, { n: 0, pass: 0, hallu: 0, realFail: 0, ua: a.ua, accs: [] });
    const s = st.get(a.student);
    s.n++;
    if (a.pass) s.pass++;
    else if (isHallu(a.transcript)) s.hallu++;
    else { s.realFail++; s.accs.push(acc(a.target, a.transcript)); }
}
console.log(pad('student', 10) + pad('n', 5) + pad('pass', 6) + pad('hallu', 7) + pad('realFail', 10) + pad('avgAccOfRealFails', 19) + 'device');
for (const [k, v] of [...st.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const avg = v.accs.length ? (v.accs.reduce((x, y) => x + y, 0) / v.accs.length).toFixed(2) : '—';
    console.log(pad(k, 10) + pad(v.n, 5) + pad(v.pass, 6) + pad(v.hallu, 7) + pad(v.realFail, 10) + pad(avg, 19) + dev(v.ua));
}

// ---- C. hallucination rate per device ----
console.log('\n=== C. HALLUCINATION RATE per device ===');
const dm = new Map();
for (const a of A) {
    const k = dev(a.ua);
    if (!dm.has(k)) dm.set(k, { n: 0, hallu: 0, pass: 0 });
    const s = dm.get(k);
    s.n++; if (a.pass) s.pass++; else if (isHallu(a.transcript)) s.hallu++;
}
for (const [k, v] of dm.entries()) console.log(pad(k, 16) + pad(v.n + ' att', 9) + pad('hallu ' + (100 * v.hallu / v.n).toFixed(0) + '%', 12) + 'pass ' + (100 * v.pass / v.n).toFixed(0) + '%');

// ---- D. real-transcript failed pairs (NOT hallucinations) — the ASR quality view ----
console.log('\n=== D. REAL-TRANSCRIPT FAILS (model heard actual speech, got it wrong) — 30 samples ===');
const realFails = A.filter(a => !a.pass && !isHallu(a.transcript));
realFails.sort((a, b) => acc(b.target, b.transcript) - acc(a.target, a.transcript));
for (const f of realFails.slice(0, 30)) {
    console.log('acc=' + acc(f.target, f.transcript).toFixed(2) + '  [' + f.student + '] "' + f.target + '"');
    console.log('        heard: "' + f.transcript + '"');
}

// ---- E. audioMs vs outcome ----
console.log('\n=== E. RECORDING LENGTH vs OUTCOME ===');
const buckets = [[0, 1200, '<1.2s'], [1200, 3000, '1.2-3s'], [3000, 6000, '3-6s'], [6000, 10000, '6-10s'], [10000, 99999, '>10s']];
for (const [lo, hi, label] of buckets) {
    const list = A.filter(a => typeof a.audioMs === 'number' && a.audioMs >= lo && a.audioMs < hi);
    if (!list.length) continue;
    const p = list.filter(a => a.pass).length;
    const h = list.filter(a => !a.pass && isHallu(a.transcript)).length;
    console.log(pad(label, 9) + pad(list.length + ' att', 9) + pad('pass ' + (100 * p / list.length).toFixed(0) + '%', 11) + 'hallu ' + (100 * h / list.length).toFixed(0) + '%');
}

// ---- F. sentence length vs outcome ----
console.log('\n=== F. TARGET LENGTH (words) vs OUTCOME ===');
const lb = [[1, 4, '1-4w'], [5, 7, '5-7w'], [8, 20, '8+w']];
for (const [lo, hi, label] of lb) {
    const list = A.filter(a => { const n = norm(a.target).split(' ').length; return n >= lo && n <= hi; });
    if (!list.length) continue;
    const p = list.filter(a => a.pass).length;
    console.log(pad(label, 7) + pad(list.length + ' att', 9) + 'pass ' + (100 * p / list.length).toFixed(0) + '%');
}

// ---- G. skips per student ----
console.log('\n=== G. SKIPS (gave up) per student ===');
const sk = new Map();
for (const s of S) sk.set(s.student, (sk.get(s.student) || 0) + 1);
for (const [k, v] of [...sk.entries()].sort((a, b) => b[1] - a[1])) console.log(pad(v + 'x', 5) + k);

// ---- H. time span of data ----
const times = A.map(a => a.ts).sort((a, b) => a - b);
console.log('\n=== H. DATA SPAN ===');
console.log('first attempt: ' + new Date(times[0]).toLocaleString());
console.log('last attempt : ' + new Date(times[times.length - 1]).toLocaleString());
