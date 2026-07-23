// ============================================================
// SCHOOL vs ZOMBIES — Tower Defense (PvZ-style, vertical)
// Full rewrite: pixel-art sprites, 9 towers, 5 enemies,
// ESL slow-down mechanic, portrait-optimized.
// Self-registers via registerScene() (boot.js).
// ESL integration: tdStartESL() -> startMiniGame('spelling','towerdefense')
//   -> claimReward success -> tdCreditCoins(50)
// ============================================================

// --- GRID CONSTANTS ---
const TD_COLS = 5;
const TD_ROWS = 7;
const TD_START_COINS = 75;
const TD_START_BASE_HP = 20;
const TD_ESL_SLOW_FACTOR = 0.4;   // zombies move at 40% speed during ESL
const TD_ESL_LINGER_MS = 2000;    // slow lingers 2s after correct answer

// --- TOWER DEFINITIONS ---
const TD_TOWERS = {
    pencil:   { name: 'Pencil',       icon: '✏️', cost: 20, type: 'shooter', damage: 12, fireRate: 800,  projSpeed: 350, slow: 0, pierce: false, splash: 0, oneTime: false, hp: 40,  coinGen: 0 },
    star:     { name: 'Star Student',  icon: '⭐', cost: 25, type: 'generator', damage: 0, fireRate: 0,    projSpeed: 0,   slow: 0, pierce: false, splash: 0, oneTime: false, hp: 30,  coinGen: 5, coinInterval: 8000 },
    desk:     { name: 'Desk',         icon: '🪑', cost: 15, type: 'blocker', damage: 0, fireRate: 0,    projSpeed: 0,   slow: 0, pierce: false, splash: 0, oneTime: false, hp: 200, coinGen: 0 },
    eraser:   { name: 'Eraser',       icon: '🧽', cost: 30, type: 'shooter', damage: 8,  fireRate: 1000, projSpeed: 300, slow: 0.4, pierce: false, splash: 0, oneTime: false, hp: 40,  coinGen: 0 },
    popquiz:  { name: 'Pop Quiz',     icon: '💥', cost: 40, type: 'bomb',    damage: 150, fireRate: 0,   projSpeed: 0,   slow: 0, pierce: false, splash: 1, oneTime: true,  hp: 25,  coinGen: 0, armTime: 2000 },
    ruler:    { name: 'Ruler',        icon: '📏', cost: 45, type: 'shooter', damage: 9,  fireRate: 650,  projSpeed: 380, slow: 0, pierce: false, splash: 0, oneTime: false, hp: 45,  coinGen: 0, doubleShot: true },
    textbook: { name: 'Textbook',     icon: '📚', cost: 50, type: 'shooter', damage: 6,  fireRate: 1300, projSpeed: 250, slow: 0, pierce: true,  splash: 0, oneTime: false, hp: 45,  coinGen: 0 },
    trap:     { name: 'Homework Trap', icon: '📝', cost: 10, type: 'mine',   damage: 200, fireRate: 0,   projSpeed: 0,   slow: 0, pierce: false, splash: 0, oneTime: true,  hp: 15,  coinGen: 0, armTime: 5000 },
    firedrill:{ name: 'Fire Drill',   icon: '🔔', cost: 60, type: 'lanebomb',damage: 9999, fireRate: 0,  projSpeed: 0,   slow: 0, pierce: false, splash: 0, oneTime: true,  hp: 25,  coinGen: 0, armTime: 1500 }
};
const TD_TOWER_ORDER = ['pencil','star','desk','eraser','popquiz','ruler','textbook','trap','firedrill'];
const TD_UPGRADE_DMG = 1.4;
const TD_UPGRADE_RATE = 0.85;
const TD_UPGRADE_HP = 1.4;
const TD_MAX_LEVEL = 3;

// --- ENEMY DEFINITIONS ---
const TD_ENEMIES = {
    dropout:  { name: 'Dropout',   hp: 40,  speed: 26, coins: 4, dmg: 1, armor: 0,   armorHp: 0,  jump: false, enrage: false },
    backpack: { name: 'Backpack',  hp: 80,  speed: 24, coins: 6, dmg: 1, armor: 0.5, armorHp: 40, jump: false, enrage: false },
    nerd:     { name: 'Nerd',      hp: 150, speed: 18, coins: 10, dmg: 2, armor: 0.3, armorHp: 0, jump: false, enrage: false },
    bully:    { name: 'Bully',     hp: 50,  speed: 48, coins: 7, dmg: 1, armor: 0,   armorHp: 0,  jump: true,  enrage: false },
    librarian:{ name: 'Librarian', hp: 60,  speed: 22, coins: 8, dmg: 1, armor: 0,   armorHp: 0,  jump: false, enrage: true }
};

// --- DIFFICULTY PHASES ---
const TD_PHASES = [
    { until: 30000,  interval: 5000, types: ['dropout'],              count: 1, hpMult: 1.0 },
    { until: 60000,  interval: 4000, types: ['dropout','backpack'],   count: 1, hpMult: 1.0 },
    { until: 120000, interval: 3000, types: ['dropout','backpack','nerd'], count: 2, hpMult: 1.15 },
    { until: 180000, interval: 2400, types: ['dropout','backpack','nerd','bully'], count: 2, hpMult: 1.3 },
    { until: 300000, interval: 1800, types: ['dropout','backpack','nerd','bully','librarian'], count: 3, hpMult: 1.5 },
    { until: Infinity, interval: 1200, types: ['dropout','backpack','nerd','bully','librarian'], count: 3, hpMult: 2.0 }
];

// ============================================================
// PIXEL-ART DRAWING UTILITIES
// ============================================================
function tdDrawPixelRect(gfx, x, y, w, h, color) {
    gfx.fillStyle(color, 1);
    gfx.fillRect(x, y, w, h);
}

