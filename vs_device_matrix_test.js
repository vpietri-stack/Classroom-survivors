// Device-matrix test: run VS + UNO + Gomoku across representative device
// profiles (phone / tablet portrait / tablet landscape / PC) and assert the
// adaptive sizing invariants hold everywhere:
//  - VS:    backing = window x min(2,dpr), displayScale == cap, camera zoom = fit x cap
//  - UNO:   backing = container x cap, cards laid out inside the CSS view
//  - GOMOKU: displayed board <= 600 CSS px AND <= container; backing = display x cap;
//            size STABLE across repeated draws (no feedback loop)
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PROFILES = [
    { name: 'phone', w: 390, h: 844, dsf: 3 },
    { name: 'tablet-portrait', w: 810, h: 1080, dsf: 2 },
    { name: 'tablet-landscape', w: 1080, h: 810, dsf: 2 },
    { name: 'pc', w: 1600, h: 900, dsf: 1 }
];

async function runProfile(prof) {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await b.newContext({ viewport: { width: prof.w, height: prof.h }, deviceScaleFactor: prof.dsf });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const cap = Math.min(2, Math.max(1, prof.dsf));

    // --- Gomoku ---
    await p.evaluate(() => triggerGomoku('classic'));
    await p.waitForTimeout(800);
    const gomoku = await p.evaluate(async () => {
        const sizes = [];
        for (let i = 0; i < 4; i++) { drawGomokuBoard(); await new Promise(r => setTimeout(r, 100)); sizes.push(gomokuCanvas.width); }
        const r = gomokuCanvas.getBoundingClientRect();
        const parent = gomokuCanvas.parentElement.getBoundingClientRect();
        return { backing: gomokuCanvas.width, clientW: gomokuCanvas.clientWidth, dispW: Math.round(r.width), dispH: Math.round(r.height), parentW: Math.round(parent.width), stable: sizes.every(s => s === sizes[0]) };
    });
    // NOTE: rect width includes the 4px canvas border (border-box); the backing
    // derives from clientWidth (content box), so assert against clientW.
    const gomokuOk = gomoku.stable && gomoku.dispW <= 601 && gomoku.dispW <= gomoku.parentW + 1 &&
        Math.abs(gomoku.backing - gomoku.clientW * cap) <= 2 * cap && Math.abs(gomoku.dispW - gomoku.dispH) <= 2;

    // --- VS ---
    await p.evaluate(() => showGameSelection());
    await p.waitForTimeout(300);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2500);
    const vs = await p.evaluate(() => {
        const s = game.scene.getScene('MainScene');
        const r = game.canvas.getBoundingClientRect();
        return { backing: [game.canvas.width, game.canvas.height], dispScale: +game.scale.displayScale.y.toFixed(2), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], camZoom: +s.cameras.main.zoom.toFixed(3) };
    });
    const fit = Math.min(1, Math.max(0.4, prof.w / 800));
    const vsOk = vs.backing[0] === prof.w * cap && vs.dispScale === cap && vs.rect[2] === prof.w && vs.rect[3] === prof.h &&
        Math.abs(vs.camZoom - fit * cap) < 0.01;

    // --- UNO (after VS = worst-case path) ---
    await p.evaluate(() => showGameSelection());
    await p.waitForTimeout(300);
    await p.evaluate(() => triggerUno());
    await p.waitForTimeout(3000);
    const uno = await p.evaluate(() => {
        const s = game.scene.getScene('UnoScene');
        const c = game.canvas;
        const cont = document.getElementById('uno-phaser-container').getBoundingClientRect();
        const r = c.getBoundingClientRect();
        const cssW = c.width / (typeof vsDpr === 'function' ? vsDpr() : 1);
        const cssH = c.height / (typeof vsDpr === 'function' ? vsDpr() : 1);
        let inView = 0, total = 0;
        (s.cardSprites || []).forEach(cs => { total++; if (cs.x >= -60 && cs.x <= cssW + 60 && cs.y >= -60 && cs.y <= cssH + 60) inView++; });
        return { backing: [c.width, c.height], rectW: Math.round(r.width), contW: Math.round(cont.width), total, inView, camZoom: s.cameras.main ? +s.cameras.main.zoom.toFixed(2) : null };
    });
    const unoOk = uno.total > 0 && uno.inView === uno.total && Math.abs(uno.rectW - uno.contW) <= 10 && uno.camZoom === cap;

    await b.close();
    return { profile: prof.name, dsf: prof.dsf, gomoku, gomokuOk, vs, vsOk, uno, unoOk, errs, PASS: gomokuOk && vsOk && unoOk && errs.length === 0 };
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
