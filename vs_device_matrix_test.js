// Device-matrix test: run VS + UNO + Gomoku across a WIDE range of emulated
// device profiles and assert the adaptive sizing invariants hold everywhere:
//  - VS:    backing ~= window x cap (cap=min(2,dpr)), displayScale ~= cap,
//           canvas fills the viewport, camera zoom ~= fit x cap
//  - UNO:   canvas matches its container, camera zoom ~= cap, all cards in view
//  - GOMOKU: displayed board <= 600 CSS px AND <= container; backing ~= display x cap;
//            size STABLE across repeated draws (no feedback loop)
// Rotation: on marked profiles the viewport is rotated mid-VS and mid-Gomoku
// and the invariants must re-establish (resize listeners).
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PROFILES = [
    { name: 'iphone-se', w: 375, h: 667, dsf: 2 },
    { name: 'small-android', w: 360, h: 800, dsf: 2 },
    { name: 'android-mid', w: 390, h: 844, dsf: 3 },
    { name: 'big-phone', w: 430, h: 932, dsf: 3 },
    { name: 'ipad-mini', w: 744, h: 1133, dsf: 2, rotate: true },
    { name: 'ipad', w: 810, h: 1080, dsf: 2 },
    { name: 'ipad-pro-12.9', w: 1024, h: 1366, dsf: 2, rotate: true },
    { name: 'laptop-1366', w: 1366, h: 768, dsf: 1 },
    { name: 'win-125pct', w: 1536, h: 864, dsf: 1.25 },
    { name: 'win-150pct', w: 1280, h: 720, dsf: 1.5 },
    { name: 'pc-1080p', w: 1600, h: 900, dsf: 1 },
    { name: 'ultrawide', w: 2560, h: 1080, dsf: 1 }
];

const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function vsMetrics(p) {
    return p.evaluate(() => {
        const s = game.scene.getScene('MainScene');
        const r = game.canvas.getBoundingClientRect();
        return {
            backingW: game.canvas.width, backingH: game.canvas.height,
            dispScale: +game.scale.displayScale.y.toFixed(3),
            rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
            camZoom: +s.cameras.main.zoom.toFixed(3),
            innerW: window.innerWidth, innerH: window.innerHeight
        };
    });
}
function vsOk(v, cap) {
    const fit = Math.min(1, Math.max(0.4, v.innerW / 800));
    return near(v.backingW, v.innerW * cap, 3) && near(v.backingH, v.innerH * cap, 3) &&
        near(v.dispScale, cap, 0.02) && near(v.rect[2], v.innerW, 2) && near(v.rect[3], v.innerH, 2) &&
        near(v.camZoom, fit * cap, 0.03);
}

async function gomokuMetrics(p) {
    return p.evaluate(async () => {
        const sizes = [];
        for (let i = 0; i < 3; i++) { drawGomokuBoard(); await new Promise(r => setTimeout(r, 90)); sizes.push(gomokuCanvas.width); }
        const r = gomokuCanvas.getBoundingClientRect();
        const parent = gomokuCanvas.parentElement.getBoundingClientRect();
        return { backing: gomokuCanvas.width, clientW: gomokuCanvas.clientWidth, dispW: Math.round(r.width), dispH: Math.round(r.height), parentW: Math.round(parent.width), stable: sizes.every(s => s === sizes[0]) };
    });
}
function gomokuOk(g, cap) {
    return g.stable && g.dispW <= 601 && g.dispW <= g.parentW + 1 &&
        near(g.backing, g.clientW * cap, 2 * cap + 1) && near(g.dispW, g.dispH, 2);
}

async function runProfile(prof) {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await b.newContext({ viewport: { width: prof.w, height: prof.h }, deviceScaleFactor: prof.dsf });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1400);
    const cap = Math.min(2, Math.max(1, prof.dsf));

    // --- Gomoku (+ optional rotation) ---
    await p.evaluate(() => triggerGomoku('classic'));
    await p.waitForTimeout(700);
    const g1 = await gomokuMetrics(p);
    let gOk = gomokuOk(g1, cap);
    let gRotOk = true;
    if (prof.rotate) {
        await p.setViewportSize({ width: prof.h, height: prof.w });
        await p.waitForTimeout(500); // resize listener redraw
        const g2 = await p.evaluate(() => {
            const r = gomokuCanvas.getBoundingClientRect();
            const parent = gomokuCanvas.parentElement.getBoundingClientRect();
            return { backing: gomokuCanvas.width, clientW: gomokuCanvas.clientWidth, dispW: Math.round(r.width), dispH: Math.round(r.height), parentW: Math.round(parent.width), stable: true };
        });
        gRotOk = gomokuOk(g2, cap);
        await p.setViewportSize({ width: prof.w, height: prof.h });
        await p.waitForTimeout(400);
    }

    // --- VS (+ optional rotation) ---
    await p.evaluate(() => showGameSelection());
    await p.waitForTimeout(250);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2300);
    const v1 = await vsMetrics(p);
    let vOk = vsOk(v1, cap);
    let vRotOk = true;
    if (prof.rotate) {
        await p.setViewportSize({ width: prof.h, height: prof.w });
        await p.waitForTimeout(600); // HiDPI resize listener re-applies
        const v2 = await vsMetrics(p);
        vRotOk = vsOk(v2, cap);
        await p.setViewportSize({ width: prof.w, height: prof.h });
        await p.waitForTimeout(400);
    }

    // --- UNO (after VS = worst-case path) ---
    await p.evaluate(() => showGameSelection());
    await p.waitForTimeout(250);
    await p.evaluate(() => triggerUno());
    await p.waitForTimeout(2600);
    const u = await p.evaluate(() => {
        const s = game.scene.getScene('UnoScene');
        const c = game.canvas;
        const cont = document.getElementById('uno-phaser-container').getBoundingClientRect();
        const r = c.getBoundingClientRect();
        const dpr = (typeof vsDpr === 'function') ? vsDpr() : 1;
        const cssW = c.width / dpr, cssH = c.height / dpr;
        let inView = 0, total = 0;
        (s.cardSprites || []).forEach(cs => { total++; if (cs.x >= -60 && cs.x <= cssW + 60 && cs.y >= -60 && cs.y <= cssH + 60) inView++; });
        return { rectW: Math.round(r.width), contW: Math.round(cont.width), total, inView, camZoom: s.cameras.main ? +s.cameras.main.zoom.toFixed(3) : null };
    });
    const uOk = u.total > 0 && u.inView === u.total && near(u.rectW, u.contW, 10) && near(u.camZoom, cap, 0.02);

    await b.close();
    const PASS = gOk && gRotOk && vOk && vRotOk && uOk && errs.length === 0;
    return { profile: prof.name, dsf: prof.dsf, cap, gOk, gRotOk, vOk, vRotOk, uOk, errCount: errs.length, PASS, detail: PASS ? undefined : { g1, v1, u, errs: errs.slice(0, 3) } };
}

(async () => {
    let all = true;
    for (const prof of PROFILES) {
        const r = await runProfile(prof);
        all = all && r.PASS;
        console.log(JSON.stringify(r));
    }
    console.log('MATRIX', all ? 'PASS' : 'FAIL');
    process.exit(all ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