function tdDrawTowerSprite(gfx, type, level, cellW, cellH) {
    gfx.clear();
    const s = Math.min(cellW, cellH);
    const u = s / 16; // pixel unit
    const cx = 0, cy = 0;
    const lvScale = 1 + (level - 1) * 0.12;

    gfx.setScale(lvScale);

    switch (type) {
        case 'pencil': // Yellow pencil pointing up
            tdDrawPixelRect(gfx, cx-2*u, cy-6*u, 4*u, 10*u, 0xf5c542); // body
            tdDrawPixelRect(gfx, cx-2*u, cy-6*u, 4*u, 2*u, 0xffe08a);  // highlight
            tdDrawPixelRect(gfx, cx-1*u, cy-8*u, 2*u, 2*u, 0x333333);  // tip
            tdDrawPixelRect(gfx, cx-2*u, cy+4*u, 4*u, 2*u, 0xff9999);  // eraser end
            break;
        case 'star': // Golden star student
            tdDrawPixelRect(gfx, cx-1*u, cy-6*u, 2*u, 2*u, 0xffd700);
            tdDrawPixelRect(gfx, cx-4*u, cy-3*u, 8*u, 2*u, 0xffd700);
            tdDrawPixelRect(gfx, cx-3*u, cy-1*u, 6*u, 2*u, 0xffec80);
            tdDrawPixelRect(gfx, cx-2*u, cy+1*u, 4*u, 2*u, 0xffd700);
            tdDrawPixelRect(gfx, cx-3*u, cy+3*u, 2*u, 2*u, 0xffd700);
            tdDrawPixelRect(gfx, cx+1*u, cy+3*u, 2*u, 2*u, 0xffd700);
            // face
            tdDrawPixelRect(gfx, cx-1*u, cy-2*u, 1*u, 1*u, 0x333333);
            tdDrawPixelRect(gfx, cx+1*u, cy-2*u, 1*u, 1*u, 0x333333);
            break;
        case 'desk': // Brown desk/blocker
            tdDrawPixelRect(gfx, cx-5*u, cy-3*u, 10*u, 2*u, 0x8B4513); // top
            tdDrawPixelRect(gfx, cx-5*u, cy-1*u, 10*u, 4*u, 0xA0522D); // body
            tdDrawPixelRect(gfx, cx-4*u, cy+3*u, 2*u, 3*u, 0x654321);  // leg L
            tdDrawPixelRect(gfx, cx+2*u, cy+3*u, 2*u, 3*u, 0x654321);  // leg R
            tdDrawPixelRect(gfx, cx-3*u, cy-1*u, 6*u, 1*u, 0xCD853F);  // highlight
            break;
        case 'eraser': // Pink eraser
            tdDrawPixelRect(gfx, cx-4*u, cy-3*u, 8*u, 6*u, 0xff8ad0);  // body
            tdDrawPixelRect(gfx, cx-4*u, cy-3*u, 8*u, 2*u, 0x4488ff);  // blue stripe
            tdDrawPixelRect(gfx, cx-3*u, cy-1*u, 6*u, 1*u, 0xffc0e0);  // highlight
            tdDrawPixelRect(gfx, cx-2*u, cy+3*u, 4*u, 1*u, 0xcc6699);  // bottom
            break;
        case 'popquiz': // Red bomb / exclamation
            tdDrawPixelRect(gfx, cx-4*u, cy-4*u, 8*u, 8*u, 0xff3333);  // body
            tdDrawPixelRect(gfx, cx-1*u, cy-6*u, 2*u, 2*u, 0xffaa00);  // fuse
            tdDrawPixelRect(gfx, cx-1*u, cy-2*u, 2*u, 3*u, 0xffffff);  // ! mark
            tdDrawPixelRect(gfx, cx-1*u, cy+2*u, 2*u, 1*u, 0xffffff);  // ! dot
            break;
        case 'ruler': // Long ruler, double shot
            tdDrawPixelRect(gfx, cx-1*u, cy-7*u, 3*u, 14*u, 0xdeb887); // body
            tdDrawPixelRect(gfx, cx-1*u, cy-7*u, 1*u, 14*u, 0xf5deb3); // highlight
            tdDrawPixelRect(gfx, cx+1*u, cy-5*u, 1*u, 1*u, 0x333333);  // marks
            tdDrawPixelRect(gfx, cx+1*u, cy-2*u, 1*u, 1*u, 0x333333);
            tdDrawPixelRect(gfx, cx+1*u, cy+1*u, 1*u, 1*u, 0x333333);
            tdDrawPixelRect(gfx, cx+1*u, cy+4*u, 1*u, 1*u, 0x333333);
            break;
        case 'textbook': // Thick book, piercing
            tdDrawPixelRect(gfx, cx-4*u, cy-4*u, 8*u, 8*u, 0x2255aa);  // cover
            tdDrawPixelRect(gfx, cx-4*u, cy-4*u, 2*u, 8*u, 0x1a3d7a);  // spine
            tdDrawPixelRect(gfx, cx-2*u, cy-2*u, 5*u, 1*u, 0xffffff);  // title line
            tdDrawPixelRect(gfx, cx-2*u, cy, 4*u, 1*u, 0xcccccc);     // line 2
            tdDrawPixelRect(gfx, cx-4*u, cy+4*u, 8*u, 1*u, 0xffeedd);  // pages
            break;
        case 'trap': // Homework paper mine
            tdDrawPixelRect(gfx, cx-3*u, cy-4*u, 6*u, 8*u, 0xfffff0);  // paper
            tdDrawPixelRect(gfx, cx-2*u, cy-2*u, 4*u, 1*u, 0x666666);  // lines
            tdDrawPixelRect(gfx, cx-2*u, cy, 4*u, 1*u, 0x666666);
            tdDrawPixelRect(gfx, cx-2*u, cy+2*u, 3*u, 1*u, 0x666666);
            tdDrawPixelRect(gfx, cx+1*u, cy-4*u, 2*u, 2*u, 0xff4444);  // red mark
            break;
        case 'firedrill': // Bell
            tdDrawPixelRect(gfx, cx-4*u, cy-2*u, 8*u, 5*u, 0xff6600);  // bell body
            tdDrawPixelRect(gfx, cx-3*u, cy-4*u, 6*u, 2*u, 0xff8833);  // top
            tdDrawPixelRect(gfx, cx-1*u, cy-5*u, 2*u, 1*u, 0x333333);  // handle
            tdDrawPixelRect(gfx, cx-1*u, cy+3*u, 2*u, 2*u, 0xffcc00);  // clapper
            break;
    }
}

