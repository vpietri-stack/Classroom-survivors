// One-off: verify boss combat fixes — (1) opacity stays 1 under constant fire,
// (2) boss lunge actually reaches its attack range, (3) frames match state.
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const p = await b.newPage({ viewport: { width: 800, height: 600 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2500);

    // Spawn a regular boss, blast it with 60 hits over ~1s, check alpha
    const opacity = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        s.spawnBoss('backpack');
        const boss = s.enemies.getChildren().find(e => e.isBoss);
        for (let i = 0; i < 60; i++) { s.damageEnemy(boss, 1, 200); await new Promise(r => setTimeout(r, 16)); }
        await new Promise(r => setTimeout(r, 200));
        return { alpha: boss.alpha, hitFlash: !!boss._hitFlash, hp: Math.round(boss.hp) };
    });

    // Measure boss lunge reach: place boss at known dist, force a lunge, sample travel
    const lunge = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        s.enemies.getChildren().forEach(e => e.destroy());
        s.spawnBoss('backpack');
        const boss = s.enemies.getChildren().find(e => e.isBoss);
        boss.y = -600; // park the drop-in far away first
        await new Promise(r => setTimeout(r, 50));
        // Teleport boss 180px from player, force it into a lunge toward player
        boss.x = s.player.x - 180; boss.y = s.player.y;
        boss.attackState = 'windup'; boss.windupUntil = 0;
        const x0 = boss.x;
        // advance ~450ms so the windup->lunge fires and the lunge completes
        await new Promise(r => setTimeout(r, 500));
        return { travelled: Math.round(boss.x - x0), state: boss.attackState };
    });

    await b.close();
    console.log(JSON.stringify({ opacity, lunge, errs }, null, 1));
    process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
