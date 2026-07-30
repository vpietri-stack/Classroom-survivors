// One-off: verify all sampled SFX decode + every hook plays without error.
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    const p = await b.newPage({ viewport: { width: 800, height: 600 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(3500); // let all buffers decode

    const out = await p.evaluate(async () => {
        const names = ['sword-slash', 'sword-hit', 'jump_rope_fireball_hit', 'electric_arc_hit',
            'paper_plane_travelling', 'paper_plane_hit', 'book_travelling',
            'scissors_travelling', 'tornado', 'zombie_death', 'bat_death'];
        const decoded = {};
        names.forEach(n => {
            const v = _sfxBuffers['sfx/' + n + '.mp3'];
            decoded[n] = !!(v && v !== 'loading' && v !== false);
        });
        const s = game.scene.getScene('MainScene');
        s.enemies.getChildren().forEach(e => e.destroy());
        const r = {};
        // Launch sounds
        const w = { type: 'wand', level: 5, timer: 0, cooldown: 60 };
        const e0 = s.createEnemyAt(s.player.x + 120, s.player.y, 0);
        s.fireWand(w);
        s.fireAxe({ type: 'axe', level: 3, timer: 0, cooldown: 140 });
        s.fireKnife({ type: 'knife', level: 3, timer: 0, cooldown: 60 });
        s.spawnTornado();
        // Death sounds: force a zombie + a bat to die
        const z = s.createEnemyAt(s.player.x, s.player.y - 60, 2);
        const bat = s.createEnemyAt(s.player.x, s.player.y + 60, 1);
        r.zType = z.enemyType; r.batIsBat = bat.isBat;
        s.damageEnemy(z, 9999); s.damageEnemy(bat, 9999);
        // Play each sample directly (returns true when a buffer is ready)
        const played = {};
        names.forEach(n => { played[n] = playSfxSample('sfx/' + n + '.mp3', 0.4); });
        return { decoded, played, r };
    });

    await b.close();
    console.log(JSON.stringify(out, null, 1));
    console.log('ERRORS', JSON.stringify(errs));
    const allDecoded = Object.values(out.decoded).every(Boolean);
    process.exit(errs.length || !allDecoded ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