function tdDrawEnemySprite(gfx, type, frame, hp, maxHp, cellW, cellH) {
    gfx.clear();
    const s = Math.min(cellW, cellH);
    const u = s / 16;
    const cx = 0, cy = 0;
    const legOffset = frame === 0 ? 1 : -1;

    // Base zombie body colors by type
    const skinColors = { dropout: 0x7ab648, backpack: 0x5a9e3a, nerd: 0x4a8e6a, bully: 0x9e5a3a, librarian: 0x6a7ab6 };
    const skin = skinColors[type] || 0x7ab648;
    const dark = Phaser.Display.Color.IntegerToColor(skin);
    const darkHex = Phaser.Display.Color.GetColor(Math.max(0,dark.red-40), Math.max(0,dark.green-40), Math.max(0,dark.blue-40)).color;

    // Head
    tdDrawPixelRect(gfx, cx-3*u, cy-7*u, 6*u, 5*u, skin);
    // Eyes
    tdDrawPixelRect(gfx, cx-2*u, cy-6*u, 2*u, 2*u, 0xff0000);
    tdDrawPixelRect(gfx, cx+1*u, cy-6*u, 2*u, 2*u, 0xff0000);
    // Body
    tdDrawPixelRect(gfx, cx-3*u, cy-2*u, 6*u, 6*u, darkHex);
    // Arms
    tdDrawPixelRect(gfx, cx-5*u, cy-1*u, 2*u, 4*u, skin);
    tdDrawPixelRect(gfx, cx+3*u, cy-1*u, 2*u, 4*u, skin);
    // Legs (animated)
    tdDrawPixelRect(gfx, cx-2*u, cy+4*u, 2*u, 3*u + legOffset*u, darkHex);
    tdDrawPixelRect(gfx, cx+1*u, cy+4*u, 2*u, 3*u - legOffset*u, darkHex);

    // Type-specific accessories
    switch (type) {
        case 'backpack': // Backpack on back
            tdDrawPixelRect(gfx, cx-4*u, cy-2*u, 2*u, 5*u, 0xcc4444);
            tdDrawPixelRect(gfx, cx-4*u, cy-2*u, 2*u, 1*u, 0x992222);
            break;
        case 'nerd': // Helmet/bucket
            tdDrawPixelRect(gfx, cx-4*u, cy-8*u, 8*u, 2*u, 0x888888);
            tdDrawPixelRect(gfx, cx-3*u, cy-9*u, 6*u, 1*u, 0xaaaaaa);
            break;
        case 'bully': // Spiky hair
            tdDrawPixelRect(gfx, cx-3*u, cy-9*u, 2*u, 2*u, 0x333333);
            tdDrawPixelRect(gfx, cx, cy-9*u, 2*u, 2*u, 0x333333);
            tdDrawPixelRect(gfx, cx+2*u, cy-9*u, 2*u, 2*u, 0x333333);
            break;
        case 'librarian': // Book in hand
            tdDrawPixelRect(gfx, cx+4*u, cy-1*u, 3*u, 4*u, 0x8B4513);
            tdDrawPixelRect(gfx, cx+4*u, cy-1*u, 3*u, 1*u, 0xffffff);
            break;
    }
}

// ============================================================
// SPRITE FRAME MAPPINGS
// ============================================================
const TD_ENEMY_FRAMES = { dropout: 0, backpack: 1, nerd: 2, bully: 3, librarian: 4 };
const TD_TOWER_FRAMES = { pencil: 0, star: 1, desk: 2, eraser: 3, popquiz: 4, ruler: 5, textbook: 6, trap: 7, firedrill: 8 };

// ============================================================
// MAIN SCENE
// ============================================================
class TowerDefenseScene extends Phaser.Scene {
    constructor() { super({ key: 'TowerDefenseScene' }); }

    preload() {
        // Load sprite sheets
        this.load.spritesheet('td_enemies', 'sprites/td/enemies.png', {
            frameWidth: 275, frameHeight: 768
        });
        this.load.spritesheet('td_towers', 'sprites/td/towers.png', {
            frameWidth: 341, frameHeight: 341
        });
    }

    create() {
        const W = this.scale.width, H = this.scale.height;

        // --- Layout calculation (portrait-optimized) ---
        const hudH = 48;
        const towerBarH = 72;
        const schoolH = 40;
        const playAreaH = H - hudH - towerBarH - schoolH;
        const playAreaW = Math.min(W, playAreaH * (TD_COLS / TD_ROWS)); // keep aspect
        const offsetX = (W - playAreaW) / 2;

        this.layout = { W, H, hudH, towerBarH, schoolH, playAreaH, playAreaW, offsetX };
        this.cellW = playAreaW / TD_COLS;
        this.cellH = playAreaH / TD_ROWS;
        this.gridTop = hudH;
        this.gridLeft = offsetX;
        this.schoolY = hudH + playAreaH; // top of school strip

        // --- Core state ---
        this.coins = TD_START_COINS;
        this.baseHp = TD_START_BASE_HP;
        this.maxBaseHp = TD_START_BASE_HP;
        this.score = 0;
        this.wave = 0;
        this.zombiesKilled = 0;
        this.eslAnswered = 0;
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.occupied = {};  // "col,row" -> tower
        this.elapsed = 0;
        this.gameOver = false;
        this.selectedTower = null;  // tower type key selected from bar
        this.eslSlowActive = false;
        this.eslSlowUntil = 0;
        this.spawnAccum = 0;
        this.waveTimer = 0;

        // --- Layers ---
        this.bgLayer = this.add.container(0, 0).setDepth(0);
        this.towerLayer = this.add.container(0, 0).setDepth(2);
        this.enemyLayer = this.add.container(0, 0).setDepth(3);
        this.projLayer = this.add.container(0, 0).setDepth(4);
        this.fxLayer = this.add.container(0, 0).setDepth(5);

        this.drawBackground();
        this.drawSchool();

        // --- Input ---
        this.input.on('pointerdown', (ptr) => this.onPointerDown(ptr));

        // --- HUD & Tower Bar (DOM) ---
        this.ensureHud();
        this.refreshHud();
        this.showTowerBar();

        // --- Spawn timer ---
        this.spawnTimer = this.time.addEvent({ delay: 500, loop: true, callback: () => this.trySpawn() });
    }

    // ---------------------------------------------------------
    // BACKGROUND & SCHOOL DRAWING
    // ---------------------------------------------------------
    drawBackground() {
        const { W, H, hudH, playAreaH, playAreaW, offsetX } = this.layout;
        const gfx = this.add.graphics();
        this.bgLayer.add(gfx);

        // Dark background
        gfx.fillStyle(0x1a1a2e, 1);
        gfx.fillRect(0, 0, W, H);

        // Grid tiles (school courtyard)
        for (let row = 0; row < TD_ROWS; row++) {
            for (let col = 0; col < TD_COLS; col++) {
                const x = offsetX + col * this.cellW;
                const y = hudH + row * this.cellH;
                const color = (col + row) % 2 === 0 ? 0x2d5a27 : 0x347a2c;
                gfx.fillStyle(color, 1);
                gfx.fillRect(x, y, this.cellW - 1, this.cellH - 1);
            }
        }

        // Grid lines
        gfx.lineStyle(1, 0x000000, 0.2);
        for (let col = 0; col <= TD_COLS; col++) {
            const x = offsetX + col * this.cellW;
            gfx.lineBetween(x, hudH, x, hudH + playAreaH);
        }
        for (let row = 0; row <= TD_ROWS; row++) {
            const y = hudH + row * this.cellH;
            gfx.lineBetween(offsetX, y, offsetX + playAreaW, y);
        }
    }

