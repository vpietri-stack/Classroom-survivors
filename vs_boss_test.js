// One-off: verify boss progression — backpack regular boss, 10-min final
// bucket boss (mega), win flow (victory menu), and post-win alternation.
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
    const out = {};

    // 1) Regular boss (300 kills, pre-win) = backpack
    out.regular = await p.evaluate(() => {
        const s = game.scene.getScene('MainScene');
        s.killCount = 300; s.spawnEnemy();
        const boss = s.enemies.getChildren().find(e => e.isBoss);
        return { tex: boss.texture.key, isFinal: !!boss.isFinal, dmgMult: boss.dmgMult, hp: Math.round(boss.hp) };
    });

    // 2) Final boss at 10 min: force accumulatedTime, let update() trigger it
    out.final = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        s.enemies.getChildren().forEach(e => e.destroy());
        s.accumulatedTime = 600001;
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));
        const boss = s.enemies.getChildren().find(e => e.isBoss);
        const reg = s.enemies.getChildren().find(e => !e.isBoss);
        return { spawned: !!boss, tex: boss && boss.texture.key, isFinal: !!(boss && boss.isFinal), dmgMult: boss && boss.dmgMult, texScale: boss && boss.texScale, hp: boss && Math.round(boss.hp) };
    });

    // 3) Kill final boss -> win flow (victory menu visible, wonGame true)
    out.win = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        const boss = s.enemies.getChildren().find(e => e.isFinal);
        s.damageEnemy(boss, boss.hp + 999, 0);
        await new Promise(r => setTimeout(r, 800));
        const menu = document.getElementById('vsVictoryMenu');
        return { wonGame: s.wonGame, menuVisible: menu && !menu.classList.contains('hidden'), paused: !s.scene.isActive() };
    });

    // 4) Continue -> resume, then post-win 300-kill bosses alternate bp/bucket
    out.postWin = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        s.victoryContinue();
        await new Promise(r => requestAnimationFrame(r));
        const kinds = [];
        for (let i = 0; i < 3; i++) {
            s.enemies.getChildren().filter(e => e.isBoss).forEach(e => e.destroy());
            s.killCount = 300; s.spawnEnemy();
            const boss = s.enemies.getChildren().find(e => e.isBoss);
            kinds.push(boss.texture.key.replace('enemy_', '').replace('_walk_a', ''));
        }
        return { resumed: s.scene.isActive(), gameState: s.gameState, kinds };
    });

    await b.close();
    console.log(JSON.stringify(out, null, 1));
    console.log('ERRORS', JSON.stringify(errs));
    process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
