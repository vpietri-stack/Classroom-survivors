// ============================================================
// TOWER DEFENSE GAME MODE (Classroom Survivors)
// Extends Phaser.Scene. Self-registers via registerScene() (boot.js).
// Full-screen, body-parented (like VampireSurvivors). Integrates with the
// existing no-pause ESL minigame system via startMiniGame('spelling','towerdefense')
// and claimReward(success) -> tdCreditCoins(50).
// ============================================================

const TD_CELL = 50;                 // grid cell size in px
const TD_START_COINS = 60;
const TD_START_BASE_HP = 20;
const TD_TOWER_TYPES = {
    shooter: { name: 'Shooter', cost: 20, range: 150, fireRate: 600, damage: 8, color: 0xffe14d, proj: 'dot', slow: 0, splash: 0 },
    slow:    { name: 'Slow',    cost: 25, range: 120, fireRate: 1000, damage: 2, color: 0xff8ad0, proj: 'bubble', slow: 0.5, splash: 0 },
    splash:  { name: 'Splash',  cost: 40, range: 160, fireRate: 1200, damage: 12, color: 0x8d6e3c, proj: 'mortar', slow: 0, splash: 60 }
};
const TD_UPGRADE_MULT = { dmg: 1.6, range: 1.15, rate: 0.85 }; // per level
const TD_ENEMY_TYPES = {
    basic: { hp: 30, speed: 60, color: 0xffffff, coins: 3, dmg: 1, emoji: '📄' },
    fast:  { hp: 18, speed: 120, color: 0xffa500, coins: 2, dmg: 1, emoji: '⏱️' },
    tank:  { hp: 120, speed: 35, color: 0x9c27b0, coins: 8, dmg: 3, emoji: '📝' }
};

class TowerDefenseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TowerDefenseScene' });
    }

    create() {
        const W = this.scale.width, H = this.scale.height;
        this.cols = Math.floor(W / TD_CELL);
        this.rows = Math.floor(H / TD_CELL);
        this.gridW = this.cols * TD_CELL;
        this.gridH = this.rows * TD_CELL;

        // --- core state ---
        this.coins = TD_START_COINS;
        this.baseHp = TD_START_BASE_HP;
        this.score = 0;
        this.towers = [];          // {gx, gy, type, level, lastFire, gfx, rangeGfx}
        this.enemies = [];         // Enemy instances
        this.projectiles = [];     // {gfx, x, y, tx, ty, target, speed, damage, slow, splash, scene}
        this.occupied = {};        // "gx,gy" -> tower
        this.elapsed = 0;          // ms since start
        this.gameOver = false;
        this.selected = null;      // selected tower for upgrade

        // --- generate map + path ---
        this.generatePath();
        this.drawMap();

        // --- layers ---
        this.towerLayer = this.add.container(0, 0);
        this.enemyLayer = this.add.container(0, 0);
        this.projLayer = this.add.container(0, 0);

        // --- input: click grass to open build menu, click tower to upgrade ---
        this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));

        // --- spawn loop ---
        this.spawnTimer = this.time.addEvent({
            delay: 1500, loop: true, callback: () => this.spawnEnemy()
        });
        this.spawnTimer.paused = true; // started in startLoop

        // --- HUD + DOM wiring ---
        this.ensureHud();
        this.refreshHud();

        this.startLoop();
    }

    // ---------------------------------------------------------
    // MAP / PATH
    // ---------------------------------------------------------
    generatePath() {
        // Waypoints from a random screen edge to the center, with random turns.
        const cx = Math.floor(this.cols / 2);
        const cy = Math.floor(this.rows / 2);
        const side = Phaser.Math.Between(0, 3);
        let start;
        if (side === 0) start = { gx: Phaser.Math.Between(0, this.cols - 1), gy: 0 };
        else if (side === 1) start = { gx: this.cols - 1, gy: Phaser.Math.Between(0, this.rows - 1) };
        else if (side === 2) start = { gx: Phaser.Math.Between(0, this.cols - 1), gy: this.rows - 1 };
        else start = { gx: 0, gy: Phaser.Math.Between(0, this.rows - 1) };

        const waypoints = [start];
        let cur = { ...start };
        let guard = 0;
        while ((cur.gx !== cx || cur.gy !== cy) && guard++ < 400) {
            // step one cell toward center, occasionally perpendicular for winding
            let nx = cur.gx, ny = cur.gy;
            const dx = Math.sign(cx - cur.gx);
            const dy = Math.sign(cy - cur.gy);
            if (dx !== 0 && dy !== 0) {
                if (Math.random() < 0.5) nx += dx; else ny += dy;
            } else if (dx !== 0) {
                nx += dx;
            } else if (dy !== 0) {
                ny += dy;
            }
            nx = Phaser.Math.Clamp(nx, 0, this.cols - 1);
            ny = Phaser.Math.Clamp(ny, 0, this.rows - 1);
            if (nx !== cur.gx || ny !== cur.gy) {
                cur = { gx: nx, gy: ny };
                waypoints.push({ ...cur });
            } else break;
        }
        if (cur.gx !== cx || cur.gy !== cy) waypoints.push({ gx: cx, gy: cy });

        // mark path cells
        this.pathCells = {};
        this.waypoints = waypoints;
        for (let i = 0; i < waypoints.length - 1; i++) {
            let a = waypoints[i], b = waypoints[i + 1];
            const stepX = Math.sign(b.gx - a.gx), stepY = Math.sign(b.gy - a.gy);
            let x = a.gx, y = a.gy;
            this.pathCells[x + ',' + y] = true;
            while (x !== b.gx || y !== b.gy) {
                if (x !== b.gx) x += stepX;
                else if (y !== b.gy) y += stepY;
                this.pathCells[x + ',' + y] = true;
            }
        }
        // pixel-center waypoints for enemy movement
        this.pathPx = waypoints.map(w => ({
            x: w.gx * TD_CELL + TD_CELL / 2,
            y: w.gy * TD_CELL + TD_CELL / 2
        }));
        this.basePx = this.pathPx[this.pathPx.length - 1];
    }

    drawMap() {
        this.mapGfx = this.add.graphics();
        this.mapGfx.setDepth(-10);
        for (let gx = 0; gx < this.cols; gx++) {
            for (let gy = 0; gy < this.rows; gy++) {
                const isPath = this.pathCells[gx + ',' + gy];
                this.mapGfx.fillStyle(isPath ? 0x8d6e3c : 0x3c8c34, 1);
                this.mapGfx.fillRect(gx * TD_CELL, gy * TD_CELL, TD_CELL, TD_CELL);
                this.mapGfx.lineStyle(1, 0x000000, 0.08);
                this.mapGfx.strokeRect(gx * TD_CELL, gy * TD_CELL, TD_CELL, TD_CELL);
            }
        }
        // base marker
        const b = this.basePx;
        this.mapGfx.fillStyle(0x2196f3, 1);
        this.mapGfx.fillRect(b.x - 22, b.y - 22, 44, 44);
        const baseText = this.add.text(b.x, b.y, '🏫', { fontSize: '32px' }).setOrigin(0.5).setDepth(-9);
        baseText.name = 'tdBase';
    }

    isPath(gx, gy) { return !!this.pathCells[gx + ',' + gy]; }

    // ---------------------------------------------------------
    // INPUT
    // ---------------------------------------------------------
    onPointerDown(pointer) {
        if (this.gameOver) return;
        const gx = Math.floor(pointer.x / TD_CELL);
        const gy = Math.floor(pointer.y / TD_CELL);
        if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return;
        const key = gx + ',' + gy;
        if (this.occupied[key]) {
            this.openUpgradeMenu(this.occupied[key]);
        } else if (!this.isPath(gx, gy)) {
            this.openBuildMenu(gx, gy);
        }
    }

    // ---------------------------------------------------------
    // TOWER PLACEMENT / MENU (DOM overlay #tdTowerMenu)
    // ---------------------------------------------------------
    openBuildMenu(gx, gy) {
        this.selected = null;
        this.menuCell = { gx, gy };
        const el = document.getElementById('tdTowerMenu');
        if (!el) return;
        el.dataset.gx = gx;
        el.dataset.gy = gy;
        el.querySelector('#tdMenuTitle').textContent = `Build at (${gx}, ${gy})`;
        this.renderMenuButtons(el);
        el.classList.remove('hidden');
    }

    openUpgradeMenu(tower) {
        this.selected = tower;
        const el = document.getElementById('tdTowerMenu');
        if (!el) return;
        el.dataset.gx = tower.gx;
        el.dataset.gy = tower.gy;
        el.querySelector('#tdMenuTitle').textContent = `${TD_TOWER_TYPES[tower.type].name} Lv.${tower.level}`;
        this.renderMenuButtons(el);
        el.classList.remove('hidden');
    }

    renderMenuButtons(el) {
        const wrap = el.querySelector('#tdMenuButtons');
        wrap.innerHTML = '';
        if (!this.selected) {
            ['shooter', 'slow', 'splash'].forEach(type => {
                const t = TD_TOWER_TYPES[type];
                const affordable = this.coins >= t.cost;
                const btn = document.createElement('button');
                btn.className = 'td-menu-btn' + (affordable ? '' : ' disabled');
                btn.textContent = `Build ${t.name} (${t.cost}c)`;
                btn.disabled = !affordable;
                btn.onclick = () => tdBuild(type);
                wrap.appendChild(btn);
            });
        } else {
            const tower = this.selected;
            const upCost = this.upgradeCost(tower);
            const affordable = this.coins >= upCost;
            const upBtn = document.createElement('button');
            upBtn.className = 'td-menu-btn' + (affordable ? '' : ' disabled');
            upBtn.textContent = `Upgrade → Lv.${tower.level + 1} (${upCost}c)`;
            upBtn.disabled = !affordable || tower.level >= 3;
            upBtn.onclick = () => tdUpgrade();
            wrap.appendChild(upBtn);
        }
        // ESL earn-coins option
        const earn = document.createElement('button');
        earn.className = 'td-menu-btn earn';
        earn.textContent = 'Not enough coins? Earn 50 via ESL Minigame';
        earn.onclick = () => tdEarnCoins();
        wrap.appendChild(earn);

        const close = document.createElement('button');
        close.className = 'td-menu-btn close';
        close.textContent = 'Close';
        close.onclick = () => this.closeMenu();
        wrap.appendChild(close);
    }

    closeMenu() {
        const el = document.getElementById('tdTowerMenu');
        if (el) el.classList.add('hidden');
        this.selected = null;
    }

    upgradeCost(tower) {
        return Math.round(TD_TOWER_TYPES[tower.type].cost * Math.pow(1.6, tower.level));
    }

    buildTower(type) {
        const gx = +document.getElementById('tdTowerMenu').dataset.gx;
        const gy = +document.getElementById('tdTowerMenu').dataset.gy;
        const t = TD_TOWER_TYPES[type];
        if (this.coins < t.cost) { this.tdBeep('error'); return; }
        const key = gx + ',' + gy;
        if (this.occupied[key] || this.isPath(gx, gy)) return;
        this.coins -= t.cost;
        const tower = {
            gx, gy, type, level: 1, lastFire: 0,
            x: gx * TD_CELL + TD_CELL / 2,
            y: gy * TD_CELL + TD_CELL / 2
        };
        const gfx = this.add.graphics();
        this.drawTower(gfx, tower);
        tower.gfx = gfx;
        this.towerLayer.add(gfx);
        this.towers.push(tower);
        this.occupied[key] = tower;
        this.closeMenu();
        this.refreshHud();
    }

    upgradeTower() {
        const tower = this.selected;
        if (!tower || tower.level >= 3) return;
        const cost = this.upgradeCost(tower);
        if (this.coins < cost) { this.tdBeep('error'); return; }
        this.coins -= cost;
        tower.level += 1;
        this.drawTower(tower.gfx, tower);
        // pop tween
        this.tweens.add({ targets: tower.gfx, scale: { from: 1.3, to: 1 }, duration: 250, ease: 'Back.out' });
        this.closeMenu();
        this.refreshHud();
    }

    drawTower(gfx, tower) {
        gfx.clear();
        const t = TD_TOWER_TYPES[tower.type];
        const size = 18 + (tower.level - 1) * 4;
        gfx.fillStyle(t.color, 1);
        if (tower.type === 'splash') {
            gfx.fillTriangle(0, -size, -size, size, size, size);
        } else {
            gfx.fillCircle(0, 0, size);
        }
        gfx.setPosition(tower.x, tower.y);
        // level pips
        gfx.fillStyle(0x000000, 0.6);
        for (let i = 0; i < tower.level; i++) {
            gfx.fillCircle(-8 + i * 8, size + 6, 2.5);
        }
    }

    // ---------------------------------------------------------
    // ENEMIES
    // ---------------------------------------------------------
    getDifficulty() {
        const mins = this.elapsed / 60000;
        if (mins < 5) return 1 + mins * 0.3;             // gentle linear
        const over = mins - 5;
        return 2.5 * Math.pow(1.35, over);               // exponential after 5 min
    }

    spawnEnemy() {
        if (this.gameOver) return;
        const diff = this.getDifficulty();
        let type = 'basic';
        const r = Math.random();
        if (diff > 2 && r < 0.25) type = 'tank';
        else if (diff > 1.2 && r < 0.5) type = 'fast';

        const base = TD_ENEMY_TYPES[type];
        const hp = Math.round(base.hp * (0.6 + diff * 0.4));
        const gfx = this.add.graphics();
        gfx.fillStyle(base.color, 1);
        const s = type === 'tank' ? 16 : (type === 'fast' ? 10 : 13);
        if (type === 'tank') gfx.fillRect(-s, -s, s * 2, s * 2);
        else gfx.fillCircle(0, 0, s);
        const enemy = {
            type, hp, maxHp: hp, speed: base.speed, coins: base.coins, dmg: base.dmg,
            wp: 0, x: this.pathPx[0].x, y: this.pathPx[0].y, gfx, dead: false, slowUntil: 0
        };
        gfx.setPosition(enemy.x, enemy.y);
        // hp bar
        enemy.hpBar = this.add.graphics();
        this.enemyLayer.add(gfx); this.enemyLayer.add(enemy.hpBar);
        this.enemies.push(enemy);

        // difficulty-driven spawn rate tightening
        const newDelay = Math.max(350, 1500 - diff * 90);
        this.spawnTimer.delay = newDelay;
    }

    updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.dead) { this.removeEnemy(i); continue; }
            let speed = e.speed;
            if (this.time.now < e.slowUntil) speed *= 0.5;
            const target = this.pathPx[e.wp + 1];
            if (!target) { this.enemyReachBase(e, i); continue; }
            const ang = Math.atan2(target.y - e.y, target.x - e.x);
            e.x += Math.cos(ang) * speed * (dt / 1000);
            e.y += Math.sin(ang) * speed * (dt / 1000);
            e.gfx.setPosition(e.x, e.y);
            // wobble
            e.gfx.y += Math.sin(this.time.now / 120 + i) * 1.5;
            if (Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y) < 4) {
                e.wp++;
            }
            this.drawHpBar(e);
        }
    }

    drawHpBar(e) {
        const g = e.hpBar; g.clear();
        const w = 26, pct = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
        g.fillStyle(0x000000, 0.5); g.fillRect(e.x - w / 2, e.y - 22, w, 4);
        g.fillStyle(0x4caf50, 1); g.fillRect(e.x - w / 2, e.y - 22, w * pct, 4);
    }

    enemyReachBase(e, i) {
        this.baseHp -= e.dmg;
        this.tdBeep('error');
        this.flashBase();
        this.removeEnemy(i);
        this.refreshHud();
        if (this.baseHp <= 0) this.endGame(false);
    }

    removeEnemy(i) {
        const e = this.enemies[i];
        if (e.gfx) e.gfx.destroy();
        if (e.hpBar) e.hpBar.destroy();
        this.enemies.splice(i, 1);
    }

    damageEnemy(e, dmg, slowFactor) {
        e.hp -= dmg;
        if (slowFactor) e.slowUntil = this.time.now + 1500;
        if (e.hp <= 0 && !e.dead) {
            e.dead = true;
            this.coins += e.coins;
            this.score += e.coins * 10;
            this.tdBeep('hit');
            this.refreshHud();
        }
    }

    // ---------------------------------------------------------
    // TOWERS FIRE
    // ---------------------------------------------------------
    updateTowers(now) {
        this.towers.forEach(t => {
            const tdef = TD_TOWER_TYPES[t.type];
            const rate = tdef.fireRate * Math.pow(TD_UPGRADE_MULT.rate, t.level - 1);
            if (now - t.lastFire < rate) return;
            const range = tdef.range * Math.pow(TD_UPGRADE_MULT.range, t.level - 1);
            const dmg = tdef.damage * Math.pow(TD_UPGRADE_MULT.dmg, t.level - 1);
            // nearest enemy in range
            let best = null, bestD = range;
            this.enemies.forEach(e => {
                const d = Phaser.Math.Distance.Between(t.x, t.y, e.x, e.y);
                if (d < bestD) { bestD = d; best = e; }
            });
            if (best) {
                t.lastFire = now;
                this.fireProjectile(t, best, dmg, tdef);
                this.tdBeep('shoot');
            }
        });
    }

    fireProjectile(tower, target, dmg, tdef) {
        const gfx = this.add.graphics();
        if (tdef.proj === 'bubble') { gfx.fillStyle(0xffffff, 0.4); gfx.fillCircle(0, 0, 10); }
        else if (tdef.proj === 'mortar') { gfx.fillStyle(0x555555, 1); gfx.fillCircle(0, 0, 6); }
        else { gfx.fillStyle(0xffff00, 1); gfx.fillCircle(0, 0, 4); }
        gfx.setPosition(tower.x, tower.y);
        this.projLayer.add(gfx);
        this.projectiles.push({
            gfx, x: tower.x, y: tower.y, target, speed: 420,
            damage: dmg, slow: tdef.slow, splash: tdef.splash, scene: this
        });
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (!p.target || p.target.dead) { p.gfx.destroy(); this.projectiles.splice(i, 1); continue; }
            const ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
            p.x += Math.cos(ang) * p.speed * (dt / 1000);
            p.y += Math.sin(ang) * p.speed * (dt / 1000);
            p.gfx.setPosition(p.x, p.y);
            if (Phaser.Math.Distance.Between(p.x, p.y, p.target.x, p.target.y) < 8) {
                // hit
                if (p.splash > 0) {
                    this.enemies.forEach(e => {
                        if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) <= p.splash) {
                            this.damageEnemy(e, p.damage, p.slow);
                        }
                    });
                    this.drawSplash(p.x, p.y, p.splash);
                } else {
                    this.damageEnemy(p.target, p.damage, p.slow);
                }
                p.gfx.destroy();
                this.projectiles.splice(i, 1);
            }
        }
    }

    drawSplash(x, y, r) {
        const g = this.add.graphics(); g.setDepth(5);
        g.fillStyle(0xffa500, 0.4); g.fillCircle(x, y, r);
        this.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
    }

    // ---------------------------------------------------------
    // HUD (DOM, self-managed)
    // ---------------------------------------------------------
    ensureHud() {
        const hud = document.getElementById('tdHUD');
        if (hud) hud.classList.remove('hidden');
        const go = document.getElementById('tdGameOverScreen');
        if (go) go.classList.add('hidden');
    }

    refreshHud() {
        const c = document.getElementById('tdCoins');
        const hp = document.getElementById('tdBaseHp');
        if (c) c.textContent = this.coins;
        if (hp) hp.textContent = this.baseHp;
        // keep menu affordability fresh
        const el = document.getElementById('tdTowerMenu');
        if (el && !el.classList.contains('hidden') && this.selected === null && !this.menuCell) {
            // no-op
        }
    }

    // ---------------------------------------------------------
    // LOOP
    // ---------------------------------------------------------
    startLoop() { this.spawnTimer.paused = false; }

    update(time, dt) {
        if (this.gameOver) return;
        this.elapsed += dt;
        this.updateEnemies(dt);
        this.updateTowers(time);
        this.updateProjectiles(dt);
    }

    // ---------------------------------------------------------
    // GAME OVER
    // ---------------------------------------------------------
    endGame(won) {
        if (this.gameOver) return;
        this.gameOver = true;
        this.spawnTimer.paused = true;
        const go = document.getElementById('tdGameOverScreen');
        if (go) {
            go.querySelector('#tdGameOverText').textContent = won ? 'Base Defended!' : 'Base Overrun!';
            go.querySelector('#tdFinalScore').textContent = 'Score: ' + this.score;
            go.classList.remove('hidden');
        }
        // return to selection
        const hud = document.getElementById('tdHUD'); if (hud) hud.classList.add('hidden');
        const menu = document.getElementById('tdTowerMenu'); if (menu) menu.classList.add('hidden');
    }

    // ---------------------------------------------------------
    // AUDIO (guarded — synth* are global from vampire_survivors.js)
    // ---------------------------------------------------------
    tdBeep(kind) {
        if (kind === 'shoot' && typeof synthShoot === 'function') synthShoot();
        else if (kind === 'hit' && typeof synthHit === 'function') synthHit();
        else if (kind === 'error' && typeof synthError === 'function') synthError();
    }

    flashBase() {
        const base = this.children.getByName('tdBase');
        if (base) this.tweens.add({ targets: base, scale: { from: 1.4, to: 1 }, duration: 200 });
    }

    // ---------------------------------------------------------
    // ESL CREDIT (called from game.js claimReward)
    // ---------------------------------------------------------
    creditCoins(n) {
        this.coins += n;
        this.refreshHud();
        const menu = document.getElementById('tdTowerMenu');
        if (menu && !menu.classList.contains('hidden')) this.renderMenuButtons(menu);
    }
}

