// ============================================================
// SCHOOL DEFENSE 3D — audio.js
// Fully synthesized SFX via WebAudio (NO asset files — GFW-safe,
// zero download). One shared AudioContext, resumed on first user
// gesture (the PLAY button). Each sound is a short oscillator/noise
// envelope. Master gain keeps it gentle for classroom use.
// ============================================================

let ctx = null;
let master = null;
let enabled = true;

export function initAudio() {
    if (ctx) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { enabled = false; return; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.35;          // gentle overall volume
        master.connect(ctx.destination);
    } catch { enabled = false; }
}

// Must be called from a user gesture (PLAY click) so mobile/WeChat unlocks audio.
export function resumeAudio() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setAudioEnabled(on) { enabled = on; }
export function isAudioEnabled() { return enabled; }

function now() { return ctx.currentTime; }

// Core tone: oscillator with an ADSR-ish gain envelope + optional pitch slide.
function tone({ freq = 440, freq2 = null, type = 'sine', dur = 0.15, vol = 0.5, attack = 0.005, decay = null }) {
    if (!enabled || !ctx) return;
    const t = now();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freq2 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t + dur);
    const d = decay != null ? decay : dur;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(master);
    osc.start(t);
    osc.stop(t + d + 0.02);
}

// Short filtered noise burst (impacts, whooshes).
function noise({ dur = 0.15, vol = 0.4, type = 'lowpass', freq = 1200 }) {
    if (!enabled || !ctx) return;
    const t = now();
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = type; filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
}

// ---------------- NAMED SFX ----------------
export const SFX = {
    sword() { noise({ dur: 0.12, vol: 0.35, type: 'highpass', freq: 900 }); tone({ freq: 320, freq2: 140, type: 'triangle', dur: 0.12, vol: 0.25 }); },
    bow() { tone({ freq: 700, freq2: 1400, type: 'square', dur: 0.09, vol: 0.18 }); noise({ dur: 0.06, vol: 0.15, freq: 3000, type: 'highpass' }); },
    special() { tone({ freq: 120, freq2: 40, type: 'sawtooth', dur: 0.5, vol: 0.5 }); noise({ dur: 0.5, vol: 0.4, freq: 500 }); },
    towerShoot() { tone({ freq: 500, freq2: 260, type: 'square', dur: 0.07, vol: 0.12 }); },
    cannon() { tone({ freq: 90, freq2: 45, type: 'sawtooth', dur: 0.22, vol: 0.4 }); noise({ dur: 0.2, vol: 0.3, freq: 400 }); },
    hit() { tone({ freq: 220, freq2: 110, type: 'triangle', dur: 0.08, vol: 0.18 }); },
    enemyDie() { tone({ freq: 300, freq2: 80, type: 'sawtooth', dur: 0.22, vol: 0.28 }); noise({ dur: 0.15, vol: 0.2, freq: 800 }); },
    coin() { tone({ freq: 880, type: 'square', dur: 0.06, vol: 0.18 }); tone({ freq: 1320, type: 'square', dur: 0.09, vol: 0.16, attack: 0.05 }); },
    ammo() { tone({ freq: 600, freq2: 900, type: 'triangle', dur: 0.1, vol: 0.18 }); },
    build() { tone({ freq: 180, freq2: 360, type: 'square', dur: 0.12, vol: 0.25 }); noise({ dur: 0.08, vol: 0.15, freq: 600 }); },
    reinforce() { tone({ freq: 200, freq2: 500, type: 'square', dur: 0.16, vol: 0.28 }); },
    place() { tone({ freq: 300, freq2: 500, type: 'triangle', dur: 0.1, vol: 0.2 }); },
    deny() { tone({ freq: 200, freq2: 120, type: 'square', dur: 0.14, vol: 0.22 }); },
    frost() { tone({ freq: 900, freq2: 1600, type: 'sine', dur: 0.25, vol: 0.16 }); },
    hurt() { tone({ freq: 260, freq2: 90, type: 'sawtooth', dur: 0.25, vol: 0.35 }); },
    schoolHit() { tone({ freq: 150, freq2: 70, type: 'square', dur: 0.18, vol: 0.3 }); },
    waveStart() { tone({ freq: 300, freq2: 600, type: 'sawtooth', dur: 0.4, vol: 0.3 }); tone({ freq: 450, type: 'square', dur: 0.5, vol: 0.2, attack: 0.2 }); },
    waveClear() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'square', dur: 0.18, vol: 0.25 }), i * 90)); },
    victory() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'square', dur: 0.3, vol: 0.3 }), i * 140)); },
    defeat() { [400, 300, 200, 130].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sawtooth', dur: 0.35, vol: 0.3 }), i * 160)); }
};
