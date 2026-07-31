// Repro PC (DPR 1) transition bugs:
//  A) VS -> menu -> UNO : cards "zoomed out" + stretched
//  B) UNO -> menu -> VS : nothing displayed (game runs, sounds play)
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DSF = Number(process.argv[2] || 1);

async function metrics(p, sceneKey) {
    return p.evaluate((sceneKey) => {
        const c = game.canvas;
        const r = c.getBoundingClientRect();
        const s = game.scene.getScene(sceneKey);
        const cont = document.getElementById('uno-phaser-container');
        const cr = cont ? cont.getBoundingClientRect() : null;
        const out = {
            dpr: window.devicePixelRatio,
            scaleMode: game.scale.scaleMode,
            zoomSM: +game.scale.zoom.toFixed(3),
            dispScale: game.scale.displayScale ? [+game.scale.displayScale.x.toFixed(2), +game.scale.displayScale.y.toFixed(2)] : null,
            backing: [c.width, c.height],
            style: [c.style.width, c.style.height],
            rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
            contRect: cr ? [Math.round(cr.left), Math.round(cr.top), Math.round(cr.width), Math.round(cr.height)] : null,
            display: getComputedStyle(c).display,
            parentId: c.parentElement ? (c.parentElement.id || c.parentElement.tagName) : null,
            sceneActive: s ? s.scene.isActive() : false,
            camZoom: s && s.cameras && s.cameras.main ? +s.cameras.main.zoom.toFixed(3) : null,
            camScroll: s && s.cameras && s.cameras.main ? [Math.round(s.cameras.main.scrollX), Math.round(s.cameras.main.scrollY)] : null
        };
        if (sceneKey === 'UnoScene' && s && s.deckSprite) {
            out.deckDisp = [Math.round(s.deckSprite.displayWidth), Math.round(s.deckSprite.displayHeight)];
        }
        return out;
    }, sceneKey);
}

function hideOverlaysKeep(p, keepId) {
    return p.evaluate((keepId) => {
        const keep = document.getElementById(keepId);
        document.querySelectorAll('body > div').forEach(d => {
            if (d !== keep && !(keep && d.contains(keep)) && !d.querySelector('canvas')) d.style.display = 'none';
        });
    }, keepId);
}

(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await b.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);

    // A) VS -> menu -> UNO
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2500);
    await p.evaluate(() => showGameSelection());
    await p.waitForTimeout(400);
    await p.evaluate(() => triggerUno());
    await p.waitForTimeout(3000);
    console.log('A VS->menu->UNO', JSON.stringify(await metrics(p, 'UnoScene')));
    await hideOverlaysKeep(p, 'unoScreen');
    await p.screenshot({ path: 'repro_a_uno.png' });

    // B) UNO -> menu -> VS (continue in same page: currently in UNO)
    await p.evaluate(() => showGameSelection());
    await p.waitForTimeout(400);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2800);
    console.log('B UNO->menu->VS', JSON.stringify(await metrics(p, 'MainScene')));
    await hideOverlaysKeep(p, 'nothing');
    await p.screenshot({ path: 'repro_b_vs.png' });

    console.log('errs', JSON.stringify(errs));
    await b.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
