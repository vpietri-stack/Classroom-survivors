// Verify the two HiDPI regressions are fixed:
//  1) VS joystick works (real mouse drag in the lower half moves the player)
//  2) UNO cards are visible after playing VS first (and match UNO-first)
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function cardStats(page) {
    return page.evaluate(() => {
        const s = game.scene.getScene('UnoScene');
        if (!s || !s.cardSprites) return { total: 0, visible: 0, inBounds: 0 };
        const W = s.scale.width, H = s.scale.height;
        let visible = 0, inBounds = 0;
        s.cardSprites.forEach(c => {
            const vis = c.visible !== false && (c.alpha === undefined || c.alpha > 0.05);
            if (vis) visible++;
            const x = c.x, y = c.y;
            if (vis && x >= -50 && x <= W + 50 && y >= -50 && y <= H + 50) inBounds++;
        });
        return { total: s.cardSprites.length, visible, inBounds, W: Math.round(W), H: Math.round(H) };
    });
}

async function scenario(label, unoFirst) {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await b.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const out = { label };

    if (!unoFirst) {
        await p.evaluate(() => triggerVampireSurvivors());
        await p.waitForTimeout(2500);
        out.vs = await p.evaluate(() => {
            const sm = game.scale, s = game.scene.getScene('MainScene');
            const r = game.canvas.getBoundingClientRect();
            return { displayScaleY: sm.displayScale ? +sm.displayScale.y.toFixed(2) : 'n/a', rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], camZoom: +s.cameras.main.zoom.toFixed(3) };
        });
        // Real mouse drag in the lower half to drive the joystick
        // (hide non-canvas DOM overlays first so the login screen can't eat the click)
        await p.evaluate(() => { document.querySelectorAll('body > div').forEach(d => { if (!d.querySelector('canvas')) d.style.display = 'none'; }); });
        const before = await p.evaluate(() => { const s = game.scene.getScene('MainScene'); return { x: s.player.x, y: s.player.y }; });
        await p.mouse.move(200, 720);
        await p.mouse.down();
        await p.mouse.move(200, 600, { steps: 6 });
        await p.mouse.move(260, 560, { steps: 6 });
        await p.waitForTimeout(500);
        const during = await p.evaluate(() => { const s = game.scene.getScene('MainScene'); return { active: !!(s.joystick && s.joystick.active), x: s.player.x, y: s.player.y }; });
        await p.mouse.up();
        out.joystick = { active: during.active, moved: Math.round(Math.hypot(during.x - before.x, during.y - before.y)) };
        // Restore the overlays we hid (so UNO's container can size correctly)
        await p.evaluate(() => { document.querySelectorAll('body > div').forEach(d => { d.style.display = ''; }); });
    }

    // Launch UNO and let it deal
    await p.evaluate(() => triggerUno());
    await p.waitForTimeout(3500);
    out.uno = await cardStats(p);
    out.errs = errs;
    await b.close();
    return out;
}

(async () => {
    const vsThenUno = await scenario('VS -> UNO', false);
    console.log(JSON.stringify(vsThenUno, null, 1));
    const unoFirst = await scenario('UNO first (control)', true);
    console.log(JSON.stringify(unoFirst, null, 1));
    const ok =
        vsThenUno.vs.displayScaleY === 2 &&
        vsThenUno.vs.rect[0] === 0 && vsThenUno.vs.rect[1] === 0 && vsThenUno.vs.rect[2] === 414 &&
        vsThenUno.joystick.active === true && vsThenUno.joystick.moved > 5 &&
        vsThenUno.uno.visible > 0 && vsThenUno.uno.inBounds === vsThenUno.uno.visible &&
        unoFirst.uno.visible > 0 &&
        vsThenUno.errs.length === 0 && unoFirst.errs.length === 0;
    console.log('RESULT', ok ? 'PASS' : 'FAIL');
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
