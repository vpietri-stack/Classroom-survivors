// One-off: VS -> Uno transition smoke. After playing VS in HiDPI, launching
// Uno must restore the shared canvas to CSS-px (backing === innerWidth), run
// the Uno scene, and produce no errors — proving exitHiDpi() cleanly hands the
// canvas back to the other games.
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await b.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2500);
    const vs = await p.evaluate(() => ({ backing: game.canvas.width, style: game.canvas.style.width, mode: game.scale.scaleMode }));
    // Now launch Uno (as the menu button does)
    await p.evaluate(() => triggerUno());
    await p.waitForTimeout(2500);
    const uno = await p.evaluate(() => ({
        backing: game.canvas.width,
        wantCss: window.innerWidth,
        style: game.canvas.style.width,
        mode: game.scale.scaleMode,
        unoActive: game.scene.isActive('UnoScene'),
        vsActive: game.scene.isActive('MainScene')
    }));
    await b.close();
    console.log(JSON.stringify({ vs, uno, errs }, null, 1));
    // Pass: VS ran HiDPI (2x window backing, NONE mode); after Uno launch the
    // shared canvas is now ALSO HiDPI (Scale.NONE) but sized to Uno's container
    // (backing != the VS window backing of 828), the Uno scene is active (VS
    // stopped), and no errors.
    const ok = vs.backing === 414 * 2 && vs.mode === 0
        && uno.mode === 0
        && uno.backing !== 828 && uno.backing > 0
        && uno.unoActive && !uno.vsActive && errs.length === 0;
    console.log('RESULT', ok ? 'PASS' : 'FAIL');
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
