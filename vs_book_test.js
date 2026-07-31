// One-off: verify book count per level + AOE fires with a visible ring.
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const p = await b.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
        const s = game.scene.getScene('MainScene');
        // Count books fired per volley at each level
        const counts = {};
        [1, 2, 3, 5, 7, 9].forEach(L => {
            s.bullets.clear(true, true);
            s.fireAxe({ type: 'axe', level: L, timer: 0, cooldown: 140 });
            const books = s.bullets.getChildren().filter(x => x.type === 'axe');
            counts[L] = { n: books.length, vy: Math.round(books[0].body.velocity.y), scale: +books[0].scaleX.toFixed(2) };
        });
        // AOE: put an enemy on a book and step physics so the overlap fires
        s.bullets.clear(true, true);
        const graphicsBefore = s.children.list.filter(o => o.type === 'Graphics').length;
        s.fireAxe({ type: 'axe', level: 4, timer: 0, cooldown: 140 });
        const book = s.bullets.getChildren()[0];
        // Freeze the book so it can't fly away before the overlap resolves
        book.body.setVelocity(0, 0); book.body.setGravity(0, 0);
        const e = s.enemies.getChildren().find(x => x.active);
        if (e) { e.body.setVelocity(0, 0); e.body.reset(book.x, book.y); }
        for (let i = 0; i < 4; i++) s.physics.world.step(0.016);
        const graphicsAfter = s.children.list.filter(o => o.type === 'Graphics').length;
        return { counts, aoeRingAppeared: graphicsAfter > graphicsBefore, bookHitAoeDone: !!(book && book.aoeDone) };
    });
    await b.close();
    console.log(JSON.stringify({ r, errs }, null, 1));
    process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