    drawSchool() {
        const { W, schoolH, playAreaW, offsetX } = this.layout;
        const y = this.schoolY;
        const gfx = this.add.graphics();
        this.bgLayer.add(gfx);

        // School building strip
        gfx.fillStyle(0x8B4513, 1);
        gfx.fillRect(offsetX, y, playAreaW, schoolH);
        gfx.fillStyle(0xA0522D, 1);
        gfx.fillRect(offsetX, y, playAreaW, 6);
        // Windows
        const winW = playAreaW / (TD_COLS * 2);
        for (let i = 0; i < TD_COLS; i++) {
            const wx = offsetX + i * this.cellW + this.cellW * 0.3;
            gfx.fillStyle(0x87CEEB, 1);
            gfx.fillRect(wx, y + 12, winW, schoolH - 20);
            gfx.fillStyle(0x5a3010, 1);
            gfx.fillRect(wx + winW/2 - 1, y + 12, 2, schoolH - 20);
        }
        // Door in center
        const doorX = offsetX + playAreaW / 2 - 10;
        gfx.fillStyle(0x654321, 1);
        gfx.fillRect(doorX, y + 10, 20, schoolH - 10);

        // School HP bar
        this.schoolHpGfx = this.add.graphics();
        this.bgLayer.add(this.schoolHpGfx);
        this.drawSchoolHp();

        // Flag
        const flagX = offsetX + playAreaW / 2;
        gfx.fillStyle(0x666666, 1);
        gfx.fillRect(flagX - 1, y - 16, 2, 16);
        gfx.fillStyle(0xff4444, 1);
        gfx.fillRect(flagX + 1, y - 16, 12, 8);
    }

    drawSchoolHp() {
        const { playAreaW, offsetX, schoolH } = this.layout;
        const g = this.schoolHpGfx;
        g.clear();
        const barW = playAreaW * 0.8;
        const barX = offsetX + (playAreaW - barW) / 2;
        const barY = this.schoolY + schoolH - 6;
        const pct = Phaser.Math.Clamp(this.baseHp / this.maxBaseHp, 0, 1);
        g.fillStyle(0x000000, 0.6); g.fillRect(barX, barY, barW, 5);
        const col = pct > 0.5 ? 0x4caf50 : pct > 0.25 ? 0xff9800 : 0xf44336;
        g.fillStyle(col, 1); g.fillRect(barX, barY, barW * pct, 5);
    }

    // ---------------------------------------------------------
    // COORDINATE HELPERS
    // ---------------------------------------------------------
    cellCenter(col, row) {
        return {
            x: this.gridLeft + col * this.cellW + this.cellW / 2,
            y: this.gridTop + row * this.cellH + this.cellH / 2
        };
    }
    colCenterX(col) { return this.gridLeft + col * this.cellW + this.cellW / 2; }

    // ---------------------------------------------------------
    // INPUT
    // ---------------------------------------------------------
    onPointerDown(ptr) {
        if (this.gameOver) return;
        const col = Math.floor((ptr.x - this.gridLeft) / this.cellW);
        const row = Math.floor((ptr.y - this.gridTop) / this.cellH);
        if (col < 0 || col >= TD_COLS || row < 0 || row >= TD_ROWS) {
            this.deselectTower();
            return;
        }
        const key = col + ',' + row;
        if (this.occupied[key]) {
            // Tap existing tower -> upgrade
            this.tryUpgrade(this.occupied[key]);
        } else if (this.selectedTower) {
            this.placeTower(this.selectedTower, col, row);
        }
    }

    deselectTower() {
        this.selectedTower = null;
        this.updateTowerBarSelection();
    }

    // ---------------------------------------------------------
    // TOWER PLACEMENT & UPGRADE
    // ---------------------------------------------------------
    selectTowerType(type) {
        if (this.selectedTower === type) { this.deselectTower(); return; }
        this.selectedTower = type;
        this.updateTowerBarSelection();
    }

    placeTower(type, col, row) {
        const def = TD_TOWERS[type];
        if (this.coins < def.cost) { this.tdBeep('error'); return; }
        const key = col + ',' + row;
        if (this.occupied[key]) return;

        this.coins -= def.cost;
        const c = this.cellCenter(col, row);
        const tower = {
            col, row, type, level: 1, x: c.x, y: c.y,
            lastFire: 0, lastCoin: 0, placedAt: this.time.now,
            armed: false, hp: def.hp, maxHp: def.hp, triggered: false
        };

        const gfx = this.add.image(c.x, c.y, 'td_towers', TD_TOWER_FRAMES[type]);
        const tSize = this.cellW * 0.75;
        gfx.setDisplaySize(tSize, tSize);
        gfx.setTint(0xffffff);
        tower.gfx = gfx;
        this.towerLayer.add(gfx);
        this.towers.push(tower);
        this.occupied[key] = tower;

        // Placement effect
        this.spawnPlaceEffect(c.x, c.y);
        this.tdBeep('shoot');
        this.refreshHud();
        this.deselectTower();
    }

    tryUpgrade(tower) {
        const def = TD_TOWERS[tower.type];
        if (def.oneTime) return; // can't upgrade one-time towers
        if (tower.level >= TD_MAX_LEVEL) { this.tdBeep('error'); return; }
        const cost = Math.round(def.cost * Math.pow(1.5, tower.level));
        if (this.coins < cost) { this.tdBeep('error'); return; }

        this.coins -= cost;
        tower.level++;
        if (def.hp > 0) {
            tower.maxHp = Math.round(def.hp * Math.pow(TD_UPGRADE_HP, tower.level - 1));
            tower.hp = tower.maxHp;
            this.drawTowerHp(tower);
        }
        // Scale up slightly and add glow tint for higher levels
        const tSize = this.cellW * 0.75 * (1 + (tower.level - 1) * 0.1);
        tower.gfx.setDisplaySize(tSize, tSize);
        if (tower.level === 2) tower.gfx.setTint(0xaaffaa);
        if (tower.level === 3) tower.gfx.setTint(0xffdd44);
        this.tweens.add({ targets: tower.gfx, scaleX: { from: tower.gfx.scaleX * 1.3, to: tower.gfx.scaleX }, scaleY: { from: tower.gfx.scaleY * 1.3, to: tower.gfx.scaleY }, duration: 200, ease: 'Back.out' });
        this.spawnCoinPopup(tower.x, tower.y - 20, 'Lv' + tower.level + '!', 0x00ff88);
        this.refreshHud();
    }

