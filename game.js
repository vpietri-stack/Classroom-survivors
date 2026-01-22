// --- CONTENT MANAGEMENT ---
let SPELLING_WORDS = [];
let SIGHT_WORDS = [];
let GRAMMAR_SENTENCES = [];

const AVAILABLE_CONTENT = {
    "PU1": [3, 6],
    "PU2": [6],
    "PU3": [1, 5],
    "Think1": [6]
};

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
    { id: 'garlic', name: "Garlic", icon: "🧄", type: "weapon", desc: "Damages nearby enemies" },
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

        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.gems = this.physics.add.group();

        // Player
        this.player = this.add.text(0, 0, '🧙‍♂️', { fontSize: '50px', padding: { top: 10 } }).setOrigin(0.5);
        this.physics.add.existing(this.player);
        this.player.body.setCircle(20);
        this.player.body.setCollideWorldBounds(false);

        this.cameras.main.startFollow(this.player);

        // Inputs
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

        // Joystick
        this.input.addPointer(1);
        this.joystick = { active: false, x: 0, y: 0, originX: 0, originY: 0, angle: 0, force: 0 };
        this.input.on('pointerdown', (pointer) => {
            if (pointer.y > this.scale.height * 0.7) {
                this.joystick.active = true;
                this.joystick.originX = pointer.x;
                this.joystick.originY = pointer.y;
                this.joystick.x = pointer.x;
                this.joystick.y = pointer.y;
            }
        });
        this.input.on('pointermove', (pointer) => {
            if (this.joystick.active) {
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
        this.input.on('pointerup', () => {
            this.joystick.active = false;
            this.joystick.force = 0;
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
        // Spawn much faster: start at ~1 spawn/sec, scale to ~10 spawns/sec
        if (this.spawnTimer > Math.max(5, 60 - (this.playerStats.level * 4))) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }

        this.updateWeapons();
        this.updateBullets();
        this.updateGems();
        this.gameTime++;
        this.accumulatedTime += delta;
        updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
    }

    spawnEnemy(distance = null) {
        if (this.killCount >= 100) {
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

        // Weaker start, scaling HP
        const hp = 3 + (this.playerStats.level * 3);
        const speed = (50 + (Math.random() * 30) + (this.playerStats.level * 3));

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
            if (w.type === 'garlic' && this.gameTime % 20 === 0) {
                const range = 60 + (w.level * 10);
                this.enemies.getChildren().forEach(e => {
                    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < range) {
                        this.damageEnemy(e, w.dmg * this.playerStats.might, 'garlic');
                    }
                });
            }
            if (w.timer >= w.cooldown / this.playerStats.cooldown) {
                w.timer = 0;
                if (w.type === 'wand') this.fireWand(w);
                if (w.type === 'whip') this.fireWhip(w);
                if (w.type === 'axe') this.fireAxe(w);
                if (w.type === 'cross') this.fireCross(w);
                if (w.type === 'knife') this.fireKnife(w);
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
            b.dmg = 6 * this.playerStats.might; b.type = 'wand'; b.life = 60;
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
            // Visuals
            // Glow
            whip.fillStyle(0x5555ff, 0.3);
            const glowRectX = dir === 1 ? this.player.x : this.player.x - range;
            whip.fillRect(glowRectX, this.player.y - thickness / 2, range, thickness);

            // Core
            whip.lineStyle(4, 0xffffff);
            whip.beginPath();
            whip.moveTo(this.player.x, this.player.y);
            whip.lineTo(this.player.x + (dir * range), this.player.y);
            whip.strokePath();

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
        const knife = this.add.text(this.player.x, this.player.y, '🔪', { fontSize: '24px' }).setOrigin(0.5);
        this.bullets.add(knife);
        this.physics.add.existing(knife);
        knife.body.setVelocity(this.player.scaleX * 500, 0);
        knife.dmg = 8 * this.playerStats.might; knife.type = 'knife';
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

        updateDOMHUD(this.playerStats, this.gameTime, this.killCount);
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
                    updateDOMHUD(this.playerStats, this.gameTime, this.killCount);
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
        }
        updateDOMHUD(this.playerStats, this.gameTime, this.killCount);
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
        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('finalTime').innerText = document.getElementById('timerDisplay').innerText;
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
                if (reward.id === 'wand') p.weapons.push({ type: 'wand', level: 1, timer: 0, cooldown: 30 });
                if (reward.id === 'axe') p.weapons.push({ type: 'axe', level: 1, timer: 0, cooldown: 70 });
                if (reward.id === 'cross') p.weapons.push({ type: 'cross', level: 1, timer: 0, cooldown: 80 });
                if (reward.id === 'orb') p.weapons.push({ type: 'orb', level: 1, angle: 0, range: 100, dmg: 5, timer: 0 });
                if (reward.id === 'garlic') p.weapons.push({ type: 'garlic', level: 1, dmg: 2, timer: 0 });
                if (reward.id === 'knife') p.weapons.push({ type: 'knife', level: 1, timer: 0, cooldown: 20 });
            }
        } else if (reward.type === 'stat') {
            if (reward.id === 'might') p.might += 0.1;
            if (reward.id === 'speed') p.speed += 0.1;
        } else if (reward.type === 'heal') p.hp = Math.min(p.maxHp, p.hp + 30);
        updateDOMHUD(p, this.gameTime, this.killCount);
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
    const bookSel = document.getElementById('sel-book');
    const unitSel = document.getElementById('sel-unit');
    bookSel.innerHTML = ''; unitSel.innerHTML = '';
    Object.keys(AVAILABLE_CONTENT).forEach(book => {
        const opt = document.createElement('option');
        opt.value = book; opt.innerText = book;
        bookSel.appendChild(opt);
    });
    function updateUnits() {
        const selectedBook = bookSel.value;
        const units = AVAILABLE_CONTENT[selectedBook] || [];
        unitSel.innerHTML = '';
        units.forEach(unit => {
            const opt = document.createElement('option');
            opt.value = unit; opt.innerText = `Unit ${unit}`;
            unitSel.appendChild(opt);
        });
        loadContent();
    }
    bookSel.addEventListener('change', updateUnits);
    unitSel.addEventListener('change', loadContent);
    if (Object.keys(AVAILABLE_CONTENT).length > 0) {
        bookSel.value = Object.keys(AVAILABLE_CONTENT)[0];
        updateUnits();
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

function showPowerUpSelection(context) {
    document.getElementById('levelUpMenu').classList.remove('hidden');
    rewardContext = context;
    const container = document.getElementById('powerup-cards-container');
    container.innerHTML = '';

    // Get player stats to determine current weapon levels
    const scene = game.scene.getScene('MainScene');
    const existingWeapons = scene ? scene.playerStats.weapons : [];

    const shuffled = [...POWER_UPS].sort(() => 0.5 - Math.random()).slice(0, 3);
    const gameTypes = ['spelling', 'wordrec', 'scramble'];

    shuffled.forEach((reward, i) => {
        const gameType = gameTypes[i];
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

function startMiniGame(type, context) {
    rewardContext = context;
    isFirstAttempt = true;
    if (type === 'spelling') startSpellingGame();
    if (type === 'wordrec') startWordRecGame();
    if (type === 'scramble') startGrammarGame();
}

function claimReward(success) {
    document.getElementById('spellingGame').classList.add('hidden');
    document.getElementById('wordRecGame').classList.add('hidden');
    document.getElementById('grammarGame').classList.add('hidden');
    if (success) {
        const scene = game.scene.getScene('MainScene');
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
    const book = document.getElementById('sel-book').value;
    const unit = document.getElementById('sel-unit').value;

    // Default to empty/placeholders
    SPELLING_WORDS = [];
    SIGHT_WORDS = [];
    GRAMMAR_SENTENCES = [];

    if (book === 'PU1' && unit === '3') {
        // Content for PU1 Unit 3
        SPELLING_WORDS = ['cow', 'donkey', 'horse', 'spider', 'sheep', 'goat', 'cat', 'chicken', 'dog', 'duck', 'angry', 'funny', 'beautiful', 'happy', 'sad', 'ugly'];
        SIGHT_WORDS = [["the", "they"], ["they're", "they've got"], ["has", "hasn't"], ["is", "isn't"], ["are", "aren't"], ["have", "haven't"], ["he's", "he's got"], ["I'm", "I've got"], ["it", "it's got"], ["we", "we've got"]];
        GRAMMAR_SENTENCES = [
            "Rocky's a rooster. He isn't a hen.",
            "Rocky isn't a hen. He's a rooster.",
            "Rocky's got wings, he hasn't got arms.",
            "Rocky hasn't got arms, he's got wings.",
            "Henrietta's a hen. She isn't a rooster.",
            "Henrietta isn't a rooster. She's a hen.",
            "Henrietta's got 2 legs, she hasn't got 4 legs.",
            "Henrietta hasn't got 4 legs, she's got 2 legs.",
            "Harry's a horse. He isn't a donkey.",
            "Harry isn't a donkey. He's a horse.",
            "Harry's got a long tail, he hasn't got a long nose.",
            "Harry hasn't got a long nose, he's got a long tail.",
            "Gracie's a goat. She isn't a sheep.",
            "Gracie isn't a sheep. She's a goat.",
            "Gracie's got 2 eyes, she hasn't got 2 mouths.",
            "Gracie hasn't got 2 mouths, she's got 2 eyes.",
            "Shelly's a sheep. She isn't a goat.",
            "Shelly isn't a goat. She's a sheep.",
            "Shelly's got 4 legs, she hasn't got arms.",
            "Shelly hasn't got arms, she's got 4 legs.",
            "Cameron's small. He isn't big.",
            "Cameron isn't big. He's small.",
            "Cameron's got 4 legs, he hasn't got arms.",
            "Cameron hasn't got arms, he's got 4 legs."
        ];
    } else if (book === 'PU1' && unit === '6') {
        // Content for PU1 Unit 6
        SPELLING_WORDS = ['bear', 'lorry', 'snake', 'bus', 'car', 'bus stop', 'flower', 'park', 'tiger', 'crocodile', 'motorbike', 'shop', 'zebra', 'lizard', 'giraffe', 'elephant', 'hippo', 'polar bear', 'zoo', 'train', 'tree', 'garden'];
        SIGHT_WORDS = [["there", "their"], ["there's", "there is"], ["there are", "they are"], ["Are there", "Is there"], ["Is there", "Are there"], ["there isn't", "there aren't"], ["there aren't", "there isn't"]];
        GRAMMAR_SENTENCES = [
            "Are there any bears? Yes, there are.",
            "Are there any cars? Yes, there are.",
            "Are there any tigers? Yes, there are.",
            "Are there any zebras? Yes, there are.",
            "Are there any hippos? Yes, there are.",
            "Are there any trees? Yes, there are.",
            "Are there any lorries? No, there aren't.",
            "Are there any bus stops? No, there aren't.",
            "Are there any crocodiles? No, there aren't.",
            "Are there any lizards? No, there aren't.",
            "Are there any polar bears? No, there aren't.",
            "Are there any gardens? No, there aren't.",
            "Is there a snake? Yes, there is.",
            "Is there a flower? Yes, there is.",
            "Is there a motorbike? Yes, there is.",
            "Is there a giraffe? Yes, there is.",
            "Is there a zoo? Yes, there is.",
            "Is there a bus? No, there isn't.",
            "Is there a park? No, there isn't.",
            "Is there a shop? No, there isn't.",
            "Is there an elephant? No, there isn't.",
            "Is there a train? No, there isn't.",
            "There aren't any tigers, but there's a zebra.",
            "There isn't a tiger, but there are some zebras.",
            "There are some tigers, but there isn't a zebra.",
            "There's a tiger, but there aren't any zebras.",
            "There aren't any snakes, but there's a lizard.",
            "There isn't a snake, but there are some lizards.",
            "There are some snakes, but there isn't a lizard.",
            "There's a snake, but there aren't any lizards.",
            "There aren't any crocodiles, but there's a hippo.",
            "There isn't a crocodile, but there are some hippos.",
            "There are some crocodiles, but there isn't a hippo.",
            "There's a crocodile, but there aren't any hippos.",
            "There aren't any giraffes, but there's an elephant.",
            "There isn't a giraffe, but there are some elephants.",
            "There are some giraffes, but there isn't an elephant.",
            "There's a giraffe, but there aren't any elephants.",
            "There aren't any cars, but there's a motorbike.",
            "There isn't a car, but there are some motorbikes.",
            "There are some cars, but there isn't a motorbike.",
            "There's a car, but there aren't any motorbikes.",
            "There aren't any buses, but there's a lorry.",
            "There isn't a bus, but there are some lorries.",
            "There are some buses, but there isn't a lorry.",
            "There's a bus, but there aren't any lorries.",
            "There aren't any trains, but there's a bus.",
            "There isn't a train, but there are some buses.",
            "There are some trains, but there isn't a bus.",
            "There's a train, but there aren't any buses.",
            "There aren't any parks, but there's a garden.",
            "There isn't a park, but there are some gardens.",
            "There are some parks, but there isn't a garden.",
            "There's a park, but there aren't any gardens.",
            "There aren't any flowers, but there's a tree.",
            "There isn't a flower, but there are some trees.",
            "There are some flowers, but there isn't a tree.",
            "There's a flower, but there aren't any trees.",
            "There aren't any shops, but there's a bus stop.",
            "There isn't a shop, but there are some bus stops.",
            "There are some shops, but there isn't a bus stop.",
            "There's a shop, but there aren't any bus stops.",
            "There aren't any zoos, but there's a park.",
            "There isn't a zoo, but there are some parks.",
            "There are some zoos, but there isn't a park.",
            "There's a zoo, but there aren't any parks."
        ];
    } else if (book === 'PU3' && unit === '1') {
        SPELLING_WORDS = ['catch', 'dance', 'shout', 'laugh', 'jump', 'hop', 'skip', 'climb', 'dress up', 'hold', 'smile', 'stand', 'midnight', 'half past', 'midday', "o'clock", 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
        // Sight words list as single-item arrays so they can be picked as targets
        SIGHT_WORDS = [['catch'], ['dance'], ['shout'], ['laugh'], ['jump'], ['hop'], ['skip'], ['climb'], ['dress up'], ['hold'], ['smile'], ['stand'], ['midnight'], ['half past'], ['midday'], ["o'clock"]];
        GRAMMAR_SENTENCES = [
            "I couldn't catch a ball when I was three.",
            "I could catch a ball when I was five.",
            "He couldn't swim when he was six.",
            "He could swim when he was six.",
            "She couldn't climb trees when she was four.",
            "She could climb trees when she was nine.",
            "I could cook when I was five.",
            "I couldn't cook when I was one.",
            "They could dance when they were four.",
            "They couldn't dance when they were two.",
            "You could jump when you were three.",
            "You couldn't jump when you were two.",
            "We could read when we were six.",
            "We couldn't read when we were two."
        ];
    } else if (book === 'PU3' && unit === '5') {
        SPELLING_WORDS = ["gold", "silver", "wing", "bright", "light", "spotted", "spots", "striped", "stripes", "plain", "paper", "made of", "trousers", "shirt", "T-shirt", "jacket", "costume", "shoes", "rubber", "wearing", "metal", "paper", "wood", "wool", "card", "glass", "plastic"];
        SIGHT_WORDS = [["flexible"], ["rigid"], ["heavy"], ["light"], ["smooth"], ["rough"], ["plastic"], ["rubber"], ["gold"], ["silver"], ["wing"], ["bright"], ["light"], ["spotted"], ["spots"], ["striped"], ["stripes"], ["plain"], ["paper"], ["made of"], ["trousers"], ["shirt"], ["T-shirt"], ["jacket"], ["costume"], ["shoes"], ["rubber"], ["wearing"], ["metal"], ["paper"], ["wood"], ["wool"], ["card"], ["glass"], ["plastic"]];
        GRAMMAR_SENTENCES = [
            "This crown is made of gold. It's heavy", "This table is made of wood. It's rigid", "This ruler is made of plastic. It's flexible", "This house is made of bricks. It's rough", "This newspaper is made of paper. It's light", "This slide is made of metal. It's smooth", "This sweater is made of wool. It's soft", "This scarf is made of wool. It's warm", "These windows are made of glass. They're smooth", "This vase is made of glass. It isn't strong", "This box is made of cardboard. It's light", "This tube is made of cardboard. It's light", "This tire is made of rubber. It's flexible", "These boots are made of rubber. They're flexible"
        ];
    } else if (book === 'PU2' && unit === '6') {
        SPELLING_WORDS = ["Cloud", "cold", "hot", "rain", "rainbow", "snow", "sunny", "wind", "weather", "cloudy", "windy", "raining", "snowing", "boots", "coat", "scarf", "shorts", "sweater", "T-shirt", "take off", "put on", "wear", "wearing"];
        SIGHT_WORDS = [['there'], ['was'], ["wasn't"], ['were'], ["weren't"], ['is'], ["isn't"], ['am'], ['am not'], ['are'], ["aren't"]];
        GRAMMAR_SENTENCES = [
            "Were there any clouds? Yes, there were.",
            "Were there any boots? Yes, there were.",
            "Were there any shorts? Yes, there were.",
            "Were there any clouds? Yes, there were.",
            "Were there any boots? Yes, there were.",
            "Were there any shorts? Yes, there were.",
            "Were there any clouds? No, there weren't.",
            "Were there any boots? No, there weren't.",
            "Were there any shorts? No, there weren't.",
            "Were there any clouds? No, there weren't.",
            "Were there any boots? No, there weren't.",
            "Were there any shorts? No, there weren't.",
            "Was there a rainbow? Yes, there was.",
            "Was there a coat? Yes, there was.",
            "Was there a scarf? Yes, there was.",
            "Was there a sweater? Yes, there was.",
            "Was there a T-shirt? Yes, there was.",
            "Was there a rainbow? No, there wasn't.",
            "Was there a coat? No, there wasn't.",
            "Was there a scarf? No, there wasn't.",
            "Was there a sweater? No, there wasn't.",
            "Was there a T-shirt? No, there wasn't.",
            "There weren't any clouds, but there was a rainbow.",
            "There wasn't a rainbow, but there were some clouds.",
            "There were some clouds, but there wasn't a rainbow.",
            "There was a rainbow, but there weren't any clouds.",
            "There weren't any boots, but there was a coat.",
            "There wasn't a coat, but there were some boots.",
            "There were some boots, but there wasn't a coat.",
            "There was a coat, but there weren't any boots.",
            "There weren't any shorts, but there was a T-shirt.",
            "There wasn't a T-shirt, but there were some shorts.",
            "There were some shorts, but there wasn't a T-shirt.",
            "There was a T-shirt, but there weren't any shorts.",
            "There weren't any clouds, but there was rain.",
            "There wasn't rain, but there were some clouds.",
            "There were some clouds, but there wasn't rain.",
            "There was rain, but there weren't any clouds.",
            "There weren't any boots, but there was a scarf.",
            "There wasn't a scarf, but there were some boots.",
            "There were some boots, but there wasn't a scarf.",
            "There was a scarf, but there weren't any boots.",
            "There weren't any shorts, but there was a sweater.",
            "There wasn't a sweater, but there were some shorts.",
            "There were some shorts, but there wasn't a sweater.",
            "There was a sweater, but there weren't any shorts.",
            "There weren't any clouds, but there was snow.",
            "There wasn't snow, but there were some clouds.",
            "There were some clouds, but there wasn't snow.",
            "There was snow, but there weren't any clouds.",
            "There weren't any boots, but there was a coat.",
            "There wasn't a coat, but there were some boots.",
            "There were some boots, but there wasn't a coat.",
            "There was a coat, but there weren't any boots.",
            "There weren't any clouds, but there was wind.",
            "There wasn't wind, but there were some clouds.",
            "There were some clouds, but there wasn't wind.",
            "There was wind, but there weren't any clouds.",
            "There weren't any shorts, but there was a T-shirt.",
            "There wasn't a T-shirt, but there were some shorts.",
            "There were some shorts, but there wasn't a T-shirt.",
            "There was a T-shirt, but there weren't any shorts.",
            "There weren't any clouds, but there was sunshine.",
            "There wasn't sunshine, but there were some clouds.",
            "There were some clouds, but there wasn't sunshine.",
            "There was sunshine, but there weren't any clouds.",
            "Is it sunny today? Yes, it is.",
            "Is it raining today? No, it isn't.",
            "Is it snowing today? Yes, it is.",
            "Is it windy today? No, it isn't.",
            "Is it cloudy today? Yes, it is.",
            "Is it cloudy today? No, it isn't.",
            "Is it sunny today? No, it isn't.",
            "Was it snowing yesterday? Yes, it was",
            "Was it snowing yesterday? No, it wasn't",
            "Was it sunny yesterday? Yes, it was",
            "Was it sunny yesterday? No, it wasn't",
            "Was it raining yesterday? Yes, it was",
            "Was it raining yesterday? No, it wasn't",
            "Was it windy yesterday? Yes, it was",
            "Was it windy yesterday? No, it wasn't",
            "Was it cloudy yesterday? Yes, it was",
            "Was it cloudy yesterday? No, it wasn't",
            "How's the weather today? It's sunny.",
            "How's the weather today? It's raining.",
            "How's the weather today? It's cloudy.",
            "How's the weather today? It's windy.",
            "How's the weather today? It's snowy.",
            "How was the weather yesterday? It was sunny.",
            "How was the weather yesterday? It was raining.",
            "How was the weather yesterday? It was cloudy.",
            "How was the weather yesterday? It was windy.",
            "How was the weather yesterday? It was snowy.",
            "How's the temperature today? It's cold.",
            "How's the temperature today? It's cool.",
            "How's the temperature today? It's warm.",
            "How's the temperature today? It's hot.",
            "How was the temperature yesterday? It was cold.",
            "How was the temperature yesterday? It was cool.",
            "How was the temperature yesterday? It was warm.",
            "How was the temperature yesterday? It was hot.",
        ];
    } else if (book === 'Think1' && unit === '6') {
        SPELLING_WORDS = ["cheerful", "confident", "easy-going", "funny", "generous", "helpful", "intelligent", "friendly", "honest", "kind", "patient", "sensible", "boring", "horrible", "jealous", "lazy", "last"];
        SIGHT_WORDS = [
            ["be", "was"], ["begin", "began"], ["bring", "brought"], ["build", "built"], ["buy", "bought"],
            ["can", "could"], ["catch", "caught"], ["choose", "chose"], ["come", "came"], ["do", "did"],
            ["drive", "drove"], ["eat", "ate"], ["fall", "fell"], ["feel", "felt"], ["find", "found"],
            ["fly", "flew"], ["forget", "forgot"], ["get", "got"], ["go", "went"], ["grow", "grew"],
            ["hear", "heard"], ["hide", "hid"], ["hold", "held"], ["keep", "kept"], ["learn", "learnt"],
            ["let", "let"], ["lose", "lost"], ["make", "made"], ["mean", "meant"], ["meet", "met"],
            ["put", "put"], ["ride", "rode"], ["run", "ran"], ["say", "said"], ["see", "saw"],
            ["sell", "sold"], ["send", "sent"], ["sit", "sat"], ["speak", "spoke"], ["spend", "spent"],
            ["stand", "stood"], ["take", "took"], ["teach", "taught"], ["tell", "told"], ["think", "thought"],
            ["throw", "threw"], ["wake", "woke"], ["write", "wrote"], ["become", "became"], ["break", "broke"],
            ["cost", "cost"], ["cut", "cut"], ["draw", "drew"], ["drink", "drank"], ["give", "gave"],
            ["have", "had"], ["hit", "hit"], ["know", "knew"], ["leave", "left"], ["lend", "lent"],
            ["lie", "lay"], ["pay", "paid"], ["read", "read"], ["show", "showed"], ["sing", "sang"],
            ["sleep", "slept"], ["swim", "swam"], ["understand", "understood"], ["wear", "wore"], ["win", "won"],
            ["answer", "answered"], ["ask", "asked"], ["carry", "carried"], ["change", "changed"],
            ["clean", "cleaned"], ["close", "closed"], ["cook", "cooked"], ["cry", "cried"], ["dance", "danced"],
            ["decide", "decided"], ["drop", "dropped"], ["enjoy", "enjoyed"], ["explain", "explained"],
            ["finish", "finished"], ["happen", "happened"], ["help", "helped"], ["hope", "hoped"],
            ["invite", "invited"], ["jump", "jumped"], ["laugh", "laughed"], ["listen", "listened"],
            ["live", "lived"], ["look", "looked"], ["love", "loved"], ["miss", "missed"], ["move", "moved"],
            ["need", "needed"], ["open", "opened"], ["plan", "planned"], ["play", "played"],
            ["prefer", "preferred"], ["prepare", "prepared"], ["push", "pushed"], ["pull", "pulled"],
            ["rain", "rained"], ["remember", "remembered"], ["return", "returned"], ["save", "saved"],
            ["share", "shared"], ["shop", "shopped"], ["start", "started"], ["stay", "stayed"],
            ["stop", "stopped"], ["study", "studied"], ["talk", "talked"], ["travel", "traveled"],
            ["try", "tried"], ["turn", "turned"], ["use", "used"], ["visit", "visited"], ["wait", "waited"],
            ["walk", "walked"], ["want", "wanted"], ["wash", "washed"], ["watch", "watched"],
            ["work", "worked"], ["worry", "worried"]
        ];
        GRAMMAR_SENTENCES = [
            "I was sick yesterday.", "The movie began 5 minutes ago.", "He brought a cake yesterday afternoon.", "They built a house last year.",
            "I bought a new bag last week.", "I could not sleep last night.", "He caught the ball 2 seconds ago.", "She chose the red dress yesterday evening.",
            "My friend came to my house yesterday.", "I did my homework 1 hour ago.", "Dad drove the car yesterday morning.", "We ate pizza last night.",
            "The boy fell down 1 minute ago.", "I felt happy yesterday afternoon.", "She found her keys 2 hours ago.", "The bird flew away 5 seconds ago.",
            "I forgot my book yesterday morning.", "He got a gift last month.", "We went to the park last week.", "The tree grew tall last year.",
            "I heard a noise last night.", "The cat hid under the bed 10 minutes ago.", "She held the baby yesterday.", "He kept the money yesterday afternoon.",
            "We learnt English last week.", "Mom let me play outside yesterday.", "I lost my phone 3 days ago.", "She made dinner yesterday evening.",
            "He meant no yesterday.", "I met my teacher 2 days ago.", "He put the pen on the table 1 minute ago.", "I rode my bike last Sunday.",
            "The dog ran fast yesterday afternoon.", "She said hello 5 seconds ago.", "I saw a bird yesterday morning.", "He sold his car last year.",
            "I sent an email 1 hour ago.", "We sat on the chair 5 minutes ago.", "The man spoke to me yesterday.", "I spent 10 dollars yesterday evening.",
            "He stood up 1 second ago.", "She took the bus last week.", "Mr. Smith taught math last year.", "She told me a story last night.",
            "I thought about you yesterday.", "He threw the ball 2 minutes ago.", "I woke up at 7 yesterday morning.", "She wrote a letter last month.",
            "He became a doctor 5 years ago.", "I broke the cup yesterday afternoon.", "The apple cost 1 dollar yesterday.", "She cut the paper 3 minutes ago.",
            "The child drew a picture last night.", "I drank milk yesterday morning.", "He gave me a flower 1 hour ago.", "I had a cold last week.",
            "He hit the ball 5 seconds ago.", "I knew the answer yesterday.", "The bus left 10 minutes ago.", "She lent me a book yesterday afternoon.",
            "The dog lay on the floor last night.", "I paid for the food yesterday evening.", "We read a book last month.", "He showed me his photo yesterday.",
            "She sang a song 2 minutes ago.", "The baby slept well last night.", "We swam in the sea last year.", "I understood the lesson yesterday morning.",
            "She wore a hat last week.", "My team won the game yesterday afternoon.", "He answered the phone 1 minute ago.", "She asked a question yesterday morning.",
            "Dad carried the box 5 minutes ago.", "I changed my clothes yesterday evening.", "Mom cleaned the room yesterday.", "The shop closed 1 hour ago.",
            "We cooked dinner last night.", "The baby cried 2 hours ago.", "They danced at the party last week.", "I decided to go 3 days ago.",
            "He dropped the glass 5 seconds ago.", "We enjoyed the movie yesterday evening.", "The teacher explained the rule yesterday morning.", "I finished my work 30 minutes ago.",
            "The accident happened last year.", "He helped his friend yesterday afternoon.", "I hoped for sun yesterday.", "She invited me to lunch last week.",
            "The cat jumped 2 seconds ago.", "We laughed at the joke yesterday.", "I listened to music last night.", "They lived in China 5 years ago.",
            "She looked at the moon last night.", "I loved that toy 2 years ago.", "He missed the bus yesterday morning.", "We moved house last month.",
            "I needed water 10 minutes ago.", "He opened the window 1 hour ago.", "We planned our holiday last week.", "They played football yesterday afternoon.",
            "I preferred the blue car yesterday.", "Mom prepared lunch 2 hours ago.", "He pushed the door 1 minute ago.", "She pulled the bag yesterday evening.",
            "It rained hard last night.", "I remembered his name 5 seconds ago.", "He returned home yesterday evening.", "I saved money last year.",
            "We shared a pizza last night.", "She shopped for food yesterday morning.", "The game started 10 minutes ago.", "We stayed at home yesterday.",
            "The bus stopped 1 minute ago.", "I studied math last week.", "We talked on the phone 2 hours ago.", "They traveled to Japan last year.",
            "I tried the cake yesterday afternoon.", "The car turned left 5 seconds ago.", "I used a pen yesterday morning.", "We visited Grandma last Sunday.",
            "I waited for you 1 hour ago.", "She walked to the park yesterday.", "I wanted ice cream 5 minutes ago.", "Dad washed the car last week.",
            "I watched TV last night.", "He worked hard yesterday.", "Mom worried about me last night.", "She's cheerful. She smiles all the time.",
            "She's cheerful. She is never sad.", "She's cheerful. She says \"Hello\" to everyone happily.", "He's confident. He knows he is good at English.",
            "He's confident. He is not shy when he speaks.", "He's confident. He stands up tall and speaks strictly.", "He's easy-going. He is very relaxed.",
            "He's easy-going. He never gets angry about small things.", "He's easy-going. He says \"No problem\" a lot.", "He's funny. He tells great jokes.",
            "He's funny. He makes all his friends laugh.", "He's funny. He is like a clown in the class.", "She's generous. She buys presents for all her friends.",
            "She's generous. She shares her lunch with me.", "She's generous. She likes to give things to people.", "He's helpful. He helps his mum clean the house.",
            "She's helpful. She helps her brother with his homework.", "He's helpful. He carries the heavy bags for the teacher.", "She's intelligent. She learns very fast.",
            "She's intelligent. She gets 100% on her tests.", "She's intelligent. She knows the answer to every question.", "He's friendly. He talks to new students.",
            "She's friendly. She likes to play with everyone.", "He's friendly. Everyone likes him because he is nice.", "He's honest. He never tells a lie.",
            "He's honest. He always tells the truth.", "He's honest. If he breaks a window, he says \"I did it.\"", "She's kind. She is very nice to animals.",
            "She's kind. She helps people when they are sad.", "She's kind. She has a good heart.", "He's patient. He can wait for a long time.",
            "He's patient. He doesn't get angry when the bus is late.", "He's patient. He helps me slowly and doesn't say \"Hurry up!\"", "She's sensible. It is cold, so she wears a coat.",
            "He's sensible. He does his homework before he plays games.", "She's sensible. She doesn't do dangerous things.", "He's boring. I want to sleep when he talks.",
            "He's boring. He never does fun things.", "He's boring. His stories are not interesting.", "He's horrible. He kicks the dog.",
            "He's horrible. He shouts at his little sister.", "He's horrible. He is a very bad person.", "He's jealous. He wants my new toy.",
            "She's jealous. She is angry because the teacher likes me.", "He's jealous. He wants what his friend has.", "He's lazy. He stays in bed all day.",
            "He's lazy. He doesn't want to work or study.", "He's lazy. He never cleans his room."
        ];
    } else {
        // Placeholders for other units
        const prefix = `${book} U${unit}`;
        SPELLING_WORDS = [`${prefix} Word1`, `${prefix} Word2`, `${prefix} Word3`, `${prefix} Word4`];
        SIGHT_WORDS = [[`${prefix} Sight1`, `Distractor`], [`${prefix} Sight2`, `Distractor`]];
        GRAMMAR_SENTENCES = [`${prefix} Placeholder sentence 1.`, `${prefix} Placeholder sentence 2.`];
    }
}

// --- MINIGAMES ---

function startSpellingGame() {
    const level = game.scene.getScene('MainScene').playerStats.level;
    if (SPELLING_WORDS.length === 0) { handleMinigameSuccess('spelling'); return; }
    const word = SPELLING_WORDS[Math.floor(Math.random() * SPELLING_WORDS.length)];
    currentTTSWord = word;

    const totalChars = word.length;
    let missingCount = Math.min(totalChars, 1 + Math.floor((level - 1) / 2)); // Adjusted difficulty
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

    let choiceCount = 2;
    if (level >= 5) choiceCount = 3;
    if (level >= 10) choiceCount = 4;

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
    const sentenceStr = GRAMMAR_SENTENCES[Math.floor(Math.random() * GRAMMAR_SENTENCES.length)];
    const level = game.scene.getScene('MainScene').playerStats.level;

    const sentContainer = document.getElementById('sentence-container');
    const dock = document.getElementById('word-dock');
    sentContainer.innerHTML = ''; dock.innerHTML = '';

    document.getElementById('grammar-result-action').classList.add('hidden');
    document.getElementById('grammar-actions').classList.remove('hidden');

    const rawChunks = sentenceStr.split(' ');
    const tokens = rawChunks.map(chunk => {
        const match = chunk.match(/^(.+?)([,.]+)$/);
        return match ? { word: match[1], punct: match[2] } : { word: chunk, punct: '' };
    });

    const candidateIndices = tokens.map((_, i) => i);
    candidateIndices.sort(() => 0.5 - Math.random());

    let numBlanks = Math.min(tokens.length, Math.max(1, Math.floor(level / 2))); // Scale blanks with level

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
    let allCorrect = true;
    let anyFilled = false;

    zones.forEach(zone => {
        if (zone.children.length > 0) {
            anyFilled = true;
            const item = zone.children[0];
            if (item.innerText === zone.dataset.expected) {
                item.classList.add('correct');
                item.classList.remove('wrong');
            } else {
                item.classList.add('wrong');
                item.classList.remove('correct');
                allCorrect = false;
            }
        } else {
            allCorrect = false;
        }
    });

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

    if (isFirstAttempt) {
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
