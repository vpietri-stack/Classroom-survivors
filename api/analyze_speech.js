/* =========================================================================
 * analyze_speech.js — pulls speech_attempt / speech_skip / speech_error
 * telemetry from Cosmos DB and prints a diagnostic report answering:
 *   1. What's the real failure rate (per student / per device)?
 *   2. WHY do attempts fail — garbage transcript (ASR/recording problem),
 *      plausible-but-wrong transcript (children's-voices model problem),
 *      or near-miss (scorer thresholds too strict)?
 *   3. What would the pass rate be under looser scoring (level 1 / tweaks)?
 *
 * Usage (from api/, needs local.settings.json with COSMOS_ENDPOINT/KEY):
 *   node analyze_speech.js               # last 48h (default)
 *   node analyze_speech.js --hours 24    # custom window
 *   node analyze_speech.js --json out.json  # also dump raw events for deep dives
 * ========================================================================= */
const { CosmosClient } = require('@azure/cosmos');
const config = require('./local.settings.json');

const endpoint = config.Values.COSMOS_ENDPOINT;
const key = config.Values.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

// ---- args ----
const args = process.argv.slice(2);
function argVal(name, dflt) {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const HOURS = parseFloat(argVal('--hours', '48'));
const JSON_OUT = argVal('--json', null);
const SINCE = Date.now() - HOURS * 3600 * 1000;

// ---- scorer (mirror of speech_scorer.js, so we can replay attempts under
//      alternative levels/thresholds without touching the client code) ----
// Variant D (deployed 2026-07-28): OR of charAcc / length-proportional WER /
// phonetic coverage. Mirrors the restructured client scorer.
const LEVELS = {
    1: { minAccuracy: 0.65, maxWER: 0.45, phonPass: 0.60, allowPhonetic: true },
    2: { minAccuracy: 0.75, maxWER: 0.30, phonPass: 0.70, allowPhonetic: true },
    3: { minAccuracy: 0.85, maxWER: 0.20, phonPass: 0.85, allowPhonetic: true }
};
function normalize(s) {
    return (s || '').toLowerCase().replace(/[.,!?;:'"()\-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[m][n];
}
function accuracyOf(tgt, got) {
    if (!tgt && !got) return 1;
    if (!tgt || !got) return 0;
    return Math.max(0, 1 - levenshtein(tgt, got) / Math.max(tgt.length, got.length, 1));
}
function phoneticMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return levenshtein(a, b) / Math.max(a.length, b.length, 1) <= 1 / 3;
}
function rescore(target, transcript, level) {
    const cfg = LEVELS[level] || LEVELS[2];
    const tgt = normalize(target), got = normalize(transcript);
    if (tgt && tgt === got) return true;
    const acc = accuracyOf(tgt, got);
    const tTok = tgt ? tgt.split(' ') : [], gTok = got ? got.split(' ') : [];
    const wer = tTok.length ? levenshtein(tTok, gTok) / tTok.length : 1;
    let hits = 0;
    if (cfg.allowPhonetic && tTok.length && gTok.length) {
        for (const tw of tTok) if (gTok.some(gw => phoneticMatch(tw, gw))) hits++;
    }
    const phRatio = tTok.length ? hits / tTok.length : 0;
    return acc >= cfg.minAccuracy || wer <= cfg.maxWER || (cfg.allowPhonetic && phRatio >= cfg.phonPass);
}

// ---- failure-mode classifier: the heart of the diagnosis ----
// garbage    : transcript empty or shares almost nothing with the target
//              → recording/environment problem OR total ASR failure
// wrong      : real English words came out, but far from the target
//              → ASR mis-hearing (children's-voices hypothesis)
// near-miss  : close to the target but below threshold
//              → scorer strictness problem, cheap fix
function classifyFail(target, transcript) {
    const tgt = normalize(target), got = normalize(transcript);
    if (!got) return 'garbage(empty)';
    const acc = accuracyOf(tgt, got);
    const tTok = tgt.split(' ');
    const gTok = got.split(' ');
    let hits = 0;
    for (const tw of tTok) if (gTok.some(gw => phoneticMatch(tw, gw))) hits++;
    const phRatio = tTok.length ? hits / tTok.length : 0;
    if (acc >= 0.5 || phRatio >= 0.5) return 'near-miss';
    if (acc >= 0.2 || phRatio >= 0.2) return 'wrong';
    return 'garbage(unrelated)';
}

function deviceOf(ua) {
    ua = ua || '';
    const os = /iPad|iPhone|Macintosh/.test(ua) ? 'iOS/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : 'other';
    const br = /MicroMessenger/i.test(ua) ? 'WeChat' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'other';
    return os + '/' + br;
}

function pct(n, d) { return d ? ((100 * n / d).toFixed(0) + '%') : '—'; }
function pad(s, w) { s = String(s); return s.length >= w ? s : s + ' '.repeat(w - s.length); }

async function main() {
    console.log(`Pulling students… (window: last ${HOURS}h)`);
    const { resources: students } = await container.items.query({
        query: 'SELECT c.id, c.fullName, c.analytics FROM c'
    }).fetchAll();

    const attempts = [], skips = [], errors = [], gated = [];
    for (const s of students) {
        for (const ev of (s.analytics || [])) {
            if (!ev || typeof ev.exerciseType !== 'string' || !ev.exerciseType.startsWith('speech_')) continue;
            const ts = Date.parse(ev.timestamp || 0);
            if (isNaN(ts) || ts < SINCE) continue;
            const row = { student: s.fullName || s.id, ts, mode: ev.mode, attempts: ev.attempts, ...(ev.itemDetails || {}) };
            if (ev.exerciseType === 'speech_attempt') attempts.push(row);
            else if (ev.exerciseType === 'speech_skip') skips.push(row);
            else if (ev.exerciseType === 'speech_error') errors.push(row);
            else if (ev.exerciseType === 'speech_gated') gated.push(row);
        }
    }

    if (JSON_OUT) {
        require('fs').writeFileSync(JSON_OUT, JSON.stringify({ attempts, skips, errors, gated }, null, 2));
        console.log(`Raw events dumped to ${JSON_OUT}`);
    }

    console.log('\n================ SPEECH TELEMETRY REPORT ================');
    console.log(`Window: last ${HOURS}h   attempts: ${attempts.length}   skips: ${skips.length}   errors: ${errors.length}   gated(junk audio): ${gated.length}`);
    if (gated.length) {
        const gr = new Map();
        for (const g of gated) gr.set(g.reason, (gr.get(g.reason) || 0) + 1);
        console.log('Gated breakdown         : ' + [...gr.entries()].map(([k, v]) => `${k}: ${v}`).join('   '));
    }
    if (!attempts.length) { console.log('\nNo attempts recorded in window. Nothing to analyze yet.'); return; }

    // ---- 1. headline pass rates ----
    const passed = attempts.filter(a => a.pass);
    console.log(`\n--- 1. HEADLINE ---`);
    console.log(`Attempt-level pass rate : ${passed.length}/${attempts.length} (${pct(passed.length, attempts.length)})`);
    // sentence-level: group by student+target, did ANY attempt pass?
    const byGate = new Map();
    for (const a of attempts) {
        const k = a.student + '||' + a.target;
        if (!byGate.has(k)) byGate.set(k, []);
        byGate.get(k).push(a);
    }
    const gatesPassed = [...byGate.values()].filter(g => g.some(a => a.pass)).length;
    console.log(`Sentence-level pass rate: ${gatesPassed}/${byGate.size} (${pct(gatesPassed, byGate.size)}) — "did the student EVER pass this sentence"`);
    console.log(`Skips (gave up)         : ${skips.length}`);

    // ---- 2. per-student ----
    console.log(`\n--- 2. PER STUDENT ---`);
    const byStudent = new Map();
    for (const a of attempts) {
        if (!byStudent.has(a.student)) byStudent.set(a.student, []);
        byStudent.get(a.student).push(a);
    }
    console.log(pad('student', 16) + pad('attempts', 10) + pad('pass', 8) + pad('rate', 7) + pad('avgAcc', 8) + 'device');
    for (const [name, list] of [...byStudent.entries()].sort((x, y) => y[1].length - x[1].length)) {
        const p = list.filter(a => a.pass).length;
        const avgAcc = (list.reduce((s, a) => s + (a.accuracy || 0), 0) / list.length).toFixed(2);
        const dev = deviceOf(list[list.length - 1].ua);
        console.log(pad(name, 16) + pad(list.length, 10) + pad(p, 8) + pad(pct(p, list.length), 7) + pad(avgAcc, 8) + dev);
    }

    // ---- 3. per-device ----
    console.log(`\n--- 3. PER DEVICE/BROWSER ---`);
    const byDev = new Map();
    for (const a of attempts) {
        const d = deviceOf(a.ua);
        if (!byDev.has(d)) byDev.set(d, []);
        byDev.get(d).push(a);
    }
    for (const [d, list] of byDev.entries()) {
        const p = list.filter(a => a.pass).length;
        console.log(pad(d, 22) + pad(list.length + ' attempts', 14) + 'pass ' + pct(p, list.length));
    }

    // ---- 4. WHY do attempts fail ----
    console.log(`\n--- 4. FAILURE MODES (the actual diagnosis) ---`);
    const fails = attempts.filter(a => !a.pass);
    const modes = new Map();
    for (const f of fails) {
        const m = classifyFail(f.target, f.transcript);
        modes.set(m, (modes.get(m) || 0) + 1);
    }
    for (const [m, n] of [...modes.entries()].sort((x, y) => y[1] - x[1])) {
        console.log(pad(m, 20) + pad(n, 6) + pct(n, fails.length));
    }
    console.log(`\nInterpretation:`);
    console.log(`  near-miss dominant        → scorer too strict: tune thresholds (cheap fix)`);
    console.log(`  wrong dominant            → ASR mis-hears children: pitch-shift preprocessing / bigger model`);
    console.log(`  garbage dominant          → recording/environment: mic gain, noise, kids too quiet`);

    // ---- 5. what-if rescoring ----
    console.log(`\n--- 5. WHAT-IF: same transcripts, looser scoring ---`);
    for (const lvl of [2, 1]) {
        const p = attempts.filter(a => rescore(a.target, a.transcript, lvl)).length;
        console.log(`  level ${lvl}: ${p}/${attempts.length} (${pct(p, attempts.length)})${lvl === 2 ? '  ← current' : ''}`);
    }

    // ---- 5b. pitch-shift effect (child-voice adaptation) ----
    // f0/shiftSemis are only present on events recorded after the pitch-
    // adaptation deploy; older events group as "no data".
    console.log(`\n--- 5b. PITCH SHIFT (child-voice adaptation) ---`);
    const shifted = attempts.filter(a => typeof a.shiftSemis === 'number' && a.shiftSemis > 0);
    const unshifted = attempts.filter(a => typeof a.shiftSemis === 'number' && a.shiftSemis === 0);
    const noData = attempts.length - shifted.length - unshifted.length;
    if (shifted.length + unshifted.length === 0) {
        console.log('  no pitch data yet (all events predate the pitch-adaptation deploy)');
    } else {
        const sp = shifted.filter(a => a.pass).length;
        const up = unshifted.filter(a => a.pass).length;
        console.log(`  shifted   (child-high F0): ${shifted.length} attempts, pass ${pct(sp, shifted.length)}`);
        console.log(`  unshifted (adult-range F0/unvoiced): ${unshifted.length} attempts, pass ${pct(up, unshifted.length)}`);
        if (noData) console.log(`  (no pitch data: ${noData} older attempts)`);
        // Per-student median F0 — shows WHO triggers the shift.
        const f0ByStudent = new Map();
        for (const a of attempts) {
            if (typeof a.f0 !== 'number' || !a.f0) continue;
            if (!f0ByStudent.has(a.student)) f0ByStudent.set(a.student, []);
            f0ByStudent.get(a.student).push(a.f0);
        }
        for (const [name, list] of [...f0ByStudent.entries()].sort((x, y) => y[1].length - x[1].length)) {
            list.sort((x, y) => x - y);
            const med = list[Math.floor(list.length / 2)];
            console.log(`  ${pad(name, 14)} median F0 ${med}Hz (${list.length} voiced attempts)${med >= 240 ? '  → shift active' : ''}`);
        }
    }

    // ---- 5c. per-book pass rates (leniency-ladder view) ----
    console.log(`\n--- 5c. PER BOOK (leniency tiers) ---`);
    const byBook = new Map();
    for (const a of attempts) {
        const b = (a.book || 'unknown').toString();
        if (!byBook.has(b)) byBook.set(b, []);
        byBook.get(b).push(a);
    }
    for (const [b, list] of [...byBook.entries()].sort((x, y) => y[1].length - x[1].length)) {
        const p = list.filter(a => a.pass).length;
        console.log(`  ${pad(b, 10)} ${pad(list.length + ' attempts', 14)} pass ${pct(p, list.length)}`);
    }

    // ---- 6. audio sanity ----
    console.log(`\n--- 6. AUDIO SANITY ---`);
    const withAudio = attempts.filter(a => a.audioMs);
    if (withAudio.length) {
        const med = withAudio.map(a => a.audioMs).sort((x, y) => x - y)[Math.floor(withAudio.length / 2)];
        const tooShort = withAudio.filter(a => a.audioMs < 1200).length;
        const maxed = withAudio.filter(a => a.audioMs >= 14500).length;
        console.log(`  median recording: ${(med / 1000).toFixed(1)}s   <1.2s (too short): ${tooShort}   ≥14.5s (hit auto-stop): ${maxed}`);
        const medT = withAudio.filter(a => a.transcribeMs).map(a => a.transcribeMs).sort((x, y) => x - y)[Math.floor(withAudio.length / 2)] || 0;
        console.log(`  median transcribe time: ${(medT / 1000).toFixed(1)}s`);
    } else console.log('  no audio metadata captured');

    // ---- 7. worst transcript/target pairs (eyeball the ASR) ----
    console.log(`\n--- 7. SAMPLE FAILED PAIRS (worst first, max 25) ---`);
    const sortedFails = fails.slice().sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0)).slice(0, 25);
    for (const f of sortedFails) {
        console.log(`  [${f.student}] acc=${(f.accuracy || 0).toFixed(2)}  target: "${f.target}"`);
        console.log(`  ${' '.repeat(f.student.length + 2)} heard : "${f.transcript}"`);
    }

    // ---- 8. errors ----
    if (errors.length) {
        console.log(`\n--- 8. MIC/ENGINE ERRORS ---`);
        const byMsg = new Map();
        for (const e of errors) byMsg.set(e.message, (byMsg.get(e.message) || 0) + 1);
        for (const [m, n] of byMsg.entries()) console.log(`  ${n}× ${m}`);
    }
    console.log('\n==========================================================');
}

main().catch(e => { console.error(e); process.exit(1); });