    removeTower(tower) {
        const key = tower.col + ',' + tower.row;
        delete this.occupied[key];
        const idx = this.towers.indexOf(tower);
        if (idx >= 0) this.towers.splice(idx, 1);
        if (tower.gfx) tower.gfx.destroy();
        if (tower.hpBar) tower.hpBar.destroy();
    }

    drawTowerHp(tower) {
        if (tower.maxHp === undefined || tower.hp >= tower.maxHp) {
            if (tower.hpBar) tower.hpBar.clear();
            return;
        }
        if (!tower.hpBar) {
            tower.hpBar = this.add.graphics();
            if (this.towerLayer) this.towerLayer.add(tower.hpBar);
        }
        const g = tower.hpBar; g.clear();
        const w = this.cellW * 0.6;
        const pct = Phaser.Math.Clamp(tower.hp / tower.maxHp, 0, 1);
        const bx = tower.x - w / 2, by = tower.y + this.cellH * 0.34;
        g.fillStyle(0x000000, 0.6); g.fillRect(bx, by, w, 3);
        g.fillStyle(pct > 0.5 ? 0x66bb6a : pct > 0.25 ? 0xff9800 : 0xf44336, 1);
        g.fillRect(bx, by, w * pct, 3);
    }

    // ---------------------------------------------------------
    // ENEMY SPAWNING
    // ---------------------------------------------------------
    getPhase() {
        for (const p of TD_PHASES) {
            if (this.elapsed < p.until) return p;
        }
        return TD_PHASES[TD_PHASES.length - 1];
    }

    trySpawn() {
        if (this.gameOver) return;
        const phase = this.getPhase();
        this.spawnAccum += 500; // timer fires every 500ms
        if (this.spawnAccum < phase.interval) return;
        this.spawnAccum = 0;
        this.wave++;

        const count = phase.count;
        for (let i = 0; i < count; i++) {
            this.time.delayedCall(i * 300, () => this.spawnOneEnemy(phase));
        }
    }

    spawnOneEnemy(phase) {
        if (this.gameOver) return;
        const typeKey = Phaser.Utils.Array.GetRandom(phase.types);
        const def = TD_ENEMIES[typeKey];

        // HP scaling with time
        const mins = this.elapsed / 60000;
        let hpScale = phase.hpMult;
        if (mins > 5) hpScale *= Math.pow(1.2, mins - 5);
        else if (mins > 2) hpScale *= 1 + (mins - 2) * 0.15;

        const hp = Math.round(def.hp * hpScale);
        const col = Phaser.Math.Between(0, TD_COLS - 1);
        const x = this.colCenterX(col);
        const y = this.gridTop - 20; // spawn above grid

        const gfx = this.add.image(x, y, 'td_enemies', TD_ENEMY_FRAMES[typeKey]);
        const eH = this.cellH * 0.85;
        const eW = eH * (275 / 768); // maintain aspect ratio
        gfx.setDisplaySize(eW, eH);

        const enemy = {
            type: typeKey, col, x, y, hp, maxHp: hp,
            speed: def.speed, coins: def.coins, dmg: def.dmg,
            armor: def.armor, armorHp: def.armorHp, currentArmorHp: def.armorHp,
            jump: def.jump, enrage: def.enrage, enraged: false,
            hasJumped: false, dead: false, frame: 0, frameTimer: 0, lastDrawnFrame: -1,
            slowUntil: 0, gfx, attacking: null
        };

        // HP bar
        enemy.hpBar = this.add.graphics();
        this.enemyLayer.add(gfx);
        this.enemyLayer.add(enemy.hpBar);
        this.enemies.push(enemy);
    }

    // ---------------------------------------------------------
    // ENEMY UPDATE (top-to-bottom movement)
    // ---------------------------------------------------------
    updateEnemies(dt) {
        const now = this.time.now;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.dead) { this.removeEnemy(i); continue; }

            // Animation frame
            e.frameTimer += dt;
            if (e.frameTimer > 300) { e.frameTimer = 0; e.frame = e.frame === 0 ? 1 : 0; }

            // Speed calculation
            let speed = e.speed;
            // ESL slow
            if (this.eslSlowActive || now < this.eslSlowUntil) speed *= TD_ESL_SLOW_FACTOR;
            // Individual slow (from eraser)
            if (now < e.slowUntil) speed *= 0.6;
            // Enrage (librarian)
            if (e.enrage && !e.enraged && e.hp < e.maxHp * 0.3) {
                e.enraged = true;
                speed *= 2;
                this.spawnCoinPopup(e.x, e.y - 15, '!', 0xff0000);
            }
            if (e.enraged) speed *= 2;

            // Check for a tower (any type) in the current cell
            const row = Math.floor((e.y - this.gridTop) / this.cellH);
            const col = e.col;
            const key = col + ',' + row;
            const towerHere = this.occupied[key];

            // Zombies chomp ANY tower in their path (the trap is a mine — it triggers instead)
            if (towerHere && towerHere.type !== 'trap' && towerHere.hp > 0 && !e.attacking) {
                // Bully vaults over the FIRST tower it meets
                if (e.jump && !e.hasJumped) {
                    e.hasJumped = true;
                    e.y += this.cellH; // vault over
                    this.spawnCoinPopup(e.x, e.y, 'Vault!', 0xffaa00);
                } else {
                    e.attacking = towerHere;
                }
            }

            if (e.attacking) {
                // Deal damage to the tower being eaten
                if (e.attacking.hp !== undefined && e.attacking.hp > 0) {
                    e.attacking.hp -= e.dmg * (dt / 1000) * 3;
                    this.drawTowerHp(e.attacking);
                    if (e.attacking.hp <= 0) {
                        this.spawnExplosion(e.attacking.x, e.attacking.y, 0x8B4513);
                        this.tdBeep('hit');
                        this.removeTower(e.attacking);
                        e.attacking = null;
                    }
                } else {
                    e.attacking = null;
                }
            } else {
                // Move downward
                e.y += speed * (dt / 1000);
            }

