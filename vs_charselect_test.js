// One-off: verify character select + exclusive weapons + new Ruler slash/arc.
// 1) Default hero = Class Monitor, starts with 'ruler', puppet uses p_body
// 2) Ruler L1: slash damages a close frontal enemy, NO arc projectile
// 3) Ruler L2: arc projectile spawns, downrange enemy gets chip dmg + freeze
// 4) Level-up pool for monitor NEVER offers Jump Rope
// 5) Switch to Skippy (restart): starts with 'whip', puppet uses sk_body,
//    pool never offers the Ruler (checked by its unique 📏 icon)
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

    const monitor = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        const out = {};
        out.charId = s.character.id;
        out.startWeapon = s.playerStats.weapons[0].type;
        out.bodyTex = s.playerParts ? s.playerParts.body.texture.key : null;
        out.fxArc = s.textures.exists('fx_arc');

        // L1 slash: enemy 80px in front (facing right by default scaleX>0)
        s.enemies.getChildren().forEach(e => e.destroy());
        const e1 = s.createEnemyAt(s.player.x + 80, s.player.y);
        const hp0 = e1.hp;
        const w = s.playerStats.weapons[0];
        s.fireRuler(w);
        out.l1Hit = e1.hp < hp0;
        out.l1Arc = s.bullets.getChildren().some(x => x.type === 'rulerarc');

        // L2: arc spawns and freezes a downrange enemy
        w.level = 2;
        const e2 = s.createEnemyAt(s.player.x + 260, s.player.y);
        const hp2 = e2.hp;
        s.fireRuler(w);
        out.l2Arc = s.bullets.getChildren().some(x => x.type === 'rulerarc');
        await new Promise(r => setTimeout(r, 700));
        out.l2ArcHit = e2.active === false || e2.hp < hp2;
        out.l2Stunned = (e2.stunTimer || 0) > 0 || !!e2._zapUntil;

        // applyReward: ruler cooldown drops at L5 (level 4 -> 5)
        w.level = 4;
        s.applyReward({ id: 'ruler', type: 'weapon' });
        out.l5Cooldown = w.cooldown;

        // Monitor's pool must never contain the Jump Rope
        let sawRope = false;
        for (let i = 0; i < 15; i++) {
            showPowerUpSelection('levelup');
            const txt = document.getElementById('powerup-cards-container').innerText;
            if (txt.includes('Jump Rope')) sawRope = true;
        }
        document.getElementById('levelUpMenu').classList.add('hidden');
        out.poolHasJumpRope = sawRope;
        return out;
    });

    // Switch hero to Skippy and restart the scene
    const skippy = await p.evaluate(async () => {
        window.vsSelectedCharacter = 'skippy';
        const s0 = game.scene.getScene('MainScene');
        s0.scene.restart();
        await new Promise(r => setTimeout(r, 1800));
        const s = game.scene.getScene('MainScene');
        const out = {};
        out.charId = s.character.id;
        out.startWeapon = s.playerStats.weapons[0].type;
        out.bodyTex = s.playerParts ? s.playerParts.body.texture.key : null;
        // Skippy's pool must never contain the Ruler card (unique 📏 icon)
        let sawRuler = false;
        for (let i = 0; i < 15; i++) {
            showPowerUpSelection('levelup');
            const txt = document.getElementById('powerup-cards-container').innerText;
            if (txt.includes('📏')) sawRuler = true;
        }
        document.getElementById('levelUpMenu').classList.add('hidden');
        out.poolHasRuler = sawRuler;
        return out;
    });

    // Menu wiring exists
    const menu = await p.evaluate(() => {
        const el = document.getElementById('vsCharSelect');
        selectVsCharacter('skippy');
        return {
            overlay: !!el,
            skSelected: document.getElementById('vsCharSkippy').classList.contains('vs-char-selected'),
            weaponText: document.getElementById('vsCharWeapon').textContent,
            iconSrc: document.getElementById('vsCharWeaponIcon').getAttribute('src')
        };
    });

    await b.close();
    console.log(JSON.stringify({ monitor, skippy, menu }, null, 1));
    console.log('ERRORS', JSON.stringify(errs));
    process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