// Self-register (mirrors uno.js). config/scene exist because boot.js loads first.
if (typeof config !== 'undefined' && config.scene) {
    registerScene(TowerDefenseScene);
}

// ============================================================
// GLOBAL HOOKS (wired into DOM buttons in index.html)
// ============================================================
function triggerTowerDefense() {
    activeGameMode = 'TowerDefense';
    ['startScreen', 'gameSelectionOverlay', 'gomokuScreen', 'gomokuGameOverScreen',
        'gomokuModeSelectionOverlay', 'gomokuDifficultySelectionOverlay',
        'gameOverScreen', 'gameIntroOverlay', 'studyModeOverlay', 'unoScreen',
        'unoGameOverScreen', 'tdGameOverScreen'
    ].forEach(id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); });

    if (typeof initAudio === 'function') initAudio();

    if (!game) {
        config.parent = document.body;
        game = new Phaser.Game(config);
        game.events.once('ready', () => {
            game.scene.stop('MainScene');
            setTimeout(() => {
                if (game && game.scale) {
                    game.scale.parent = document.body;
                    game.scale.parentIsWindow = true;
                    game.scale.resize(window.innerWidth, window.innerHeight);
                    game.scale.refresh();
                }
                game.scene.start('TowerDefenseScene');
            }, 80);
        });
    } else {
        if (window.tdStopTimeout) { clearTimeout(window.tdStopTimeout); window.tdStopTimeout = null; }
        if (game.scene.isActive('MainScene')) game.scene.stop('MainScene');
        if (game.scene.isActive('UnoScene')) game.scene.stop('UnoScene');
        if (game.scene.isActive('TowerDefenseScene')) game.scene.stop('TowerDefenseScene');
        if (game.scale && typeof game.scale.setParent === 'function') {
            game.scale.setParent(document.body);
        } else {
            document.body.appendChild(game.canvas);
        }
        setTimeout(() => {
            if (game && game.scale) {
                game.scale.parent = document.body;
                game.scale.parentIsWindow = true;
                game.scale.resize(window.innerWidth, window.innerHeight);
                game.scale.refresh();
            }
            game.scene.start('TowerDefenseScene');
        }, 80);
    }
}

