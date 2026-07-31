// One-off: verify anti-flee (fence push-back + enemy wall) and star magnet.
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
    // Onboarding power-up should have spawned near the player by now (500ms delay)
    const onboarding = await p.evaluate(() => {
        const s = game.scene.getScene('MainScene');
        const pu = s.powerUps.getChildren();
        if (!pu.length) return { spawned: false };
        const d = Math.hypot(pu[0].x - s.player.x, pu[0].y - s.player.y);
        return { spawned: true, count: pu.length, dist: Math.round(d) };
    });
    const r = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        const out = {};
        out.hasFence = !!s.fenceGfx;
        out.arenaR = s.arenaRadius;
        // Fence push-back: teleport player well outside the arena, run updateAntiFlee, read inward velocity
        const ac = s.arenaCenter;
        s.player.x = ac.x + s.arenaRadius + 120; s.player.y = ac.y;
        s.player.body.setVelocity(160, 0); // pushing further out (east)
        s.updateAntiFlee(1, 0);
        out.vxAfterFence = Math.round(s.player.body.velocity.x); // should be pushed negative (inward)
        // Enemy wall: record count, simulate sustained flee, expect a wall to appear
        const before = s.enemies.getChildren().length;
        s.wallCooldown = 0; s.fleeTimer = 0; s.fleeHeading = { x: 1, y: 0 };
        for (let i = 0; i < 170; i++) s.updateAntiFlee(1, 0); // steady east flee
        const after = s.enemies.getChildren().length;
        out.wallAdded = after - before;
        // Star magnet: reset player to arena center at rest, drop a star 300px
        // away (inside the new 450 radius), let the REAL loop run, expect it to
        // be pulled in (moved closer or collected). Manual world.step outside
        // the RAF loop doesn't integrate velocity, so use awaited real time.
        s.player.x = ac.x; s.player.y = ac.y; s.player.body.setVelocity(0, 0);
        const gem = s.spawnXpGem(s.player.x + 300, s.player.y, 5);
        window.__gem = gem; window.__scene = s;
        out.starScale = +gem.scaleX.toFixed(2);
        out.starD0 = 300;
        await new Promise(r => setTimeout(r, 500)); // real game loop pulls the star
        out.starActive = gem.active;
        out.starD1 = gem.active ? Math.round(Math.hypot(gem.x - s.player.x, gem.y - s.player.y)) : 0;
        out.starPulledOrCollected = !gem.active || out.starD1 < out.starD0;
        return out;
    });
    await b.close();
    console.log(JSON.stringify({ r, onboarding, errs }, null, 1));
    process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
