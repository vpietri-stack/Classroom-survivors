// ============================================================
// TD CORE VERIFICATION — focused check for tower_defense.js
// Addresses better-harness finding "core-validation-gap":
// exercises the core game behaviors (boot state, tower economy,
// upgrades, difficulty phases, enemy lifecycle, school damage
// and game over) and returns a clear pass/fail exit code.
// Run:  node test_td_core.js   (or: npm run test:td)
// ============================================================
const { chromium } = require('playwright-core');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fileUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS: ' + m); } else { fail++; console.error('FAIL: ' + m); } }

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-web-security', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 800 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(() => triggerTowerDefense());
  // Poll for scene readiness instead of a fixed 800ms sleep — boot time varies
  // with page weight (e.g. the always-on speech debug panel) and machine load.
  await page.waitForFunction(() => {
    const s = (typeof game !== 'undefined') && game && game.scene.getScene('TowerDefenseScene');
    return !!(s && s.layout);
  }, { timeout: 15000 }).catch(() => {});

  // ---- 1) BOOT: scene exists with correct initial state ----
  const boot = await page.evaluate(() => {
    const s = game && game.scene.getScene('TowerDefenseScene');
    if (!s || !s.layout) return null;
    s.spawnTimer.paused = true; // freeze auto-spawn so counts stay deterministic
    return {
      coins: s.coins, baseHp: s.baseHp, towers: s.towers.length,
      enemies: s.enemies.length, gameOver: s.gameOver,
      cols: TD_COLS, rows: TD_ROWS
    };
  });
  ok(boot !== null, 'boot: TowerDefenseScene is running');
  ok(boot && boot.coins === 75, 'boot: starting coins = 75');
  ok(boot && boot.baseHp === 20, 'boot: starting base HP = 20');
  ok(boot && boot.towers === 0 && boot.gameOver === false, 'boot: no towers, not game over');

  // ---- 2) TOWER ECONOMY: place deducts cost, occupies cell, rejects invalid ----
  const econ = await page.evaluate(() => {
    const s = game.scene.getScene('TowerDefenseScene');
    const before = s.coins;
    s.placeTower('pencil', 1, 5);
    const placed = { coins: s.coins, towers: s.towers.length, occ: !!s.occupied['1,5'] };
    s.placeTower('pencil', 1, 5); // same cell -> must be rejected
    const dup = { coins: s.coins, towers: s.towers.length };
    const savedCoins = s.coins;
    s.coins = 0;
    s.placeTower('firedrill', 2, 5); // cost 60, can't afford -> rejected
    const broke = { towers: s.towers.length };
    s.coins = savedCoins;
    return { before, placed, dup, broke, cost: TD_TOWERS.pencil.cost };
  });
  ok(econ.placed.coins === econ.before - econ.cost, 'economy: placing pencil deducts its cost');
  ok(econ.placed.towers === 1 && econ.placed.occ, 'economy: tower registered and cell occupied');
  ok(econ.dup.towers === 1 && econ.dup.coins === econ.placed.coins, 'economy: duplicate cell placement rejected');
  ok(econ.broke.towers === 1, 'economy: unaffordable tower rejected');

  // ---- 3) UPGRADES: level up costs coins, capped at max, oneTime blocked ----
  const upg = await page.evaluate(() => {
    const s = game.scene.getScene('TowerDefenseScene');
    const t = s.towers[0];
    s.coins = 1000;
    const lvl1 = t.level;
    s.tryUpgrade(t);
    const afterOne = { level: t.level, coins: s.coins };
    s.tryUpgrade(t); // -> level 3 (max)
    s.tryUpgrade(t); // must be a no-op at max level
    const afterMax = { level: t.level };
    // one-time tower can never upgrade
    s.placeTower('trap', 3, 5);
    const trap = s.occupied['3,5'];
    s.tryUpgrade(trap);
    return { lvl1, afterOne, afterMax, maxLevel: TD_MAX_LEVEL,
             expectCost: Math.round(TD_TOWERS.pencil.cost * Math.pow(1.5, lvl1)),
             trapLevel: trap.level };
  });
  ok(upg.afterOne.level === upg.lvl1 + 1, 'upgrade: level increments');
  ok(upg.afterOne.coins === 1000 - upg.expectCost, 'upgrade: correct cost deducted');
  ok(upg.afterMax.level === upg.maxLevel, 'upgrade: capped at TD_MAX_LEVEL');
  ok(upg.trapLevel === 1, 'upgrade: one-time tower cannot be upgraded');

  // ---- 4) DIFFICULTY PHASES: escalate with elapsed time ----
  const phases = await page.evaluate(() => {
    const s = game.scene.getScene('TowerDefenseScene');
    const at = (ms) => { s.elapsed = ms; const p = s.getPhase(); return { interval: p.interval, hpMult: p.hpMult, types: p.types.length }; };
    const r = { p0: at(0), p90: at(90000), p400: at(400000) };
    s.elapsed = 0;
    return r;
  });
  ok(phases.p0.interval > phases.p90.interval && phases.p90.interval > phases.p400.interval,
     'phases: spawn interval shrinks over time (' + phases.p0.interval + ' > ' + phases.p90.interval + ' > ' + phases.p400.interval + ')');
  ok(phases.p0.hpMult < phases.p90.hpMult && phases.p90.hpMult < phases.p400.hpMult,
     'phases: enemy HP multiplier grows over time');
  ok(phases.p400.types > phases.p0.types, 'phases: more enemy types unlock later');

  // ---- 5) ENEMY LIFECYCLE: spawn, kill, earn coins ----
  const life = await page.evaluate(() => {
    const s = game.scene.getScene('TowerDefenseScene');
    const phase = s.getPhase();
    const beforeEnemies = s.enemies.length;
    s.spawnOneEnemy(phase);
    const e = s.enemies[s.enemies.length - 1];
    const spawned = { count: s.enemies.length - beforeEnemies, hp: e.hp, type: e.type };
    const coinsBefore = s.coins, killsBefore = s.zombiesKilled;
    s.damageEnemy(e, 99999, 0);
    return { spawned, reward: e.coins, coinsGained: s.coins - coinsBefore,
             kills: s.zombiesKilled - killsBefore, downed: !!(e.dead || e.dying) };
  });
  ok(life.spawned.count === 1 && life.spawned.hp > 0, 'enemy: spawnOneEnemy adds a live enemy (' + life.spawned.type + ')');
  ok(life.downed && life.kills === 1, 'enemy: lethal damage kills and counts the kill');
  ok(life.coinsGained === life.reward, 'enemy: kill awards the enemy coin bounty');

  // ---- 6) SCHOOL DAMAGE + GAME OVER ----
  const over = await page.evaluate(() => {
    const s = game.scene.getScene('TowerDefenseScene');
    // Non-animated path: instant damage on reaching the school
    s.spawnOneEnemy(s.getPhase());
    let e = s.enemies[s.enemies.length - 1];
    e.hasAnim = false;
    const hpBefore = s.baseHp, dmg = e.dmg;
    s.enemyReachSchool(e, s.enemies.indexOf(e));
    const hpAfter = s.baseHp;
    // Force game over via a final hit
    s.baseHp = 1;
    s.spawnOneEnemy(s.getPhase());
    e = s.enemies[s.enemies.length - 1];
    e.hasAnim = false;
    s.enemyReachSchool(e, s.enemies.indexOf(e));
    const goScreen = document.getElementById('tdGameOverScreen');
    const hud = document.getElementById('tdHUD');
    return { hpBefore, dmg, hpAfter, gameOver: s.gameOver,
             goVisible: goScreen ? !goScreen.classList.contains('hidden') : false,
             hudHidden: hud ? hud.classList.contains('hidden') : false };
  });
  ok(over.hpAfter === over.hpBefore - over.dmg, 'school: breach reduces base HP by enemy damage');
  ok(over.gameOver === true, 'game over: baseHp reaching 0 ends the game');
  ok(over.goVisible === true, 'game over: tdGameOverScreen is shown');
  ok(over.hudHidden === true, 'game over: tdHUD is hidden');

  await browser.close();

  // Console/page errors from the TD code itself are failures. Ignore benign
  // file:// resource noise (favicons, API fetches that need a server).
  const realErrors = errors.filter(t =>
    !/net::ERR_|Failed to load resource|Failed to fetch|ERR_FILE_NOT_FOUND/i.test(t));
  ok(realErrors.length === 0, 'runtime: no JS errors (' + (realErrors.length ? realErrors.join(' | ') : 'clean') + ')');

  console.log('\n--- TD CORE ---\n' + pass + ' passed, ' + fail + ' failed');
  console.log('RESULT:', fail === 0 ? 'PASS' : 'FAIL');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('CRASH:', e); process.exit(2); });
