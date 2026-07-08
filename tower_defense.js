// ============================================================
// TOWER DEFENSE GAME MODE (Classroom Survivors)
// Plant-vs-Zombies-style LANE layout, school-themed, placeholders only.
// Self-registers via registerScene() (boot.js). Full-screen, body-parented.
// ESL integration UNCHANGED: tdEarnCoins() -> startMiniGame('spelling','towerdefense')
// -> claimReward success -> tdCreditCoins(50). Gold also from kills.
// ============================================================

const TD_CELL = 64;                 // nominal cell size (grid auto-fits screen)
const TD_LANES_MAX = 6;             // cap on horizontal lanes
const TD_START_COINS = 60;
const TD_START_BASE_HP = 20;
const TD_TOWER_TYPES = {
    shooter: { name: 'Pencil', emoji: '🖊️', cost: 20, range: 240, fireRate: 600, damage: 8, color: 0xffe14d, proj: 'dot', slow: 0, splash: 0 },
    slow:    { name: 'Eraser', emoji: '🧽', cost: 25, range: 200, fireRate: 1000, damage: 2, color: 0xff8ad0, proj: 'bubble', slow: 0.5, splash: 0 },
    splash:  { name: 'Book',   emoji: '📚', cost: 40, range: 260, fireRate: 1200, damage: 12, color: 0x8d6e3c, proj: 'mortar', slow: 0, splash: 70 }
};
const TD_UPGRADE_MULT = { dmg: 1.6, range: 1.15, rate: 0.85 };
const TD_ENEMY_TYPES = {
    basic: { hp: 30, speed: 55, color: 0xffffff, coins: 3, dmg: 1, emoji: '📄' },
    fast:  { hp: 18, speed: 115, color: 0xffa500, coins: 2, dmg: 1, emoji: '⏱️' },
    tank:  { hp: 120, speed: 33, color: 0x9c27b0, coins: 8, dmg: 3, emoji: '📝' }
};

class TowerDefenseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TowerDefenseScene' });
    }

    create() {
        const W = this.scale.width, H = this.scale.height;
        this.cols = Math.max(8, Math.floor(W / TD_CELL));
        this.lanes = Math.min(TD_LANES_MAX, Math.max(4, Math.floor(H / TD_CELL)));
        this.colW = W / this.cols;
        this.laneH = H / this.lanes;
        this.schoolLineX = this.colW * 0.5;   // enemies reaching here hit the school

        // --- core state ---
        this.coins = TD_START_COINS;
        this.baseHp = TD_START_BASE_HP;
        this.score = 0;
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.occupied = {};       // "col,lane" -> tower
        this.defenders = new Array(this.lanes).fill(true); // 🧹 hall-monitor per lane
        this.defenderMarks = new Array(this.lanes).fill(null);
        this.elapsed = 0;
        this.gameOver = false;
        this.selected = null;

        this.generateGridVisuals();

        // --- layers ---
        this.towerLayer = this.add.container(0, 0);
        this.enemyLayer = this.add.container(0, 0);
        this.projLayer = this.add.container(0, 0);

        this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));

        // --- spawn loop ---
        this.spawnTimer = this.time.addEvent({
            delay: 1500, loop: true, callback: () => this.spawnEnemy()
        });
        this.spawnTimer.paused = true;

        this.ensureHud();
        this.refreshHud();
        this.startLoop();
    }

    // ---------------------------------------------------------
    // GRID / VISUALS (PvZ-style lanes + school wall + defenders)
    // ---------------------------------------------------------
    cellCenter(col, lane) {
        return { x: col * this.colW + this.colW / 2, y: lane * this.laneH + this.laneH / 2 };
    }
    laneCenterY(lane) { return lane * this.laneH + this.laneH / 2; }

    generateGridVisuals() {
        const W = this.scale.width, H = this.scale.height;
        this.mapGfx = this.add.graphics();
        this.mapGfx.setDepth(-10);
        for (let lane = 0; lane < this.lanes; lane++) {
            for (let col = 0; col < this.cols; col++) {
                const x = col * this.colW, y = lane * this.laneH;
                if (col === 0) {
                    this.mapGfx.fillStyle(0x6d4c41, 1);                 // school brick wall
                } else {
                    this.mapGfx.fillStyle((col + lane) % 2 ? 0x3c8c34 : 0x47a03d, 1); // school field
                }
                this.mapGfx.fillRect(x, y, this.colW + 1, this.laneH + 1);
            }
            // lane divider
            this.mapGfx.lineStyle(1, 0x000000, 0.15);
            this.mapGfx.lineBetween(0, lane * this.laneH, W, lane * this.laneH);
        }
        // school building 🏫 (also flashes on hit)
        const sc = this.cellCenter(0, Math.floor(this.lanes / 2));
        const school = this.add.text(sc.x, sc.y, '🏫', { fontSize: Math.floor(this.laneH * 0.7) + 'px' })
            .setOrigin(0.5).setDepth(-9);
        school.name = 'tdBase';
        // defender (🧹 hall monitor) per lane
        for (let lane = 0; lane < this.lanes; lane++) {
            const y = this.laneCenterY(lane);
            const mark = this.add.text(this.schoolLineX, y, '🧹', { fontSize: '26px' })
                .setOrigin(0.5).setDepth(-8);
            this.defenderMarks[lane] = mark;
        }
    }

    isSchoolCol(col) { return col === 0; }
    isPath() { return false; } // kept for backward-compat with any external refs

    // ---------------------------------------------------------
    // INPUT
    // ---------------------------------------------------------
    onPointerDown(pointer) {
        if (this.gameOver) return;
        const col = Math.floor(pointer.x / this.colW);
        const lane = Math.floor(pointer.y / this.laneH);
        if (col < 0 || lane < 0 || col >= this.cols || lane >= this.lanes) return;
        const key = col + ',' + lane;
        if (this.occupied[key]) {
            this.openUpgradeMenu(this.occupied[key]);
        } else if (!this.isSchoolCol(col)) {
            this.openBuildMenu(col, lane);
        }
    }

    // ---------------------------------------------------------
    // TOWER PLACEMENT / MENU (DOM overlay #tdTowerMenu)
    // ---------------------------------------------------------
    openBuildMenu(col, lane) {
        this.selected = null;
        this.menuCell = { col, lane };
        const el = document.getElementById('tdTowerMenu');
        if (!el) return;
        el.dataset.gx = col;
        el.dataset.gy = lane;
        el.querySelector('#tdMenuTitle').textContent = `Build in lane ${lane + 1}, col ${col}`;
        this.renderMenuButtons(el);
        el.classList.remove('hidden');
    }

    openUpgradeMenu(tower) {
        this.selected = tower;
        const el = document.getElementById('tdTowerMenu');
        if (!el) return;
        el.dataset.gx = tower.col;
        el.dataset.gy = tower.lane;
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
                btn.textContent = `Build ${t.emoji} ${t.name} (${t.cost}c)`;
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
        const earn = document.createElement('button');
        earn.className = 'td-menu-btn earn';
        earn.textContent = 'Need coins? Earn 50 via ESL Minigame';
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
        const col = +document.getElementById('tdTowerMenu').dataset.gx;
        const lane = +document.getElementById('tdTowerMenu').dataset.gy;
        const t = TD_TOWER_TYPES[type];
        if (this.coins < t.cost) { this.tdBeep('error'); return; }
        if (this.isSchoolCol(col)) return;
        const key = col + ',' + lane;
        if (this.occupied[key]) return;
        this.coins -= t.cost;
        const c = this.cellCenter(col, lane);
        const tower = { col, lane, type, level: 1, lastFire: 0, x: c.x, y: c.y };
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
        this.tweens.add({ targets: tower.gfx, scale: { from: 1.3, to: 1 }, duration: 250, ease: 'Back.out' });
        this.closeMenu();
        this.refreshHud();
    }

    drawTower(gfx, tower) {
        gfx.clear();
        const t = TD_TOWER_TYPES[tower.type];
        const size = 16 + (tower.level - 1) * 4;
        gfx.fillStyle(t.color, 1);
        if (tower.type === 'splash') gfx.fillTriangle(0, -size, -size, size, size, size);
        else gfx.fillCircle(0, 0, size);
        gfx.setPosition(tower.x, tower.y);
        gfx.fillStyle(0x000000, 0.6);
        for (let i = 0; i < tower.level; i++) gfx.fillCircle(-8 + i * 8, size + 6, 2.5);
    }

    // ---------------------------------------------------------
    // ENEMIES (straight along a lane, leftward)
    // ---------------------------------------------------------
    getDifficulty() {
        const mins = this.elapsed / 60000;
        if (mins < 5) return 1 + mins * 0.3;
        const over = mins - 5;
        return 2.5 * Math.pow(1.35, over);
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
        const lane = Phaser.Math.Between(0, this.lanes - 1);
        const y = this.laneCenterY(lane);
        const gfx = this.add.graphics();
        gfx.fillStyle(base.color, 1);
        const s = type === 'tank' ? 16 : (type === 'fast' ? 10 : 13);
        if (type === 'tank') gfx.fillRect(-s, -s, s * 2, s * 2);
        else gfx.fillCircle(0, 0, s);
        const enemy = {
            type, hp, maxHp: hp, speed: base.speed, coins: base.coins, dmg: base.dmg,
            lane, x: this.scale.width + 20, y, gfx, dead: false, slowUntil: 0
        };
        gfx.setPosition(enemy.x, enemy.y);
        enemy.hpBar = this.add.graphics();
        this.enemyLayer.add(gfx); this.enemyLayer.add(enemy.hpBar);
        this.enemies.push(enemy);

        const newDelay = Math.max(350, 1500 - diff * 90);
        this.spawnTimer.delay = newDelay;
    }

    updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.dead) { this.removeEnemy(i); continue; }
            let speed = e.speed;
            if (this.time.now < e.slowUntil) speed *= 0.5;
            const laneY = this.laneCenterY(e.lane);
            e.x -= speed * (dt / 1000);
            e.gfx.setPosition(e.x, laneY + Math.sin(this.time.now / 120 + i) * 1.5);
            this.drawHpBar(e, laneY);
            if (e.x <= this.schoolLineX) this.enemyReachSchool(e, i);
        }
    }

    drawHpBar(e, laneY) {
        const g = e.hpBar; g.clear();
        const w = 26, pct = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
        g.fillStyle(0x000000, 0.5); g.fillRect(e.x - w / 2, laneY - 22, w, 4);
        g.fillStyle(0x4caf50, 1); g.fillRect(e.x - w / 2, laneY - 22, w * pct, 4);
    }

    enemyReachSchool(e, i) {
        const lane = e.lane;
        if (this.defenders[lane]) {
            this.triggerDefender(lane);
            this.removeEnemy(i);
        } else {
            this.baseHp -= e.dmg;
            this.tdBeep('error');
            this.flashBase();
            this.removeEnemy(i);
            this.refreshHud();
            if (this.baseHp <= 0) this.endGame(false);
        }
    }

    triggerDefender(lane) {
        this.defenders[lane] = false;
        if (this.defenderMarks[lane]) { this.defenderMarks[lane].destroy(); this.defenderMarks[lane] = null; }
        // sweep: defeat every enemy currently in this lane, awarding coins
        for (let k = this.enemies.length - 1; k >= 0; k--) {
            const e = this.enemies[k];
            if (e.lane === lane && !e.dead) {
                this.coins += e.coins; this.score += e.coins * 10; this.removeEnemy(k);
            }
        }
        // sweep effect
        const y = this.laneCenterY(lane);
        const g = this.add.graphics(); g.setDepth(5);
        g.fillStyle(0xffff00, 0.5); g.fillRect(0, y - this.laneH / 2, this.scale.width, this.laneH);
        this.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
        this.refreshHud();
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
    // TOWERS FIRE (same lane, to the right)
    // ---------------------------------------------------------
    updateTowers(now) {
        this.towers.forEach(t => {
            const tdef = TD_TOWER_TYPES[t.type];
            const rate = tdef.fireRate * Math.pow(TD_UPGRADE_MULT.rate, t.level - 1);
            if (now - t.lastFire < rate) return;
            const range = tdef.range * Math.pow(TD_UPGRADE_MULT.range, t.level - 1);
            const dmg = tdef.damage * Math.pow(TD_UPGRADE_MULT.dmg, t.level - 1);
            let best = null, bestDist = range;
            this.enemies.forEach(e => {
                if (e.lane !== t.lane) return;
                if (e.x <= t.x) return;                 // only enemies to the right
                const d = e.x - t.x;
                if (d < bestDist) { bestDist = d; best = e; }
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
            gfx, x: tower.x, y: tower.y, target, speed: 480,
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
            go.querySelector('#tdGameOverText').textContent = won ? 'School Defended!' : 'School Overrun!';
            go.querySelector('#tdFinalScore').textContent = 'Score: ' + this.score;
            go.classList.remove('hidden');
        }
        const hud = document.getElementById('tdHUD'); if (hud) hud.classList.add('hidden');
        const menu = document.getElementById('tdTowerMenu'); if (menu) menu.classList.add('hidden');
    }

    // ---------------------------------------------------------
    // AUDIO (guarded)
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
    // ESL CREDIT (called from game.js claimReward) — UNCHANGED
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
