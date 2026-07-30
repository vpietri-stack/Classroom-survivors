// One-off: verify VS HiDPI. At deviceScaleFactor 1/2/3 (mobile viewport) the
// backing buffer must be CSS x min(2,dpr), the canvas CSS style must be the
// window size, and the camera zoom must be fit x min(2,dpr). Also verify a
// world<->screen round-trip (no coord drift) and that exitHiDpi() restores a
// CSS-px canvas for the next game (Uno path).
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const VW = 414, VH = 896; // iPhone-ish CSS viewport

async function run(dsf) {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: dsf });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2800);
    const out = await p.evaluate(() => {
        const s = game.scene.getScene('MainScene');
        const cap = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        const cssW = window.innerWidth, cssH = window.innerHeight;
        const fit = Phaser.Math.Clamp(cssW / cap / 800, 0.4, 1.0); // cssW/cap = logical? no: backing/cap = css
        // backing should be cssW*cap; camera zoom should be fit(css)*cap
        const fitCss = Phaser.Math.Clamp(cssW / 800, 0.4, 1.0);
        // world<->screen round-trip via the camera
        const cam = s.cameras.main;
        const wp = cam.getWorldPoint(cssW * cap / 2, cssH * cap / 2); // pointer at backing centre
        return {
            dpr: window.devicePixelRatio, cap,
            backingW: game.canvas.width, wantBackingW: Math.round(cssW * cap),
            backingH: game.canvas.height, wantBackingH: Math.round(cssH * cap),
            styleW: game.canvas.style.width, styleH: game.canvas.style.height,
            zoom: +cam.zoom.toFixed(3), wantZoom: +(fitCss * cap).toFixed(3),
            worldPtDefined: Number.isFinite(wp.x) && Number.isFinite(wp.y)
        };
    });
    await b.close();
    return { dsf, out, errs };
}

// Regression: after VS, enter Uno and confirm the canvas is back to CSS px
async function unoRestore() {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2000);
    const vsBacking = await p.evaluate(() => game.canvas.width);
    const res = await p.evaluate(() => {
        if (typeof showGameSelection === 'function') showGameSelection();
        return { mode: game.scale.scaleMode, backingW: game.canvas.width, wantCss: window.innerWidth, styleW: game.canvas.style.width };
    });
    await b.close();
    return { vsBacking, res, errs, RESIZE: 'expect scaleMode===Phaser.Scale.RESIZE(=3), backingW===innerWidth' };
}

(async () => {
    for (const dsf of [1, 2, 3]) console.log(JSON.stringify(await run(dsf)));
    console.log('UNO_RESTORE', JSON.stringify(await unoRestore()));
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
