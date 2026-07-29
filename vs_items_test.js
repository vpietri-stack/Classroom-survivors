// One-off VS item-sprite smoke test: boots VS, grants all weapons at high
// level, spawns pickups + XP stars, screenshots, reports console errors.
const { chromium } = require('playwright-core');
const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

    await page.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    // Boot straight into VS
    await page.evaluate(() => { triggerVampireSurvivors(); });
    await page.waitForTimeout(2500);

    const state = await page.evaluate(() => {
        const scene = game && game.scene ? game.scene.getScene('MainScene') : null;
        if (!scene || !scene.textures) return { booted: false };
        const items = ['ruler', 'plane', 'scissors', 'eraser', 'balloon', 'book', 'triangle', 'tornado', 'magnet', 'milk', 'star'];
        const loaded = items.filter(n => scene.textures.exists('item_' + n));
        // Grant every weapon at level 5 so level effects render
        ['wand', 'orb', 'axe', 'cross', 'knife', 'water'].forEach(id => {
            for (let i = 0; i < 5; i++) scene.applyReward({ id, name: id, type: 'weapon' });
        });
        // Force pickups + XP stars on screen
        scene.spawnPowerUp(scene.player.x + 120, scene.player.y - 60);
        scene.spawnXpGem(scene.player.x - 100, scene.player.y + 60, 5);
        scene.spawnXpGem(scene.player.x - 60, scene.player.y + 90, 15);
        return { booted: true, loaded, weapons: scene.playerStats.weapons.map(w => w.type + ':' + w.level) };
    });
    await page.waitForTimeout(3000); // let weapons fire a few volleys

    // Hide DOM overlays (login etc.) so the screenshot shows the canvas
    await page.evaluate(() => {
        document.querySelectorAll('body > *').forEach(el => {
            if (el.tagName !== 'CANVAS' && !el.querySelector('canvas')) el.style.visibility = 'hidden';
        });
    });
    await page.waitForTimeout(400);

    const shot = path.resolve(__dirname, 'vs_items_shot.png');
    await page.screenshot({ path: shot });
    await browser.close();
    console.log(JSON.stringify({ errors, state, screenshot: shot }, null, 2));
    process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
