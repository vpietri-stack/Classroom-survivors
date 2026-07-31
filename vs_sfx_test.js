// One-off: confirm the new weapon SFX functions exist and run without error.
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    const p = await b.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { initAudio(); triggerVampireSurvivors(); });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        ['wand', 'orb', 'axe', 'cross', 'knife', 'water'].forEach(id => {
            for (let i = 0; i < 5; i++) s.applyReward({ id, name: id, type: 'weapon' });
        });
        const fns = ['synthSwoosh', 'synthPlaneHit', 'synthStab', 'synthRicochet', 'synthSmash', 'synthEraserPass', 'synthPageFlutter', 'synthBombFall', 'synthSplash'];
        try {
            synthSwoosh('plane'); synthSwoosh('scissors'); synthSwoosh('cross');
            synthPlaneHit(); synthStab(); synthRicochet(); synthSmash();
            synthEraserPass(); synthPageFlutter(); synthBombFall(); synthSplash();
        } catch (e) { return { callError: e.message }; }
        await new Promise(r => setTimeout(r, 2500)); // let weapons fire live for a few volleys
        return { acState: audioCtx ? audioCtx.state : 'null', calledOK: true };
    });
    await b.close();
    console.log(JSON.stringify({ r, errs }, null, 1));
    process.exit(errs.length || r.callError ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
