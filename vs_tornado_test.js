// One-off: tornado visibility/size + cold + book AOE-every-hit checks.
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const path = require('path');
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const p = await b.newPage({ viewport: { width: 720, height: 560 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
        const s = game.scene.getScene('MainScene');
        // Cold: apply eraser L2 and read chillPow
        const cold = { L2: null };
        const e0 = s.enemies.getChildren().find(x => x.active);
        // Book AOE-every-hit: fire an L4 book, drop 2 enemies onto it, step
        s.bullets.clear(true, true);
        s.fireAxe({ type: 'axe', level: 4, timer: 0, cooldown: 140 });
        const book = s.bullets.getChildren()[0];
        book.body.setVelocity(0, 0); book.body.setGravity(0, 0);
        const es = s.enemies.getChildren().filter(x => x.active).slice(0, 2);
        let ringCount = 0;
        // hook: count graphics created around AOE by diffing before/after each step
        es.forEach(en => {
            en.body.setVelocity(0, 0); en.body.reset(book.x, book.y);
            const before = s.children.list.filter(o => o.type === 'Graphics').length;
            s.physics.world.step(0.016);
            const after = s.children.list.filter(o => o.type === 'Graphics').length;
            if (after > before) ringCount++;
            en.x = 9999; en.y = 9999; // move away so next enemy is the fresh hit
        });
        // Tornado spawn + size
        s.spawnTornado();
        const tn = s.activeTornados[s.activeTornados.length - 1];
        const spr = tn.spriteImg;
        const dispPx = Math.round(spr.displayWidth);
        return {
            bookAoeRings: ringCount, bookScale: +book.scaleX.toFixed(2),
            tornadoDisplayPx: dispPx, tornadoCore: tn.body.radius,
            hasBackdrop: !!tn.backdrop, tint: spr.tintTopLeft
        };
    });
    await p.waitForTimeout(900); // let whirlwind + backdrop render
    await p.evaluate(() => { document.querySelectorAll('body > *').forEach(el => { if (el.tagName !== 'CANVAS' && !el.querySelector('canvas')) el.style.visibility = 'hidden'; }); });
    await p.waitForTimeout(300);
    const shot = path.resolve(__dirname, 'vs_tornado_shot.png');
    await p.screenshot({ path: shot });
    await b.close();
    console.log(JSON.stringify({ r, errs, shot }, null, 1));
    process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
