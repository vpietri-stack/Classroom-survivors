// One-off: verify enemy bodies now cover the drawn sprites (esp. dropout head)
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const p = await b.newPage({ viewport: { width: 800, height: 600 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2500);
    const r = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        s.enemies.getChildren().forEach(e => e.destroy());
        const out = {};
        const types = ['rat', 'bat', 'zombie'];
        for (let t = 0; t < 3; t++) {
            const e = s.createEnemyAt(s.player.x + 200 + t * 120, s.player.y, t);
            await new Promise(r2 => setTimeout(r2, 60));
            const spriteTop = e.y - e.displayHeight / 2;
            const spriteBot = e.y + e.displayHeight / 2;
            out[types[t]] = {
                frame: e.width + 'x' + e.height,
                bodyR: Math.round(e.body.halfWidth),
                headGapPx: Math.round(e.body.top - spriteTop),
                footGapPx: Math.round(spriteBot - e.body.bottom)
            };
        }
        // Functional: a static "scissors" bullet parked ON the zombie's head
        const z = s.createEnemyAt(s.player.x - 250, s.player.y, 2);
        await new Promise(r2 => setTimeout(r2, 60));
        const headY = z.y - z.displayHeight * 0.38;
        const k = s.add.circle(z.x, headY, 4, 0xffffff, 0);
        s.bullets.add(k);
        s.physics.add.existing(k);
        k.body.setVelocity(0, 1);
        k.type = 'knife'; k.dmg = 3; k.splitsLeft = 0;
        const hp0 = z.hp;
        await new Promise(r2 => setTimeout(r2, 400));
        out.zombieHeadHit = { hpBefore: Math.round(hp0), hpAfter: Math.round(z.hp), hit: z.hp < hp0 };
        return out;
    });
    console.log(JSON.stringify(r, null, 1));
    console.log('ERRORS', JSON.stringify(errs));
    process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