function tdBuild(type) {
    const scene = game && game.scene.getScene('TowerDefenseScene');
    if (scene) scene.buildTower(type);
}
function tdUpgrade() {
    const scene = game && game.scene.getScene('TowerDefenseScene');
    if (scene) scene.upgradeTower();
}
function tdEarnCoins() {
    const scene = game && game.scene.getScene('TowerDefenseScene');
    if (scene) scene.closeMenu();
    // no-pause ESL minigame; success credits 50 via claimReward -> tdCreditCoins
    if (typeof startMiniGame === 'function') startMiniGame('spelling', 'towerdefense');
}
function tdCreditCoins(n) {
    const scene = game && game.scene.getScene('TowerDefenseScene');
    if (scene) scene.creditCoins(n);
}
function tdCloseMenu() {
    const scene = game && game.scene.getScene('TowerDefenseScene');
    if (scene) scene.closeMenu();
}
function tdReturnToMenu() {
    const hud = document.getElementById('tdHUD'); if (hud) hud.classList.add('hidden');
    const go = document.getElementById('tdGameOverScreen'); if (go) go.classList.add('hidden');
    if (game && game.scene.isActive('TowerDefenseScene')) game.scene.stop('TowerDefenseScene');
    activeGameMode = null;
    if (typeof showGameSelection === 'function') showGameSelection();
    else { const e = document.getElementById('gameSelectionOverlay'); if (e) e.classList.remove('hidden'); }
}
