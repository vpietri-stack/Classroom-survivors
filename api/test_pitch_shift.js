/* test_pitch_shift.js — unit tests for the child-voice pitch adaptation in
 * speech_engine.js (estimateF0 / shiftSemitonesFor / resample length).
 * Run: node test_pitch_shift.js   (exit 0 = all pass) */

// Minimal browser-global stubs so the engine IIFE can load under Node.
global.window = global;
global.location = { hostname: 'localhost', pathname: '/', href: 'http://localhost:8099/' };
global.navigator = global.navigator || { userAgent: 'node-test' };

require('../speech_engine.js');
const E = global.LocalEngine;

let ok = true;
function check(cond, label, detail) {
    console.log((cond ? 'OK    ' : 'WRONG ') + label + (detail ? '  (' + detail + ')' : ''));
    if (!cond) ok = false;
}

const SR = 16000;

// Sawtooth wave at a given F0: strong fundamental + natural harmonics,
// a reasonable stand-in for a voiced vowel.
function sawtooth(f0, seconds, amp) {
    const n = Math.round(SR * seconds);
    const out = new Float32Array(n);
    const period = SR / f0;
    for (let i = 0; i < n; i++) out[i] = amp * (2 * ((i % period) / period) - 1);
    return out;
}
function whiteNoise(seconds, amp) {
    const n = Math.round(SR * seconds);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = amp * (Math.random() * 2 - 1);
    return out;
}

// --- estimateF0 accuracy (within ±10%) ---
for (const f of [150, 220, 300, 380]) {
    const est = E._estimateF0(sawtooth(f, 2, 0.4), SR);
    check(est !== null && Math.abs(est - f) / f <= 0.10, `estimateF0 ${f}Hz -> ${est ? est.toFixed(1) : 'null'}Hz`, 'want ±10%');
}

// --- estimateF0 rejects non-speech ---
check(E._estimateF0(whiteNoise(2, 0.3), SR) === null, 'white noise -> null');
check(E._estimateF0(new Float32Array(SR * 2), SR) === null, 'silence -> null');

// --- shift policy ---
check(E._shiftSemitonesFor(150) === 0, 'F0 150Hz (deep voice / Max) -> no shift');
check(E._shiftSemitonesFor(220) === 0, 'F0 220Hz (below 240 threshold) -> no shift');
check(E._shiftSemitonesFor(null) === 0, 'F0 null (unvoiced) -> no shift');
const s300 = E._shiftSemitonesFor(300);
check(s300 >= 1 && s300 <= 4, `F0 300Hz -> ${s300} semitones (clamped to 1..4)`);
check(E._shiftSemitonesFor(380) === 4, 'F0 380Hz -> capped at 4 semitones');

// --- shift resample: output length == k x input (pitch drops by k) ---
const input = sawtooth(300, 1, 0.4);
const k = Math.pow(2, 4 / 12);
const stretched = E._resample(input, SR, Math.round(SR * k));
check(Math.abs(stretched.length - input.length * k) <= 2, `resample stretch: ${input.length} -> ${stretched.length} (k=${k.toFixed(3)})`);
// And the stretched audio's measured F0 should be ~300/k ≈ 238 Hz.
const estShifted = E._estimateF0(stretched, SR);
check(estShifted !== null && Math.abs(estShifted - 300 / k) / (300 / k) <= 0.10, `shifted audio F0 -> ${estShifted ? estShifted.toFixed(1) : 'null'}Hz (want ~${(300 / k).toFixed(0)}Hz)`);

console.log(ok ? '\nALL PITCH TESTS PASS' : '\nPITCH TESTS FAILED');
process.exit(ok ? 0 : 1);