            // Check homework trap
            if (row >= 0 && row < TD_ROWS) {
                const trapKey = col + ',' + row;
                const trap = this.occupied[trapKey];
                if (trap && trap.type === 'trap' && trap.armed && !trap.triggered) {
                    trap.triggered = true;
                    this.damageEnemy(e, TD_TOWERS.trap.damage, 0);
                    this.spawnExplosion(trap.x, trap.y, 0xffff00);
                    this.tdBeep('hit');
                    this.removeTower(trap);
                }
            }

            // Update position
            e.gfx.setPosition(e.x, e.y);
            // Simple walk sway animation
            e.gfx.rotation = Math.sin(this.time.now / 200 + e.col * 2) * 0.05;
            this.drawEnemyHpBar(e);

            // Reached school?
            if (e.y >= this.schoolY) {
                this.enemyReachSchool(e, i);
            }
        }
    }

    drawEnemyHpBar(e) {
        const g = e.hpBar; g.clear();
        const w = this.cellW * 0.6;
        const pct = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
        const bx = e.x - w / 2, by = e.y - this.cellH * 0.45;
        g.fillStyle(0x000000, 0.6); g.fillRect(bx, by, w, 3);
        g.fillStyle(pct > 0.5 ? 0x4caf50 : pct > 0.25 ? 0xff9800 : 0xf44336, 1);
        g.fillRect(bx, by, w * pct, 3);
    }

    enemyReachSchool(e, i) {
        this.baseHp -= e.dmg;
        this.tdBeep('error');
        this.cameras.main.shake(150, 0.005);
        this.removeEnemy(i);
        this.drawSchoolHp();
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
        // Armor handling
        let actualDmg = dmg;
        if (e.currentArmorHp > 0) {
            actualDmg = dmg * (1 - e.armor);
            e.currentArmorHp -= dmg;
            if (e.currentArmorHp < 0) e.currentArmorHp = 0;
        }
        e.hp -= actualDmg;
        if (slowFactor > 0) e.slowUntil = this.time.now + 2000;

        if (e.hp <= 0 && !e.dead) {
            e.dead = true;
            this.coins += e.coins;
            this.score += e.coins * 10;
            this.zombiesKilled++;
            this.tdBeep('hit');
            this.spawnDeathParticles(e.x, e.y, e.type);
            this.spawnCoinPopup(e.x, e.y - 10, '+' + e.coins, 0xffd700);
            this.refreshHud();
        }
    }

    // ---------------------------------------------------------
    // TOWER COMBAT (fires upward in column)
    // ---------------------------------------------------------
    updateTowers(now) {
        for (const t of this.towers) {
            const def = TD_TOWERS[t.type];

            // Arm one-time towers
            if (def.oneTime && def.armTime && !t.armed) {
                if (now - t.placedAt >= def.armTime) {
                    t.armed = true;
                    if (t.type === 'firedrill') this.triggerFireDrill(t);
                    if (t.type === 'popquiz') this.triggerPopQuiz(t);
                }
                continue;
            }

            // Coin generator
            if (def.type === 'generator') {
                if (now - t.lastCoin >= (def.coinInterval || 8000)) {
                    t.lastCoin = now;
                    const gen = def.coinGen * t.level;
                    this.coins += gen;
                    this.spawnCoinPopup(t.x, t.y - 15, '+' + gen, 0xffd700);
                    this.refreshHud();
                }
                continue;
            }

            // Blockers and mines don't shoot
            if (def.type === 'blocker' || def.type === 'mine' || def.type === 'bomb' || def.type === 'lanebomb') continue;

            // Shooter logic
            const rate = def.fireRate * Math.pow(TD_UPGRADE_RATE, t.level - 1);
            if (now - t.lastFire < rate) continue;

            const dmg = def.damage * Math.pow(TD_UPGRADE_DMG, t.level - 1);

            // Find target: nearest enemy in same column, above the tower
            let target = null, bestDist = Infinity;
            for (const e of this.enemies) {
                if (e.dead || e.col !== t.col) continue;
                if (e.y >= t.y) continue; // must be above
                const d = t.y - e.y;
                if (d < bestDist) { bestDist = d; target = e; }
            }

            if (target) {
                t.lastFire = now;
                this.fireProjectile(t, target, dmg, def);
                if (def.doubleShot) {
                    this.time.delayedCall(120, () => {
                        if (!target.dead) this.fireProjectile(t, target, dmg, def);
                    });
                }
                this.tdBeep('shoot');
            }
        }
    }

    fireProjectile(tower, target, dmg, def) {
        const gfx = this.add.graphics();
        // Projectile appearance by type
        if (tower.type === 'eraser') {
            gfx.fillStyle(0x88ccff, 0.8); gfx.fillCircle(0, 0, 5);
        } else if (tower.type === 'textbook') {
            gfx.fillStyle(0x4488ff, 1); gfx.fillRect(-4, -2, 8, 4);
        } else if (tower.type === 'ruler') {
            gfx.fillStyle(0xdeb887, 1); gfx.fillRect(-2, -5, 4, 10);
        } else {
            gfx.fillStyle(0xffdd00, 1); gfx.fillCircle(0, 0, 3);
            gfx.fillStyle(0x333333, 1); gfx.fillCircle(0, -3, 1.5); // pencil tip
        }
        gfx.setPosition(tower.x, tower.y - this.cellH * 0.3);
        this.projLayer.add(gfx);
        this.projectiles.push({
            gfx, x: tower.x, y: tower.y - this.cellH * 0.3,
            target, speed: def.projSpeed, damage: dmg,
            slow: def.slow, pierce: def.pierce, col: tower.col,
            hitList: []
        });
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (!p.target || p.target.dead) {
                if (!p.pierce) { p.gfx.destroy(); this.projectiles.splice(i, 1); continue; }
            }

            // Move upward
            p.y -= p.speed * (dt / 1000);
            p.gfx.setPosition(p.x, p.y);

            // Off screen
            if (p.y < this.gridTop - 30) { p.gfx.destroy(); this.projectiles.splice(i, 1); continue; }

            // Collision check
            if (p.pierce) {
                // Piercing: hit all enemies in column
                for (const e of this.enemies) {
                    if (e.dead || e.col !== p.col) continue;
                    if (p.hitList.includes(e)) continue;
                    if (Math.abs(e.y - p.y) < this.cellH * 0.5) {
                        p.hitList.push(e);
                        this.damageEnemy(e, p.damage, p.slow);
                        this.spawnHitSpark(e.x, e.y);
                    }
                }
            } else {
                // Single target
                if (p.target && !p.target.dead) {
                    if (Math.abs(p.target.y - p.y) < this.cellH * 0.5 && p.target.col === p.col) {
                        this.damageEnemy(p.target, p.damage, p.slow);
                        this.spawnHitSpark(p.target.x, p.target.y);
                        p.gfx.destroy();
                        this.projectiles.splice(i, 1);
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------
    // ONE-TIME TOWER EFFECTS
    // ---------------------------------------------------------
    triggerPopQuiz(tower) {
        // 3x3 AOE around tower position
        const range = this.cellW * 1.5;
        for (const e of this.enemies) {
            if (e.dead) continue;
            const dist = Phaser.Math.Distance.Between(tower.x, tower.y, e.x, e.y);
            if (dist <= range) {
                this.damageEnemy(e, TD_TOWERS.popquiz.damage, 0);
            }
        }
        this.spawnExplosion(tower.x, tower.y, 0xff3333);
        this.cameras.main.shake(200, 0.008);
        this.tdBeep('hit');
        this.removeTower(tower);
    }

    triggerFireDrill(tower) {
        // Destroy all enemies in the column
        for (const e of this.enemies) {
            if (e.dead || e.col !== tower.col) continue;
            this.damageEnemy(e, 9999, 0);
        }
        // Visual: fire column
        const gfx = this.add.graphics();
        gfx.setDepth(6);
        const x = this.colCenterX(tower.col);
        gfx.fillStyle(0xff6600, 0.6);
        gfx.fillRect(x - this.cellW / 2, this.gridTop, this.cellW, this.layout.playAreaH);
        this.fxLayer.add(gfx);
        this.tweens.add({ targets: gfx, alpha: 0, duration: 600, onComplete: () => gfx.destroy() });
        this.cameras.main.shake(250, 0.01);
        this.tdBeep('hit');
        this.removeTower(tower);
    }

    // ---------------------------------------------------------
    // ESL INTEGRATION
    // ---------------------------------------------------------
    startESL() {
        if (this.gameOver) return;
        this.eslSlowActive = true;
        this.showSlowOverlay(true);
        this.closeTowerUpgrade();
        if (typeof startMiniGame === 'function') startMiniGame('spelling', 'towerdefense');
    }

    onESLComplete(success) {
        this.eslSlowActive = false;
        if (success) {
            this.coins += 50;
            this.eslAnswered++;
            this.eslSlowUntil = this.time.now + TD_ESL_LINGER_MS;
            this.spawnCoinPopup(this.layout.W / 2, this.layout.H / 2, '+50 coins!', 0x00ff88);
            this.refreshHud();
            // Hide overlay after linger
            this.time.delayedCall(TD_ESL_LINGER_MS, () => this.showSlowOverlay(false));
        } else {
            this.showSlowOverlay(false);
        }
    }

    showSlowOverlay(show) {
        const el = document.getElementById('tdSlowOverlay');
        if (el) el.classList.toggle('hidden', !show);
    }

    // ---------------------------------------------------------
    // VISUAL EFFECTS
    // ---------------------------------------------------------
    spawnPlaceEffect(x, y) {
        const g = this.add.graphics(); g.setDepth(5);
        g.lineStyle(2, 0x00ff88, 0.8);
        g.strokeCircle(x, y, 5);
        this.fxLayer.add(g);
        this.tweens.add({ targets: g, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 300, onComplete: () => g.destroy() });
    }

    spawnHitSpark(x, y) {
        const g = this.add.graphics(); g.setDepth(5);
        g.fillStyle(0xffffff, 1);
        for (let i = 0; i < 3; i++) {
            const ox = Phaser.Math.Between(-6, 6), oy = Phaser.Math.Between(-6, 6);
            g.fillRect(x + ox, y + oy, 2, 2);
        }
        this.fxLayer.add(g);
        this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
    }

    spawnExplosion(x, y, color) {
        const g = this.add.graphics(); g.setDepth(6);
        g.fillStyle(color, 0.7);
        g.fillCircle(x, y, 8);
        this.fxLayer.add(g);
        this.tweens.add({ targets: g, scaleX: 3, scaleY: 3, alpha: 0, duration: 400, ease: 'Quad.out', onComplete: () => g.destroy() });
    }

    spawnDeathParticles(x, y, type) {
        const colors = { dropout: 0x7ab648, backpack: 0x5a9e3a, nerd: 0x4a8e6a, bully: 0x9e5a3a, librarian: 0x6a7ab6 };
        const color = colors[type] || 0x7ab648;
        for (let i = 0; i < 6; i++) {
            const g = this.add.graphics(); g.setDepth(5);
            g.fillStyle(color, 1);
            g.fillRect(x, y, 3, 3);
            this.fxLayer.add(g);
            const tx = x + Phaser.Math.Between(-30, 30);
            const ty = y + Phaser.Math.Between(-30, 30);
            this.tweens.add({ targets: g, x: tx, y: ty, alpha: 0, duration: 400, ease: 'Quad.out', onComplete: () => g.destroy() });
        }
    }

    spawnCoinPopup(x, y, text, color) {
        const txt = this.add.text(x, y, text, {
            fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold',
            color: '#' + color.toString(16).padStart(6, '0'), stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(7);
        this.fxLayer.add(txt);
        this.tweens.add({ targets: txt, y: y - 25, alpha: 0, duration: 800, ease: 'Quad.out', onComplete: () => txt.destroy() });
    }

    // ---------------------------------------------------------
    // HUD (DOM)
    // ---------------------------------------------------------
    ensureHud() {
        const hud = document.getElementById('tdHUD');
        if (hud) hud.classList.remove('hidden');
        const go = document.getElementById('tdGameOverScreen');
        if (go) go.classList.add('hidden');
        const bar = document.getElementById('tdTowerBar');
        if (bar) bar.classList.remove('hidden');
    }

    refreshHud() {
        const c = document.getElementById('tdCoins');
        const hp = document.getElementById('tdBaseHp');
        const w = document.getElementById('tdWave');
        if (c) c.textContent = this.coins;
        if (hp) hp.textContent = Math.max(0, this.baseHp);
        if (w) w.textContent = this.wave;
        // Update tower bar affordability
        this.updateTowerBarAffordability();
    }

    showTowerBar() {
        const bar = document.getElementById('tdTowerBar');
        if (!bar) return;
        const wrap = bar.querySelector('#tdTowerBarItems');
        if (!wrap) return;
        wrap.innerHTML = '';
        TD_TOWER_ORDER.forEach(key => {
            const def = TD_TOWERS[key];
            const btn = document.createElement('button');
            btn.className = 'td-tower-btn';
            btn.dataset.type = key;
            btn.innerHTML = `<span class="td-tower-icon">${def.icon}</span><span class="td-tower-cost">${def.cost}</span>`;
            btn.title = def.name;
            btn.onclick = (e) => { e.stopPropagation(); this.selectTowerType(key); };
            wrap.appendChild(btn);
        });
    }

    updateTowerBarSelection() {
        const btns = document.querySelectorAll('.td-tower-btn');
        btns.forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.type === this.selectedTower);
        });
    }

    updateTowerBarAffordability() {
        const btns = document.querySelectorAll('.td-tower-btn');
        btns.forEach(btn => {
            const def = TD_TOWERS[btn.dataset.type];
            btn.classList.toggle('unaffordable', this.coins < def.cost);
        });
    }

    closeTowerUpgrade() { /* placeholder for any open upgrade popup */ }

    // ---------------------------------------------------------
    // GAME LOOP
    // ---------------------------------------------------------
    update(time, dt) {
        if (this.gameOver) return;
        this.elapsed += dt;

        // Arm mines
        for (const t of this.towers) {
            const def = TD_TOWERS[t.type];
            if (t.type === 'trap' && !t.armed && time - t.placedAt >= (def.armTime || 5000)) {
                t.armed = true;
                // Visual: show armed state
                t.gfx.setAlpha(1);
            }
        }

        this.updateEnemies(dt);
        this.updateTowers(time);
        this.updateProjectiles(dt);

        // Tower idle bob animation
        for (const t of this.towers) {
            if (t.gfx && !TD_TOWERS[t.type].oneTime) {
                t.gfx.y = t.y + Math.sin(time / 600 + t.col + t.row) * 1.5;
            }
        }
    }

    // ---------------------------------------------------------
    // GAME OVER
    // ---------------------------------------------------------
    endGame(won) {
        if (this.gameOver) return;
        this.gameOver = true;
        this.spawnTimer.paused = true;
        this.showSlowOverlay(false);

        const go = document.getElementById('tdGameOverScreen');
        if (go) {
            go.querySelector('#tdGameOverText').textContent = won ? 'School Defended!' : 'School Overrun!';
            go.querySelector('#tdFinalScore').textContent = 'Score: ' + this.score;
            const stats = go.querySelector('#tdStats');
            if (stats) stats.textContent = `Waves: ${this.wave} | Kills: ${this.zombiesKilled} | ESL: ${this.eslAnswered} | Time: ${Math.floor(this.elapsed/1000)}s`;
            go.classList.remove('hidden');
        }
        const hud = document.getElementById('tdHUD'); if (hud) hud.classList.add('hidden');
        const bar = document.getElementById('tdTowerBar'); if (bar) bar.classList.add('hidden');
    }

    // ---------------------------------------------------------
    // AUDIO
    // ---------------------------------------------------------
    tdBeep(kind) {
        if (kind === 'shoot' && typeof synthShoot === 'function') synthShoot();
        else if (kind === 'hit' && typeof synthHit === 'function') synthHit();
        else if (kind === 'error' && typeof synthError === 'function') synthError();
    }
}

// Self-register
if (typeof config !== 'undefined' && config.scene) {
    registerScene(TowerDefenseScene);
}

// ============================================================
// GLOBAL HOOKS (wired into DOM buttons in index.html)
// ============================================================
function triggerTowerDefense() {
    if (typeof TD_ENABLED !== 'undefined' && !TD_ENABLED) {
        applyTowerDefenseGate();
        const picker = document.getElementById('gameSelectionOverlay');
        if (picker && picker.classList.contains('hidden')) {
            if (typeof showGameSelection === 'function') showGameSelection();
            else picker.classList.remove('hidden');
        }
        return;
    }

    activeGameMode = 'TowerDefense';
    ['startScreen', 'gameSelectionOverlay', 'gomokuScreen', 'gomokuGameOverScreen',
        'gomokuModeSelectionOverlay', 'gomokuDifficultySelectionOverlay',
        'gameOverScreen', 'gameIntroOverlay', 'studyModeOverlay', 'unoScreen',
        'unoGameOverScreen', 'tdGameOverScreen', 'hud'
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

function tdStartESL() {
    const scene = game && game.scene.getScene('TowerDefenseScene');
    if (scene) scene.startESL();
}

function tdCreditCoins(n) {
    const scene = game && game.scene.getScene('TowerDefenseScene');
    if (scene) scene.onESLComplete(n > 0);
}

function tdReturnToMenu() {
    const hud = document.getElementById('tdHUD'); if (hud) hud.classList.add('hidden');
    const go = document.getElementById('tdGameOverScreen'); if (go) go.classList.add('hidden');
    const bar = document.getElementById('tdTowerBar'); if (bar) bar.classList.add('hidden');
    const overlay = document.getElementById('tdSlowOverlay'); if (overlay) overlay.classList.add('hidden');
    if (game && game.scene.isActive('TowerDefenseScene')) game.scene.stop('TowerDefenseScene');
    activeGameMode = null;
    if (typeof showGameSelection === 'function') showGameSelection();
    else { const e = document.getElementById('gameSelectionOverlay'); if (e) e.classList.remove('hidden'); }
    // Restore main game HUD visibility for other modes
    const mainHud = document.getElementById('hud'); if (mainHud) mainHud.classList.remove('hidden');
}

function applyTowerDefenseGate() {
    if (typeof TD_ENABLED !== 'undefined' && TD_ENABLED) return;
    const btn = document.getElementById('towerDefenseBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.classList.remove('bg-green-600', 'hover:bg-green-500');
    btn.classList.add('bg-gray-600', 'opacity-60', 'cursor-not-allowed', 'grayscale');
    let sub = btn.querySelector('.td-coming-soon');
    if (!sub) {
        sub = document.createElement('span');
        sub.className = 'td-coming-soon block text-sm font-normal mt-1 opacity-80';
        btn.appendChild(sub);
    }
    sub.textContent = 'Coming soon — not ready yet';
}

// Legacy compat stubs
function tdBuild() {}
function tdUpgrade() {}
function tdEarnCoins() { tdStartESL(); }
function tdCloseMenu() {}
