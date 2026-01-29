// --- CONTENT MANAGEMENT ---
let SPELLING_WORDS = [];
let SIGHT_WORDS = [];
let GRAMMAR_SENTENCES = [];

// AVAILABLE_CONTENT is now moved to teaching_content.js


// --- AUDIO SYSTEM ---
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
const osc = (type, freq, dur, vol = 0.1) => {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur);
}
const noise = (dur) => {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * dur;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const n = audioCtx.createBufferSource();
    n.buffer = buffer;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    n.connect(g); g.connect(audioCtx.destination);
    n.start();
}
const synthShoot = (type) => {
    if (type === 'wand') osc('sine', 800, 0.1, 0.05);
    if (type === 'whip') noise(0.2);
    if (type === 'orb') osc('triangle', 200, 0.3, 0.05);
    if (type === 'axe') osc('square', 150, 0.15, 0.05);
    if (type === 'cross') osc('sine', 600, 0.2, 0.05);
    if (type === 'knife') osc('sawtooth', 1000, 0.1, 0.02);
    if (type === 'garlic') osc('sine', 100, 0.5, 0.02);
};
const synthHit = () => osc('square', 100, 0.1, 0.05);
const synthGem = () => osc('sine', 1200, 0.1, 0.05);
const synthLevelUp = () => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [440, 554, 659, 880].forEach((f, i) => {
        const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
        o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.1, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.3);
    });
};
const synthHurt = () => {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.3);
}
const synthError = () => {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(100, audioCtx.currentTime);
    o.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.2);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.2);
};
let currentTTSWord = "";
const playTTS = () => {
    if (!currentTTSWord) return;
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(currentTTSWord)}&type=1`;
    const audio = new Audio(url);
    audio.play().catch(e => console.log("TTS play failed", e));
};

// --- GAME DATA ---
const POWER_UPS = [
    { id: 'whip', name: "Magic Whip", icon: "🪄", type: "weapon", desc: "Front Attack" },
    { id: 'wand', name: "Spirit Wand", icon: "✨", type: "weapon", desc: "Fires at nearest enemy" },
    { id: 'orb', name: "Orbit", icon: "🔮", type: "weapon", desc: "Spins around you" },
    { id: 'axe', name: "Axe", icon: "🪓", type: "weapon", desc: "Add one more axe" },
    { id: 'cross', name: "Cross", icon: "✝️", type: "weapon", desc: "Boomerang effect" },
    { id: 'water', name: "Santa Water", icon: "💧", type: "weapon", desc: "Drops damaging puddle" },
    { id: 'knife', name: "Knife", icon: "🔪", type: "weapon", desc: "Fires in facing direction" },
    { id: 'speed', name: "Swiftness", icon: "👟", type: "stat", desc: "+10% Move Speed" },
    { id: 'might', name: "Spinach", icon: "🥬", type: "stat", desc: "+10% Damage" },
    { id: 'recover', name: "Heart", icon: "❤️", type: "heal", desc: "Heal 30 HP" }
];

// --- PHASER CONFIG ---
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: document.body,
    backgroundColor: '#2d5016',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: null,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: {
        activePointers: 3
    }
};

let game;

// --- MAIN SCENE ---
class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    create() {
        this.frameTime = 0;
        this.gameState = 'PLAYING';
        this.gameTime = 0;
        this.accumulatedTime = 0;
        this.spawnTimer = 0;
        this.killCount = 0;

        this.playerStats = {
            hp: 100, maxHp: 100,
            level: 1, xp: 0, nextLevelXp: 30,
            might: 1, speed: 1, cooldown: 1,
            weapons: []
        };
        this.knockbackVelocity = { x: 0, y: 0 };
        this.invulnTimer = 0;

        this.physics.world.setBounds(-4000, -4000, 8000, 8000); // Large world

        // Grass Texture for TiledSprite
        const gr = this.make.graphics({ x: 0, y: 0, add: false });
        gr.fillStyle(0x2d5016);
        gr.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 50; i++) {
            gr.fillStyle(0x3d6b1e, 0.5);
            gr.fillCircle(Phaser.Math.Between(0, 512), Phaser.Math.Between(0, 512), Phaser.Math.Between(2, 10));
        }
        gr.generateTexture('grass', 512, 512);

        this.bg = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'grass').setOrigin(0, 0);
        this.bg.setScrollFactor(0);

        // Optimize mobile touch (remove 300ms double-tap delay)
        this.game.canvas.style.touchAction = 'none';
        // Mobile Optimization: Aggressive touch handling
        this.game.canvas.style.touchAction = 'none';
        document.body.style.touchAction = 'none';
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        document.body.style.overflow = 'hidden';

        // Prevent default browser gestures (zoom, scroll)
        const preventDefault = (e) => {
            if (e.target === this.game.canvas) {
                e.preventDefault();
            }
        };
        window.addEventListener('touchstart', preventDefault, { passive: false });
        window.addEventListener('touchmove', preventDefault, { passive: false });
        window.addEventListener('touchend', preventDefault, { passive: false });
        window.addEventListener('touchcancel', preventDefault, { passive: false });

        this.scale.on('resize', this.handleResize, this);
        this.handleResize(this.scale.gameSize);

        this.input.addPointer(2); // Support multitouch (joystick + tap)

        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.gems = this.physics.add.group();
        this.obstacles = this.physics.add.staticGroup();

        // Player
        this.player = this.add.text(0, 0, '🧙‍♂️', { fontSize: '50px', padding: { top: 10 } }).setOrigin(0.5);
        this.physics.add.existing(this.player);
        this.player.body.setCircle(20);
        this.player.body.setCollideWorldBounds(false);

        this.cameras.main.startFollow(this.player);

        // Spawn environmental obstacles (after player exists)
        this.spawnObstacles();

        // Inputs
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

        // Joystick
        this.input.addPointer(2); // Ensure we have enough pointers (Mouse + Touch1 + Touch2 + Touch3)
        this.joystick = { active: false, x: 0, y: 0, originX: 0, originY: 0, angle: 0, force: 0, pointerId: null };

        this.input.on('pointerdown', (pointer) => {
            // Only activate if not already active
            if (!this.joystick.active && pointer.y > this.scale.height * 0.5) { // Increased hit area to bottom 50%
                this.joystick.active = true;
                this.joystick.pointerId = pointer.id;
                this.joystick.originX = pointer.x;
                this.joystick.originY = pointer.y;
                this.joystick.x = pointer.x;
                this.joystick.y = pointer.y;
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (this.joystick.active && pointer.id === this.joystick.pointerId) {
                const maxDist = 50;
                const dx = pointer.x - this.joystick.originX;
                const dy = pointer.y - this.joystick.originY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                const clampDist = Math.min(dist, maxDist);
                this.joystick.x = this.joystick.originX + Math.cos(angle) * clampDist;
                this.joystick.y = this.joystick.originY + Math.sin(angle) * clampDist;
                this.joystick.angle = angle;
                this.joystick.force = clampDist / maxDist;
            }
        });

        this.input.on('pointerup', (pointer) => {
            if (this.joystick.active && pointer.id === this.joystick.pointerId) {
                this.joystick.active = false;
                this.joystick.force = 0;
                this.joystick.pointerId = null;
            }
        });
        this.joyGraphics = this.add.graphics().setScrollFactor(0);

        // Collisions
        this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
            if (b.type === 'axe' || b.type === 'cross') {
                if (b.hitList && b.hitList.includes(e)) return;
                if (!b.hitList) b.hitList = [];
                b.hitList.push(e);
                this.damageEnemy(e, b.dmg, 200);
            } else {
                this.damageEnemy(e, b.dmg, 100);
                b.destroy();
            }
        });
        this.physics.add.overlap(this.player, this.gems, (p, g) => {
            if (g.type === 'chest') {
                this.triggerTreasureEvent();
            } else {
                this.addXp(g.val);
                synthGem();
            }
            g.destroy();
        });
        this.physics.add.collider(this.enemies, this.enemies);
        this.physics.add.collider(this.player, this.enemies, this.handlePlayerHit, null, this);
        this.physics.add.collider(this.player, this.obstacles);
        this.physics.add.collider(this.enemies, this.obstacles);

        this.applyReward({ id: 'wand', name: 'Spirit Wand', type: 'weapon' });
        updateDOMHUD(this.playerStats, 0, 0);

        // Initial Horde
        for (let i = 0; i < 50; i++) {
            this.spawnEnemy(Phaser.Math.Between(300, 1000));
        }
    }

    update(time, delta) {
        if (this.gameState !== 'PLAYING') return;

        // Player Move
        let dx = 0, dy = 0;
        const speed = 200 * this.playerStats.speed;
        if (this.cursors.left.isDown || this.wasd.a.isDown) dx = -1;
        else if (this.cursors.right.isDown || this.wasd.d.isDown) dx = 1;
        if (this.cursors.up.isDown || this.wasd.w.isDown) dy = -1;
        else if (this.cursors.down.isDown || this.wasd.s.isDown) dy = 1;

        if (this.joystick.active) {
            dx = Math.cos(this.joystick.angle) * this.joystick.force;
            dy = Math.sin(this.joystick.angle) * this.joystick.force;
        } else if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len; dy /= len;
        }

        // Apply Knockback Friction
        this.knockbackVelocity.x *= 0.9;
        this.knockbackVelocity.y *= 0.9;
        if (Math.abs(this.knockbackVelocity.x) < 10) this.knockbackVelocity.x = 0;
        if (Math.abs(this.knockbackVelocity.y) < 10) this.knockbackVelocity.y = 0;

        this.player.body.setVelocity((dx * speed) + this.knockbackVelocity.x, (dy * speed) + this.knockbackVelocity.y);

        if (this.invulnTimer > 0) {
            this.invulnTimer--;
            this.player.alpha = this.invulnTimer % 10 < 5 ? 0.5 : 1;
        } else {
            this.player.alpha = 1;
        }
        if (dx < 0) this.player.setScale(-1, 1);
        if (dx > 0) this.player.setScale(1, 1);

        this.bg.tilePositionX = this.cameras.main.scrollX;
        this.bg.tilePositionY = this.cameras.main.scrollY;

        this.joyGraphics.clear();
        if (this.joystick.active) {
            this.joyGraphics.lineStyle(2, 0xffffff, 0.5);
            this.joyGraphics.strokeCircle(this.joystick.originX, this.joystick.originY, 50);
            this.joyGraphics.fillStyle(0xffffff, 0.5);
            this.joyGraphics.fillCircle(this.joystick.x, this.joystick.y, 20);
        }

        this.spawnTimer++;
        // Spawn faster: base 40 frames delay, decreasing. Min 2 frames delay.
        if (this.spawnTimer > Math.max(2, 40 - (this.playerStats.level * 2))) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }

        this.updateWeapons();
        this.updateBullets();
        this.updateGems();
        this.gameTime++;
        this.accumulatedTime += delta;
        updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);

        // Continuous obstacle spawning and cleanup
        this.obstacleTimer = (this.obstacleTimer || 0) + 1;
        if (this.obstacleTimer > 30 && this.obstacles.getChildren().length < 150) {
            this.spawnSingleObstacle();
            this.obstacleTimer = 0;
        }
        if (this.gameTime % 120 === 0) {
            this.cleanupDistantObstacles();
        }
    }

    spawnEnemy(distance = null) {
        if (this.killCount >= 300) { // Increased threshold for boss
            this.spawnBoss();
            this.killCount = 0;
            return;
        }
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);

        let dist = distance;
        if (dist === null) {
            const cam = this.cameras.main;
            // Calculate distance to corner + margin
            dist = Math.sqrt(Math.pow(cam.width, 2) + Math.pow(cam.height, 2)) / 2 + 100;
        }

        const ex = this.player.x + Math.cos(angle) * dist;
        const ey = this.player.y + Math.sin(angle) * dist;

        const type = Math.floor(this.gameTime / 1800) % 3;
        let sprite = type === 1 ? '🦇' : (type === 2 ? '🧟' : '👾');

        // Weaker HP, but higher spawn rate handled in update
        const hp = 2 + (this.playerStats.level * 1);
        const speed = (50 + (Math.random() * 30) + (this.playerStats.level * 2));

        const enemy = this.add.text(ex, ey, sprite, { fontSize: '25px', padding: { top: 5 } }).setOrigin(0.5);
        this.physics.add.existing(enemy);
        enemy.body.setCircle(10); // Smaller collider
        enemy.hp = hp; enemy.maxHp = hp; enemy.speed = speed; enemy.isBoss = false;
        enemy.stunTimer = 0;
        this.enemies.add(enemy);
    }

    spawnBoss() {
        const boss = this.add.text(this.player.x, this.player.y - 600, '👹', { fontSize: '80px', padding: { top: 20 } }).setOrigin(0.5);
        this.physics.add.existing(boss);
        boss.body.setCircle(35);
        boss.hp = 300 + (this.playerStats.level * 50);
        boss.speed = 100;
        boss.isBoss = true;
        boss.stunTimer = 0;
        this.enemies.add(boss);
    }

    spawnEnemyCircle() {
        // Encircle event: 80 enemies in a tight ring (no gaps)
        const count = 80;
        const radius = 600;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const ex = this.player.x + Math.cos(angle) * radius;
            const ey = this.player.y + Math.sin(angle) * radius;

            const sprite = '🧟';
            const hp = 2 + (this.playerStats.level * 1);
            const speed = 80 + (this.playerStats.level * 1); // Slightly faster charge?

            const enemy = this.add.text(ex, ey, sprite, { fontSize: '25px', padding: { top: 5 } }).setOrigin(0.5);
            this.physics.add.existing(enemy);
            enemy.body.setCircle(10);
            enemy.hp = hp; enemy.maxHp = hp; enemy.speed = speed; enemy.isBoss = false;
            enemy.stunTimer = 0;
            this.enemies.add(enemy);
        }
    }

    spawnObstacles() {
        // Initial batch around player start
        for (let i = 0; i < 80; i++) {
            this.spawnSingleObstacle(Phaser.Math.Between(400, 1500));
        }
    }

    spawnSingleObstacle(distance = null) {
        const obstacleTypes = [
            { emoji: '🌲', fontSize: '200px', bodyRad: 20, isTree: true },
            { emoji: '🌳', fontSize: '200px', bodyRad: 20, isTree: true },
            { emoji: '🪨', fontSize: '100px', bodyRad: 40 },
            { emoji: '🌿', fontSize: '100px', bodyRad: 40 },
            { emoji: '🛖', fontSize: '300px', bodyRad: 130 }
        ];

        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);

        let dist = distance;
        if (dist === null) {
            const cam = this.cameras.main;
            dist = Math.sqrt(Math.pow(cam.width, 2) + Math.pow(cam.height, 2)) / 2 + 300;
        }

        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;

        // 15% chance for pond, 85% for emoji obstacle
        if (Math.random() < 0.15) {
            const pond = this.add.graphics();
            pond.fillStyle(0x355e3b, 0.8); // Swampish Green
            pond.fillEllipse(x, y, 160, 100);

            const pondCollider = this.add.zone(x, y, 140, 80);
            this.physics.add.existing(pondCollider, true);
            this.obstacles.add(pondCollider);
            pondCollider.linkedGraphics = pond;
        } else {
            const type = Phaser.Math.RND.pick(obstacleTypes);
            const obs = this.add.text(x, y, type.emoji, { fontSize: type.fontSize, padding: { top: 40 } }).setOrigin(0.5);
            this.obstacles.add(obs);
            obs.body.setCircle(type.bodyRad);

            if (type.isTree) {
                // Offset colliding circle to the bottom (trunk)
                obs.body.setOffset((obs.width - type.bodyRad * 2) / 2, obs.height - type.bodyRad * 2 - 20);
            } else {
                // Center collision
                obs.body.setOffset((obs.width - type.bodyRad * 2) / 2, (obs.height - type.bodyRad * 2) / 2);
            }
        }
    }

    cleanupDistantObstacles() {
        this.obstacles.getChildren().forEach(obs => {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, obs.x, obs.y);
            if (dist > 2500) {
                if (obs.linkedGraphics) obs.linkedGraphics.destroy();
                obs.destroy();
            }
        });
    }

    updateWeapons() {
        this.enemies.getChildren().forEach(e => {
            if (e.stunTimer > 0) {
                e.stunTimer--;
            } else {
                this.physics.moveToObject(e, this.player, e.speed);
            }
        });

        this.playerStats.weapons.forEach(w => {
            w.timer++;
            if (w.type === 'orb') {
                if (!w.sprites) w.sprites = [];
                if (w.sprites.length !== w.level) {
                    w.sprites.forEach(s => s.destroy()); w.sprites = [];
                    for (let i = 0; i < w.level; i++) {
                        const orb = this.add.text(0, 0, '🔮', { fontSize: '20px' }).setOrigin(0.5);
                        this.physics.add.existing(orb); w.sprites.push(orb);
                    }
                }
                w.angle = (w.angle || 0) + 0.05;
                w.sprites.forEach((s, i) => {
                    const theta = w.angle + (i * (Math.PI * 2 / w.level));
                    s.x = this.player.x + Math.cos(theta) * w.range;
                    s.y = this.player.y + Math.sin(theta) * w.range;
                    this.enemies.getChildren().forEach(e => {
                        if (Phaser.Math.Distance.Between(s.x, s.y, e.x, e.y) < 30 && this.gameTime % 20 === 0) {
                            this.damageEnemy(e, w.dmg * this.playerStats.might);
                        }
                    });
                });
            }

            if (w.timer >= w.cooldown / this.playerStats.cooldown) {
                w.timer = 0;
                if (w.type === 'wand') this.fireWand(w);
                if (w.type === 'whip') this.fireWhip(w);
                if (w.type === 'axe') this.fireAxe(w);
                if (w.type === 'cross') this.fireCross(w);
                if (w.type === 'knife') this.fireKnife(w);
                if (w.type === 'water') this.fireSantaWater(w);
            }
        });
    }

    fireWand(w) {
        let nearest = null, minDist = 9999;
        this.enemies.getChildren().forEach(e => {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
            if (d < minDist) { minDist = d; nearest = e; }
        });
        if (nearest) {
            synthShoot('wand');
            const b = this.add.circle(this.player.x, this.player.y, 7, 0x00ffff);
            this.bullets.add(b);
            this.physics.add.existing(b);
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearest.x, nearest.y);
            b.body.setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);
            b.dmg = 12 * (1 + w.level * 0.2) * this.playerStats.might; b.type = 'wand'; b.life = 60;
        }
    }

    fireWhip(w) {
        synthShoot('whip');

        // Stats Calculation
        // Level 4, 6, 8... increase range. (Level - 2) / 2 floored gives 1 at L4, 2 at L6.
        const rangeBonus = Math.max(0, Math.floor((w.level - 2) / 2)) * 40;
        const range = 220 + rangeBonus;

        // Level 3, 5, 7... increase damage. (Level - 1) / 2 floored gives 1 at L3, 2 at L5.
        const dmgBonus = Math.max(0, Math.floor((w.level - 1) / 2)) * 5;
        const damage = (15 + dmgBonus) * this.playerStats.might;

        const thickness = 75;
        // Level 2+ adds back attack
        const directions = w.level >= 2 ? [this.player.scaleX, -this.player.scaleX] : [this.player.scaleX];

        const whip = this.add.graphics();

        directions.forEach(dir => {
            // Visuals: Magic Splash Effect
            const px = this.player.x;
            const py = this.player.y;

            // 3 Layers: Dark Glow -> Cyan -> White Core
            [
                { color: 0x0000cc, thick: 40, alpha: 0.4, scale: 1.1 }, // Outer dark blue
                { color: 0x00ffff, thick: 15, alpha: 0.8, scale: 1.0 }, // Main cyan slash
                { color: 0xffffff, thick: 5, alpha: 1.0, scale: 0.9 }   // Inner white core
            ].forEach(l => {
                whip.lineStyle(l.thick, l.color, l.alpha);

                // Front whip (dir matches facing) goes UP (-Y). Back whip goes DOWN (+Y).
                // flipY = 1 if Front, -1 if Back.
                const flipY = dir * this.player.scaleX;

                const path = new Phaser.Curves.Path(px, py + (10 * flipY));
                path.cubicBezierTo(
                    px + (dir * range * l.scale * 0.5), py + (10 * flipY),
                    px + (dir * range * l.scale * 0.8), py - (10 * flipY),
                    px + (dir * range * l.scale), py - (60 * flipY)
                );
                path.draw(whip);
            });

            // Particles
            whip.fillStyle(0xaaddff, 0.8);
            for (let i = 0; i < 8; i++) {
                const pxr = px + (Math.random() * range * 0.8 * dir);
                const pyr = py + (Math.random() - 0.5) * 50;
                whip.fillCircle(pxr, pyr, Phaser.Math.Between(2, 4));
            }

            // Hit Detection
            this.enemies.getChildren().forEach(e => {
                const dx = (e.x - this.player.x) * dir;
                const dy = Math.abs(e.y - this.player.y);

                // Check specifically for this direction to allow hitting enemies on both sides independently
                if (dx > 0 && dx <= range && dy <= thickness / 2) {
                    // Prevent double damage in same frame if enemy is somehow overlapping center? 
                    // No, distinct directions shouldn't overlap except at x=0, which dx>0 handles.
                    this.damageEnemy(e, damage, 300);
                }
            });
        });

        this.tweens.add({ targets: whip, alpha: 0, duration: 150, onComplete: () => whip.destroy() });
    }

    fireAxe(w) {
        synthShoot('axe');
        const count = w.level;
        for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) / 2) * 50;
            const axe = this.add.text(this.player.x, this.player.y, '🪓', { fontSize: '24px' }).setOrigin(0.5);
            this.bullets.add(axe);
            this.physics.add.existing(axe);
            axe.body.setVelocity(this.player.scaleX * 150 + spread, -400);
            axe.body.gravity.y = 800;
            axe.dmg = 12 * this.playerStats.might; axe.type = 'axe';
        }
    }

    fireCross(w) {
        synthShoot('cross');
        const cross = this.add.text(this.player.x, this.player.y, '✝️', { fontSize: '24px' }).setOrigin(0.5);
        this.bullets.add(cross);
        this.physics.add.existing(cross);
        cross.body.setVelocity(this.player.scaleX * 300, 0);
        cross.dmg = 6 * this.playerStats.might; cross.type = 'cross'; cross.returnTimer = 40;
    }

    fireKnife(w) {
        synthShoot('knife');
        const count = w.level;
        const spreadAngle = 10 * (Math.PI / 180); // 10 degrees spread

        for (let i = 0; i < count; i++) {
            const offset = (i - (count - 1) / 2) * spreadAngle;
            const knife = this.add.text(this.player.x, this.player.y, '🔪', { fontSize: '24px' }).setOrigin(0.5);
            this.bullets.add(knife);
            this.physics.add.existing(knife);

            const baseAngle = this.player.scaleX === 1 ? 0 : Math.PI;
            const finalAngle = baseAngle + offset;

            knife.rotation = finalAngle;
            const speed = 500;
            knife.body.setVelocity(Math.cos(finalAngle) * speed, Math.sin(finalAngle) * speed);
            knife.dmg = 8 * this.playerStats.might; knife.type = 'knife';
        }
    }

    fireSantaWater(w) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(100, 300);
        const tx = this.player.x + Math.cos(angle) * dist;
        const ty = this.player.y + Math.sin(angle) * dist;

        const bottle = this.add.text(tx, ty - 500, '🧪', { fontSize: '30px' }).setOrigin(0.5);

        this.tweens.add({
            targets: bottle,
            y: ty,
            rotation: 10,
            duration: 600,
            ease: 'Quad.easeIn',
            onComplete: () => {
                bottle.destroy();
                noise(0.1);

                // Base 120 / 2 = 60. Increase 20% per level.
                const size = 60 * (1 + w.level * 0.2);
                // Damage / 3 * (1 + 20% per level)
                const dmg = ((8 + w.level * 3) / 3) * (1 + w.level * 0.2) * this.playerStats.might;
                const duration = 20000;

                const puddle = this.add.graphics();
                puddle.fillStyle(0x4488ff, 0.5);
                puddle.fillCircle(0, 0, size / 2);
                puddle.setPosition(tx, ty);

                this.tweens.add({ targets: puddle, alpha: 0.2, scaleX: 1.1, scaleY: 1.1, yoyo: true, repeat: -1, duration: 600 });

                const tick = this.time.addEvent({
                    delay: 250,
                    repeat: Math.floor(duration / 250),
                    callback: () => {
                        this.enemies.getChildren().forEach(e => {
                            if (Phaser.Math.Distance.Between(tx, ty, e.x, e.y) < size / 2) {
                                this.damageEnemy(e, dmg);
                            }
                        });
                    }
                });

                this.time.delayedCall(duration, () => {
                    tick.remove();
                    this.tweens.add({
                        targets: puddle, alpha: 0, duration: 500,
                        onComplete: () => puddle.destroy()
                    });
                });
            }
        });
    }

    fireSantaWaterOld(w) {
        synthShoot('garlic'); // Reuse garlic sound
        const size = 60 + (w.level * 15);
        const dmg = (5 + w.level * 2) * this.playerStats.might;
        const duration = 3000 + (w.level * 500);

        // Create puddle at player position
        const puddle = this.add.graphics();
        puddle.fillStyle(0x5599ff, 0.6);
        puddle.fillEllipse(this.player.x, this.player.y, size, size * 0.6);
        puddle.x = this.player.x;
        puddle.y = this.player.y;

        // Damage enemies periodically while puddle exists
        const damageEvent = this.time.addEvent({
            delay: 200,
            repeat: Math.floor(duration / 200),
            callback: () => {
                this.enemies.getChildren().forEach(e => {
                    if (Phaser.Math.Distance.Between(puddle.x, puddle.y, e.x, e.y) < size / 2) {
                        this.damageEnemy(e, dmg);
                    }
                });
            }
        });

        // Fade out and destroy puddle
        this.tweens.add({
            targets: puddle,
            alpha: 0,
            delay: duration - 500,
            duration: 500,
            onComplete: () => {
                damageEvent.remove();
                puddle.destroy();
            }
        });
    }

    updateBullets() {
        this.bullets.getChildren().forEach(b => {
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y) > 1000) { b.destroy(); return; }
            if (b.type === 'axe') b.rotation += 0.1;
            if (b.type === 'cross') {
                b.rotation -= 0.2; b.returnTimer--;
                if (b.returnTimer <= 0 && !b.reversed) {
                    b.body.velocity.x *= -1; b.body.velocity.y *= -1; b.reversed = true;
                }
            }

        });
    }

    handlePlayerHit(player, enemy) {
        if (this.invulnTimer > 0) return;

        synthHurt();
        this.playerStats.hp -= 10;
        this.invulnTimer = 60;

        // Knockback Player
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
        this.knockbackVelocity.x = Math.cos(angle) * 800;
        this.knockbackVelocity.y = Math.sin(angle) * 800;

        updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
        if (this.playerStats.hp <= 0) this.gameOver();
    }

    damageEnemy(enemy, amount, knockback = 0) {
        if (!enemy.active) return;
        enemy.hp -= amount;

        // Flash Effect
        this.tweens.add({
            targets: enemy,
            alpha: 0.3,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 50,
            yoyo: true,
            onComplete: () => { if (enemy.active) enemy.setScale(1); }
        });

        if (knockback > 0) {
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            enemy.body.setVelocity(Math.cos(angle) * knockback, Math.sin(angle) * knockback);
            enemy.stunTimer = 10;
        }

        const txt = this.add.text(enemy.x, enemy.y, Math.floor(amount), { font: '20px Arial', color: '#ff0055' }).setOrigin(0.5);
        this.tweens.add({ targets: txt, y: enemy.y - 50, alpha: 0, duration: 500, onComplete: () => txt.destroy() });

        if (enemy.hp <= 0) {
            enemy.body.enable = false; // Disable physics
            synthHit();

            // Dust Effect (Thanos Snap style)
            const particles = this.add.graphics();
            particles.fillStyle(0x555555, 0.8);
            for (let i = 0; i < 8; i++) {
                const px = enemy.x + (Math.random() - 0.5) * 40;
                const py = enemy.y + (Math.random() - 0.5) * 40;
                particles.fillCircle(px, py, 4);
            }
            // Fade out particles
            this.tweens.add({
                targets: particles,
                alpha: 0,
                y: '-=20',
                duration: 600,
                onComplete: () => particles.destroy()
            });

            // Fade out Enemy
            this.tweens.add({
                targets: enemy,
                alpha: 0,
                scaleX: 0.8,
                scaleY: 0.8,
                y: '-=10', // Float up slightly
                duration: 500,
                onComplete: () => {
                    const val = enemy.isBoss ? 50 : 5;
                    const type = enemy.isBoss ? 'chest' : 'xp';
                    if (type === 'xp') {
                        const g = this.add.circle(enemy.x, enemy.y, 6, 0x00ff88);
                        this.physics.add.existing(g);
                        g.val = val; g.type = 'xp';
                        this.gems.add(g);
                        this.killCount++;
                    } else {
                        const g = this.add.text(enemy.x, enemy.y, '🎁', { fontSize: '30px' }).setOrigin(0.5);
                        this.physics.add.existing(g);
                        g.val = val; g.type = 'chest';
                        this.gems.add(g);
                    }
                    updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
                    enemy.destroy();
                }
            });
        }
    }

    updateGems() {
        this.gems.getChildren().forEach(g => {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, g.x, g.y);
            if (d < 150) this.physics.moveToObject(g, this.player, 400);
            if (d < 30) {
                synthGem();
                if (g.type === 'chest') this.triggerTreasureEvent();
                else this.addXp(g.val);
                g.destroy();
            }
        });
    }

    addXp(amount) {
        this.playerStats.xp += amount;
        if (this.playerStats.xp >= this.playerStats.nextLevelXp) {
            this.playerStats.xp -= this.playerStats.nextLevelXp;
            this.playerStats.level++;
            this.playerStats.nextLevelXp = Math.floor(this.playerStats.nextLevelXp * 1.5);
            synthLevelUp();
            this.triggerLevelUp();

            // Every 5 levels, spawn a horde circle
            if (this.playerStats.level % 5 === 0) {
                this.spawnEnemyCircle();
            }
        }
        updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
    }

    triggerLevelUp() {
        this.scene.pause();
        showPowerUpSelection('levelup');
    }

    triggerTreasureEvent() {
        this.scene.pause();
        const types = ['spelling', 'wordrec', 'scramble'];
        const type = types[Math.floor(Math.random() * types.length)];
        startMiniGame(type, 'chest');
    }

    gameOver() {
        this.scene.pause();

        // Stop any running minigame countdown
        if (minigameCountdownInterval) {
            clearInterval(minigameCountdownInterval);
            minigameCountdownInterval = null;
        }

        // Calculate statistics
        const totalPlayedTimeSec = Math.floor((this.accumulatedTime + totalMinigameTimeMs) / 1000);
        const survivalTimeSec = Math.floor(this.accumulatedTime / 1000);
        const minigameTimeSec = Math.floor(totalMinigameTimeMs / 1000);
        const scoreSec = Math.max(0, survivalTimeSec); // Score is remaining survival time

        // Format time strings
        const formatTime = (seconds) => {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
        };

        // Update display
        document.getElementById('finalLevel').innerText = this.playerStats.level;
        document.getElementById('finalSurvivalTime').innerText = formatTime(totalPlayedTimeSec);
        document.getElementById('finalMinigameTime').innerText = '-' + formatTime(minigameTimeSec);
        document.getElementById('finalScore').innerText = formatTime(scoreSec);

        // Show selected content
        const book = document.getElementById('sel-book').value;
        const unit = document.getElementById('sel-unit').value;
        document.getElementById('finalContentDisplay').innerText = `${book} - Unit ${unit}`;

        document.getElementById('gameOverScreen').classList.remove('hidden');
    }

    applyReward(reward) {
        if (!reward) return;
        const p = this.playerStats;
        if (reward.type === 'weapon') {
            const existing = p.weapons.find(w => w.type === reward.id);
            if (existing) {
                existing.level++;
                if (reward.id === 'wand') existing.cooldown = Math.max(5, existing.cooldown - 8);
                if (reward.id === 'cross') existing.cooldown = Math.max(20, existing.cooldown - 5);
                if (reward.id === 'knife') existing.cooldown = Math.max(5, existing.cooldown - 2);
                if (reward.id === 'orb') existing.range += 20;
            } else {
                if (reward.id === 'whip') p.weapons.push({ type: 'whip', level: 1, timer: 0, cooldown: 60 });
                if (reward.id === 'wand') p.weapons.push({ type: 'wand', level: 1, timer: 0, cooldown: 60 });
                if (reward.id === 'axe') p.weapons.push({ type: 'axe', level: 1, timer: 0, cooldown: 140 });
                if (reward.id === 'cross') p.weapons.push({ type: 'cross', level: 1, timer: 0, cooldown: 80 });
                if (reward.id === 'orb') p.weapons.push({ type: 'orb', level: 1, angle: 0, range: 100, dmg: 5, timer: 0 });
                if (reward.id === 'water') p.weapons.push({ type: 'water', level: 1, timer: 0, cooldown: 300 });
                if (reward.id === 'knife') p.weapons.push({ type: 'knife', level: 1, timer: 0, cooldown: 60 });
            }
        } else if (reward.type === 'stat') {
            if (reward.id === 'might') p.might += 0.1;
            if (reward.id === 'speed') p.speed += 0.1;
        } else if (reward.type === 'heal') p.hp = Math.min(p.maxHp, p.hp + 30);
        updateDOMHUD(p, Math.floor(this.accumulatedTime / 1000), this.killCount);
    }

    handleResize(gameSize) {
        const width = gameSize.width;
        // Adjust zoom to keep visible area roughly consistent (min 800px width visible)
        // On mobile (e.g. 400px), zoom will be ~0.5. On desktop (1920px), zoom will be 1 (clamped).
        let zoom = width / 800;
        zoom = Phaser.Math.Clamp(zoom, 0.4, 1.0);
        this.cameras.main.setZoom(zoom);
        this.bg.setSize(width / zoom, this.scale.height / zoom); // Resize tileSprite to cover camera? 
        // No, TileSprite is fixed to screen. 
        // But if we zoom out, the camera sees MORE of the world. 
        // The BG is attached to the camera scroll?
        // Line 169: this.bg = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'grass').setOrigin(0, 0);
        // bg.setScrollFactor(0).
        // If zoom is 0.5, we see 2x width. The BG is only this.scale.width wide.
        // We need to resize the BG to cover the new viewport.
        if (this.bg) {
            this.bg.setSize(width / zoom + 100, this.scale.height / zoom + 100);
        }
    }
}

config.scene = MainScene;

// --- DOM FUNCTIONS ---
function updateDOMHUD(player, time, kills) {
    const xpPct = (player.xp / player.nextLevelXp) * 100;
    document.getElementById('xpBar').style.width = xpPct + '%';
    document.getElementById('levelDisplay').innerText = player.level;
    const hpPct = (player.hp / player.maxHp) * 100;
    document.getElementById('hpBarFill').style.width = hpPct + '%';
    document.getElementById('hpText').innerText = `${Math.floor(player.hp)}/${player.maxHp}`;
    const m = Math.floor(time / 60);
    const s = time % 60;
    document.getElementById('timerDisplay').innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    document.getElementById('killDisplay').innerText = kills;

    const invDiv = document.getElementById('inventory');
    invDiv.innerHTML = '';
    player.weapons.forEach(w => {
        let icon = POWER_UPS.find(p => p.id === w.type)?.icon || '';
        invDiv.innerHTML += `<div class="inv-slot">${icon}<div class="inv-level">${w.level}</div></div>`;
    });
}

function initMenus() {
    const classSel = document.getElementById('sel-class');
    const studentSel = document.getElementById('sel-student');

    classSel.innerHTML = '';

    if (typeof CLASS_CONFIG === 'undefined') {
        console.error("CLASS_CONFIG is undefined. Make sure teaching_content.js is loaded correctly.");
        return;
    }

    // Populate Classes
    Object.keys(CLASS_CONFIG).forEach(className => {
        const opt = document.createElement('option');
        opt.value = className;
        opt.innerText = className;
        classSel.appendChild(opt);
    });

    function updateStudents() {
        const selectedClass = classSel.value;
        const classData = CLASS_CONFIG[selectedClass];

        studentSel.innerHTML = '';

        if (classData && classData.students) {
            classData.students.forEach(student => {
                const opt = document.createElement('option');
                opt.value = student;
                opt.innerText = student;
                studentSel.appendChild(opt);
            });
            // Show start buttons if students exist
            const btns = document.getElementById('start-buttons');
            if (btns) {
                btns.classList.remove('hidden');
                btns.classList.add('flex');
            }
        } else {
            // Hide if no students
            const btns = document.getElementById('start-buttons');
            if (btns) {
                btns.classList.add('hidden');
                btns.classList.remove('flex');
            }
        }

        loadContent();
    }

    classSel.addEventListener('change', updateStudents);

    // Initial population
    if (Object.keys(CLASS_CONFIG).length > 0) {
        classSel.value = Object.keys(CLASS_CONFIG)[0];
        updateStudents();
    }
}

function triggerStartGame() {
    document.getElementById('startScreen').classList.add('hidden');
    initAudio();
    if (!game) game = new Phaser.Game(config);
    else { game.scene.resume('MainScene'); /* or restart */ }
}

let pendingReward = null;
let rewardContext = 'levelup';
let isFirstAttempt = true;
let minigameStartTime = 0; // Track when minigame started (in ms)
let currentMinigameType = ''; // Track which type of minigame is active
let minigameCountdownInterval = null; // Interval for countdown timer during minigames
let totalMinigameTimeMs = 0; // Track total time spent in all minigames


function showPowerUpSelection(context) {
    document.getElementById('levelUpMenu').classList.remove('hidden');
    rewardContext = context;
    const container = document.getElementById('powerup-cards-container');
    container.innerHTML = '';

    // Get player stats to determine current weapon levels
    const scene = game.scene.getScene('MainScene');
    const existingWeapons = scene ? scene.playerStats.weapons : [];

    const shuffled = [...POWER_UPS].sort(() => 0.5 - Math.random()).slice(0, 3);

    // Create completely randomized pairings between power-ups and game types
    const allGameTypes = ['spelling', 'wordrec', 'scramble'];
    const pairings = shuffled.map(reward => {
        const randomGameType = allGameTypes[Math.floor(Math.random() * allGameTypes.length)];
        return { reward, gameType: randomGameType };
    });

    pairings.forEach(({ reward, gameType }) => {
        let description = reward.desc;

        // Dynamic description for Whip upgrades
        if (reward.id === 'whip') {
            const weapon = existingWeapons.find(w => w.type === 'whip');
            if (weapon) {
                const nextLevel = weapon.level + 1;
                if (nextLevel === 2) description = "Back Attack";
                else if (nextLevel % 2 !== 0) description = "Increased Damage";
                else description = "Increased Range";
            }
        }

        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => {
            pendingReward = reward;
            document.getElementById('levelUpMenu').classList.add('hidden');
            startMiniGame(gameType, context);
        };
        card.innerHTML = `<div class="text-6xl mb-4">${reward.icon}</div>
                           <h3 class="text-xl font-bold mb-2 text-purple-700">${reward.name}</h3>
                           <p class="text-sm text-gray-500">${description}</p>`;
        container.appendChild(card);
    });
}

function startMinigameCountdown(scene) {
    // Clear any existing countdown
    if (minigameCountdownInterval) {
        clearInterval(minigameCountdownInterval);
    }

    // Update countdown every 100ms
    minigameCountdownInterval = setInterval(() => {
        const currentTime = Math.max(0, Math.floor(scene.accumulatedTime / 1000));
        const m = Math.floor(currentTime / 60);
        const s = currentTime % 60;
        const timeString = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;

        // Update all minigame timer displays
        const spellingTimer = document.getElementById('spelling-timer');
        const recTimer = document.getElementById('rec-timer');
        const grammarTimer = document.getElementById('grammar-timer');

        if (spellingTimer) spellingTimer.textContent = timeString;
        if (recTimer) recTimer.textContent = timeString;
        if (grammarTimer) grammarTimer.textContent = timeString;

        // Deduct time from survival time
        scene.accumulatedTime = Math.max(0, scene.accumulatedTime - 100);
    }, 100);
}

function startMiniGame(type, context) {
    rewardContext = context;
    isFirstAttempt = true;
    currentMinigameType = type;
    minigameStartTime = Date.now(); // Record start time

    // Start countdown timer display
    const scene = game.scene.getScene('MainScene');
    if (scene) {
        startMinigameCountdown(scene);
    }

    if (type === 'spelling') startSpellingGame();
    if (type === 'wordrec') startWordRecGame();
    if (type === 'scramble') startGrammarGame();
}

function claimReward(success) {
    // Stop countdown timer
    if (minigameCountdownInterval) {
        clearInterval(minigameCountdownInterval);
        minigameCountdownInterval = null;
    }

    document.getElementById('spellingGame').classList.add('hidden');
    document.getElementById('wordRecGame').classList.add('hidden');
    document.getElementById('grammarGame').classList.add('hidden');

    // Calculate time penalty
    const timeSpentMs = Date.now() - minigameStartTime;
    const timeSpentSec = Math.floor(timeSpentMs / 1000);

    // Track cumulative minigame time
    totalMinigameTimeMs += timeSpentMs;

    const scene = game.scene.getScene('MainScene');

    // Note: time was already deducted during countdown in startMinigameCountdown
    // Just update the HUD
    if (scene) {
        updateDOMHUD(scene.playerStats, Math.floor(scene.accumulatedTime / 1000), scene.killCount);
    }

    // Apply reward based on game type and success
    // Spelling and Grammar: always give reward if answered correctly
    // Sight words: only give reward on first try
    if (success) {
        if (rewardContext === 'chest') {
            const r = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
            scene.applyReward(r);
        } else {
            scene.applyReward(pendingReward);
        }
    }
    game.scene.resume('MainScene');
}

// --- PLACEHOLDERS FOR LARGE CHUNKS ---
function loadContent() {
    const classSel = document.getElementById('sel-class');
    if (!classSel || !CLASS_CONFIG) return;

    const selectedClass = classSel.value;
    const classData = CLASS_CONFIG[selectedClass];

    if (!classData || !classData.content) {
        console.warn("No content configured for class:", selectedClass);
        return;
    }

    const { book, unit, page } = classData.content;

    // Default to empty/placeholders
    SPELLING_WORDS = [];
    SIGHT_WORDS = [];
    GRAMMAR_SENTENCES = [];

    // Access new structure: Book > Unit > Page
    const pageContent = TEACHING_CONTENT[book] &&
        TEACHING_CONTENT[book][unit] &&
        TEACHING_CONTENT[book][unit][page];

    if (pageContent) {
        // Both spelling and word rec use vocab
        SPELLING_WORDS = pageContent.vocab || [];
        // Format vocab for sight words (keep array wrapping as legacy support)
        SIGHT_WORDS = (pageContent.vocab || []).map(w => [w]);
        GRAMMAR_SENTENCES = pageContent.sentences || [];
    } else {
        // Placeholders if content missing
        const prefix = `${book} U${unit} P${page}`;
        SPELLING_WORDS = [`${prefix} Word1`, `${prefix} Word2`];
        SIGHT_WORDS = [[`${prefix} Word1`], [`${prefix} Word2`]];
        GRAMMAR_SENTENCES = [`${prefix} Sentence 1.`, `${prefix} Sentence 2.`];
    }
}

// --- MINIGAMES ---

function startSpellingGame() {
    const level = game.scene.getScene('MainScene').playerStats.level;
    if (SPELLING_WORDS.length === 0) { handleMinigameSuccess('spelling'); return; }
    const word = SPELLING_WORDS[Math.floor(Math.random() * SPELLING_WORDS.length)];
    currentTTSWord = word;

    const totalChars = word.length;
    // Always use ALL letters - no level-based scaling
    let missingCount = totalChars;
    const indices = Array.from({ length: totalChars }, (_, i) => i);
    indices.sort(() => 0.5 - Math.random());
    const missingIndices = indices.slice(0, missingCount);

    let template = [];
    let missingChars = [];
    for (let i = 0; i < totalChars; i++) {
        if (missingIndices.includes(i)) {
            template.push(null);
            missingChars.push(word[i]);
        } else {
            template.push(word[i]);
        }
    }
    missingIndices.sort((a, b) => a - b); // purely for display order if needed, but logic handles it

    const gameEl = document.getElementById('spellingGame');
    gameEl.dataset.targetWord = word;
    gameEl.dataset.template = JSON.stringify(template);
    gameEl.dataset.missingChars = JSON.stringify(missingChars); // Unsorted for validation logic? No, validation matches input string
    // Wait, original logic sorted missing chars to create the key sequence.
    // Let's mirror original logic: "sortedMissingChars = missingIndices.map(idx => word[idx]);"
    // My missingChars above is in index order? No, loop 0..total. Yes index order.

    gameEl.dataset.currentInput = "";

    updateSpellingDisplay();

    const display = document.getElementById('spelling-input-display');
    display.classList.remove('text-red-500', 'shake');
    document.getElementById('spelling-result-action').classList.add('hidden');
    document.getElementById('spelling-actions').classList.remove('hidden');
    document.getElementById('spellingGame').classList.remove('hidden');

    // Keyboard keys (shuffled)
    const keys = [...missingChars];
    keys.sort(() => 0.5 - Math.random());

    const container = document.getElementById('spelling-keyboard');
    container.innerHTML = '';
    keys.forEach(char => {
        const bubble = document.createElement('div');
        bubble.className = 'letter-bubble'; bubble.innerText = char;
        bubble.onclick = () => handleSpellingInput(char, bubble);
        container.appendChild(bubble);
    });
    setTimeout(playTTS, 500);
}

function handleSpellingInput(char, bubble) {
    const gameEl = document.getElementById('spellingGame');
    const missingChars = JSON.parse(gameEl.dataset.missingChars);
    let currentInput = gameEl.dataset.currentInput;

    if (currentInput.length < missingChars.length) {
        currentInput += char;
        gameEl.dataset.currentInput = currentInput;
        bubble.style.visibility = 'hidden';
        updateSpellingDisplay();
    }
}

function updateSpellingDisplay() {
    const gameEl = document.getElementById('spellingGame');
    const template = JSON.parse(gameEl.dataset.template);
    const currentInput = gameEl.dataset.currentInput;
    let displayHtml = "";
    let inputIdx = 0;

    template.forEach(char => {
        if (char === null) {
            if (inputIdx < currentInput.length) {
                displayHtml += `<span class="text-blue-600 underline">${currentInput[inputIdx]}</span>`;
                inputIdx++;
            } else {
                displayHtml += "_";
            }
        } else {
            displayHtml += char;
        }
    });
    document.getElementById('spelling-input-display').innerHTML = displayHtml;
}

function clearSpelling() {
    const gameEl = document.getElementById('spellingGame');
    gameEl.dataset.currentInput = "";
    updateSpellingDisplay();
    const display = document.getElementById('spelling-input-display');
    display.classList.remove('text-red-500', 'shake');
    document.querySelectorAll('.letter-bubble').forEach(b => b.style.visibility = 'visible');
}

function checkSpelling() {
    const gameEl = document.getElementById('spellingGame');
    const currentInput = gameEl.dataset.currentInput;
    const missingChars = JSON.parse(gameEl.dataset.missingChars);

    // The original logic checked if currentInput === missingChars.join('')
    // Ideally we'd check if the RESULTING word matches target, but since we fill slots in order, matching the sequence of missing characters is equivalent.

    if (currentInput === missingChars.join('')) {
        handleMinigameSuccess('spelling');
    } else {
        const display = document.getElementById('spelling-input-display');
        display.classList.add('text-red-500', 'shake');
        synthError();
        setTimeout(() => display.classList.remove('shake'), 500);
        isFirstAttempt = false;
    }
}

// --- WORD REC ---
let recTimer;
let recTimeLeft;

function startWordRecGame() {
    if (SIGHT_WORDS.length === 0) { handleMinigameSuccess('rec'); return; }
    const pair = SIGHT_WORDS[Math.floor(Math.random() * SIGHT_WORDS.length)];
    currentTTSWord = pair[0];
    const target = pair[0];
    const level = game.scene.getScene('MainScene').playerStats.level;

    // Always show 5 words - no level-based scaling
    let choiceCount = 5;

    let choices = [target];
    const pool = SIGHT_WORDS.flat().filter(w => w !== target);
    pool.sort(() => 0.5 - Math.random());

    let added = 0;
    for (let w of pool) {
        if (added >= choiceCount - 1) break;
        if (!choices.includes(w)) {
            choices.push(w);
            added++;
        }
    }
    choices.sort(() => 0.5 - Math.random());

    const container = document.getElementById('rec-options');
    container.innerHTML = '';
    container.classList.remove('hidden');

    choices.forEach(word => {
        const btn = document.createElement('button');
        btn.className = "game-btn text-2xl py-8 min-w-[150px]";
        btn.innerText = word;
        btn.onclick = () => checkWordRec(word, target, btn);
        container.appendChild(btn);
    });

    document.getElementById('rec-result-action').classList.add('hidden');
    document.getElementById('wordRecGame').classList.remove('hidden');

    recTimeLeft = 100;
    const bar = document.getElementById('rec-timer-bar');
    bar.style.width = '100%';
    if (recTimer) clearInterval(recTimer);
    recTimer = setInterval(() => {
        recTimeLeft -= 1;
        bar.style.width = recTimeLeft + '%';
        if (recTimeLeft <= 0) {
            clearInterval(recTimer);
            isFirstAttempt = false;
        }
    }, 50);
    setTimeout(playTTS, 500);
}

function checkWordRec(selected, target, btn) {
    clearInterval(recTimer);
    if (selected === target) {
        handleMinigameSuccess('rec');
    } else {
        synthError();
        btn.classList.add('bg-red-500', 'shake');
        setTimeout(() => btn.classList.remove('shake'), 500);
        isFirstAttempt = false;
    }
}

// --- GRAMMAR ---

function startGrammarGame() {
    if (GRAMMAR_SENTENCES.length === 0) { handleMinigameSuccess('grammar'); return; }

    // Handle multiple valid variations
    const rawEntry = GRAMMAR_SENTENCES[Math.floor(Math.random() * GRAMMAR_SENTENCES.length)];
    let possibilities = [];
    let primarySentence = "";

    if (Array.isArray(rawEntry)) {
        possibilities = rawEntry;
        primarySentence = rawEntry[0];
    } else {
        possibilities = [rawEntry];
        primarySentence = rawEntry;
    }

    // Store valid possibilities for validation
    document.getElementById('grammarGame').dataset.validOptions = JSON.stringify(possibilities);

    const level = game.scene.getScene('MainScene').playerStats.level;

    const sentContainer = document.getElementById('sentence-container');
    const dock = document.getElementById('word-dock');
    sentContainer.innerHTML = ''; dock.innerHTML = '';

    document.getElementById('grammar-result-action').classList.add('hidden');
    document.getElementById('grammar-actions').classList.remove('hidden');

    const rawChunks = primarySentence.split(' ');
    const tokens = rawChunks.map(chunk => {
        // Improved regex to include ? and !
        const match = chunk.match(/^(.+?)([,.?!]+)$/);
        return match ? { word: match[1], punct: match[2] } : { word: chunk, punct: '' };
    });

    const candidateIndices = tokens.map((_, i) => i);
    candidateIndices.sort(() => 0.5 - Math.random());

    // Always use ALL words - no level-based scaling
    let numBlanks = tokens.length;

    const blankIndices = candidateIndices.slice(0, numBlanks);
    const neededOptions = [];

    const sentenceDiv = document.createElement('div');
    sentenceDiv.className = 'sentence-row';

    tokens.forEach((token, index) => {
        if (blankIndices.includes(index)) {
            neededOptions.push(token.word);
            const dz = document.createElement('div');
            dz.className = 'drop-zone';
            dz.dataset.expected = token.word;
            sentenceDiv.appendChild(dz);
            if (token.punct) {
                const span = document.createElement('span');
                span.innerText = token.punct;
                span.className = "mr-2";
                sentenceDiv.appendChild(span);
            }
        } else {
            const span = document.createElement('span');
            span.className = "mx-1";
            span.innerText = token.word + token.punct;
            sentenceDiv.appendChild(span);
        }
    });
    sentContainer.appendChild(sentenceDiv);

    neededOptions.sort(() => 0.5 - Math.random());
    neededOptions.forEach(opt => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'draggable';
        wordDiv.innerText = opt;
        dock.appendChild(wordDiv);
    });

    document.getElementById('grammarGame').classList.remove('hidden');
}

function clearGrammar() {
    const zones = document.querySelectorAll('.drop-zone');
    const dock = document.getElementById('word-dock');
    zones.forEach(zone => {
        if (zone.children.length > 0) {
            const item = zone.children[0];
            item.classList.remove('wrong', 'correct');
            dock.appendChild(item);
            zone.classList.remove('filled');
        }
    });
}

function checkGrammar() {
    const zones = document.querySelectorAll('.drop-zone');
    const gameEl = document.getElementById('grammarGame');
    const validOptions = JSON.parse(gameEl.dataset.validOptions || "[]");

    // 1. Collect user's words
    let userWords = [];
    let anyFilled = false;
    let allFilled = true;

    zones.forEach(zone => {
        if (zone.children.length > 0) {
            anyFilled = true;
            userWords.push(zone.children[0].innerText);
        } else {
            allFilled = false;
            userWords.push(null); // Gap
        }
    });

    // 2. Check complete match against ANY valid option
    let exactMatchFound = false;

    if (allFilled) {
        for (let option of validOptions) {
            // Tokenize option to get words only
            const optChunks = option.split(' ');
            const optWords = optChunks.map(chunk => {
                const match = chunk.match(/^(.+?)([,.?!]+)$/);
                return match ? match[1] : chunk;
            });

            // Compare arrays
            if (optWords.length === userWords.length) {
                const isMatch = optWords.every((w, i) => w === userWords[i]);
                if (isMatch) {
                    exactMatchFound = true;
                    break;
                }
            }
        }
    }

    // 3. Update UI
    let allCorrect = true;
    zones.forEach((zone, i) => {
        if (zone.children.length > 0) {
            const item = zone.children[0];
            const word = item.innerText;

            if (exactMatchFound) {
                // If the whole sentence is a valid variation, everything is correct
                item.classList.add('correct');
                item.classList.remove('wrong');
            } else {
                // Fallback: Grade against the *primary* expected word (from the slot definition)
                // This gives feedback based on the original structure if the user is off
                if (word === zone.dataset.expected) {
                    item.classList.add('correct');
                    item.classList.remove('wrong');
                } else {
                    item.classList.add('wrong');
                    item.classList.remove('correct');
                    allCorrect = false;
                }
            }
        } else {
            allCorrect = false;
        }
    });

    if (exactMatchFound) allCorrect = true;

    if (anyFilled && !allCorrect) {
        synthError();
        isFirstAttempt = false;
    }

    if (allCorrect) {
        handleMinigameSuccess('grammar');
    }
}



function handleMinigameSuccess(gameType) {
    let actionsId, resultId;
    if (gameType === 'spelling') { actionsId = 'spelling-actions'; resultId = 'spelling-result-action'; }
    else if (gameType === 'rec') { actionsId = 'rec-options'; resultId = 'rec-result-action'; }
    else { actionsId = 'grammar-actions'; resultId = 'grammar-result-action'; }

    if (actionsId) document.getElementById(actionsId).classList.add('hidden');
    const resultDiv = document.getElementById(resultId);
    resultDiv.classList.remove('hidden');

    // New reward logic:
    // - Spelling and Grammar: always give reward if answered correctly (even on subsequent tries)
    // - Sight words (rec): only give reward on first try within time limit
    const shouldGiveReward = (gameType === 'spelling' || gameType === 'grammar') || isFirstAttempt;

    if (shouldGiveReward) {
        resultDiv.innerHTML = `<button onclick="claimReward(true)" class="game-btn bg-green-500 text-2xl py-4 px-8 animate-bounce">GET POWER UP!</button>`;
    } else {
        resultDiv.innerHTML = `<button onclick="claimReward(false)" class="game-btn bg-blue-500 text-2xl py-4 px-8">CONTINUE (NO REWARD)</button>`;
    }
}



// Init
game = null;
initMenus();
loadContent();

// DOM Listeners for Grammar
document.getElementById('word-dock').addEventListener('click', (e) => {
    if (e.target.classList.contains('draggable')) {
        const emptyZone = Array.from(document.querySelectorAll('.drop-zone')).find(z => z.children.length === 0);
        if (emptyZone) {
            e.target.classList.remove('wrong', 'correct');
            emptyZone.appendChild(e.target);
            emptyZone.classList.add('filled');
        }
    }
});
document.getElementById('sentence-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('draggable')) {
        const dock = document.getElementById('word-dock');
        e.target.classList.remove('wrong', 'correct');
        dock.appendChild(e.target);
        e.target.parentElement.classList.remove('filled');
    }
});

// Initialize menus on load
window.addEventListener('DOMContentLoaded', initMenus);
