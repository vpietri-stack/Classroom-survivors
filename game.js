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

const synthDeath = () => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const playNote = (freq, start, dur) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.2, start);
        g.gain.exponentialRampToValueAtTime(0.01, start + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(start); o.stop(start + dur);
    };
    // dadadadum
    playNote(220, now, 0.2);       // A3
    playNote(220, now + 0.25, 0.2);  // A3
    playNote(220, now + 0.5, 0.2);   // A3
    playNote(164.8, now + 0.75, 0.6); // E3 (lower)
};

const synthLootbox = () => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(440, now);
    o.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    o.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(now + 0.3);
};
let currentTTSWord = "";
const playTTS = () => {
    if (!currentTTSWord) return;
    const text = currentTTSWord;

    const playYoudao = () => {
        const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`;
        const audio = new Audio(url);
        audio.play().catch(e => {
            console.warn("Youdao TTS failed, trying Baidu", e);
            playBaidu();
        });
        audio.onerror = () => {
            console.warn("Youdao TTS error, trying Baidu");
            playBaidu();
        };
    };

    const playBaidu = () => {
        // Use lan=uk as per Phonics reference
        const url = `https://fanyi.baidu.com/gettts?lan=uk&text=${encodeURIComponent(text)}&spd=3&source=web`;
        const audio = new Audio(url);
        audio.play().catch(e => {
            console.warn("Baidu TTS failed, trying Browser", e);
            playBrowserSpeech();
        });
        audio.onerror = () => {
            console.warn("Baidu TTS error, trying Browser");
            playBrowserSpeech();
        };
    };

    const playBrowserSpeech = () => {
        console.log("Falling back to Browser Speech");
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 0.9;
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(val => val.lang.includes('GB') || val.lang.includes('UK') || val.lang.includes('en'));
            if (v) u.voice = v;
            window.speechSynthesis.speak(u);
        }
    };

    playYoudao();
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
    { id: 'might', name: "Spinach", icon: "🥬", type: "stat", desc: "+10% Damage" }
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
        this.nextSwarmTime = Phaser.Math.Between(30 * 60, 90 * 60); // ~1 minute average

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
        this.lootboxes = this.physics.add.group();
        this.tornados = this.physics.add.group();
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
        this.physics.add.collider(this.enemies, this.enemies, null, (e1, e2) => !e1.isBat && !e2.isBat, this);
        this.physics.add.overlap(this.player, this.enemies, this.handlePlayerHit, null, this);
        this.physics.add.collider(this.player, this.obstacles);
        this.physics.add.collider(this.enemies, this.obstacles, null, (e, o) => !e.isBat, this);
        this.physics.add.overlap(this.player, this.lootboxes, this.handleLootboxPickup, null, this);
        this.physics.add.overlap(this.tornados, this.enemies, (t, e) => this.damageEnemy(e, 999), null, this);

        this.applyReward({ id: 'wand', name: 'Spirit Wand', type: 'weapon' });
        updateDOMHUD(this.playerStats, 0, 0);

        // Initial Horde
        for (let i = 0; i < 50; i++) {
            this.spawnEnemy(Phaser.Math.Between(300, 1000));
        }
    }

    update(time, delta) {
        if (this.gameState === 'GAMEOVER') {
            this.player.body.setVelocity(0, 0);
            return;
        }
        if (this.gameState !== 'PLAYING') return;

        // Player Move
        let dx = 0, dy = 0;
        const speed = 80 * this.playerStats.speed;
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
            const isFlashing = this.invulnTimer % 10 < 5;
            this.player.alpha = isFlashing ? 0.6 : 1;
            this.player.setTint(isFlashing ? 0xff0000 : 0xffffff);
        } else {
            this.player.alpha = 1;
            this.player.clearTint();
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
        const playSeconds = (this.accumulatedTime + totalMinigameTimeMs) / 1000;
        // Start way higher (12 frames) and scale linearly. No aggressive jump for spawn rate.
        const spawnDelay = Math.max(2, 12 - (playSeconds / 45));
        if (this.spawnTimer > spawnDelay) {
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

        // Random Bat Swarms
        this.nextSwarmTime--;
        if (this.nextSwarmTime <= 0) {
            this.spawnBatSwarm();
            this.nextSwarmTime = Phaser.Math.Between(3000, 4200); // ~1 minute roughly
        }

        // Move Tornados
        if (this.activeTornados) {
            this.activeTornados = this.activeTornados.filter(t => t.active);
            this.activeTornados.forEach(t => {
                t.theta += 0.08;
                const r = t.a + t.b * t.theta;
                t.x = t.spawnX + r * Math.cos(t.theta);
                t.y = t.spawnY + r * Math.sin(t.theta);

                if (t.fireballs) {
                    t.fireballs.forEach(fb => {
                        if (!fb.active) return;
                        fb.orbitAngle += fb.orbitSpeed;
                        fb.x = t.x + Math.cos(fb.orbitAngle) * fb.orbitRadius;
                        fb.y = t.y + Math.sin(fb.orbitAngle) * fb.orbitRadius;
                        fb.rotation += 0.1;

                        // Fire trail
                        if (this.gameTime % 2 === 0) {
                            const trail = this.add.text(fb.x, fb.y, '🔥', { fontSize: '20px' }).setOrigin(0.5).setAlpha(0.5);
                            this.time.delayedCall(250, () => trail.destroy());
                        }
                    });
                }
            });
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
        const isBat = type === 1;
        let sprite = isBat ? '🦇' : (type === 2 ? '🧟' : '👾');

        const difficulty = this.getDifficulty();
        // Weaker HP, but higher spawn rate handled in update
        const hp = 2 + (difficulty * 1);
        const speed = (17 + (Math.random() * 10) + (difficulty * 0.7));

        const enemy = this.add.text(ex, ey, sprite, { fontSize: '25px', padding: { top: 5 } }).setOrigin(0.5);
        this.physics.add.existing(enemy);
        enemy.body.setCircle(10); // Smaller collider
        enemy.hp = hp; enemy.maxHp = hp; enemy.speed = speed; enemy.isBoss = false;
        enemy.isBat = isBat;
        enemy.stunTimer = 0;
        this.enemies.add(enemy);
    }

    spawnBoss() {
        const boss = this.add.text(this.player.x, this.player.y - 600, '👹', { fontSize: '80px', padding: { top: 20 } }).setOrigin(0.5);
        this.physics.add.existing(boss);
        boss.body.setCircle(35);
        const difficulty = this.getDifficulty();
        boss.hp = 300 + (difficulty * 50);
        boss.speed = 33 + (difficulty * 0.5);
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

            const difficulty = this.getDifficulty();
            const sprite = '🧟';
            const hp = 2 + (difficulty * 1);
            const speed = 27 + (difficulty * 0.3); // Slightly faster charge?

            const enemy = this.add.text(ex, ey, sprite, { fontSize: '25px', padding: { top: 5 } }).setOrigin(0.5);
            this.physics.add.existing(enemy);
            enemy.body.setCircle(10);
            enemy.hp = hp; enemy.maxHp = hp; enemy.speed = speed; enemy.isBoss = false;
            enemy.stunTimer = 0;
            this.enemies.add(enemy);
        }
    }

    spawnObstacles() {
        // Initial batch around player start (reduced from 80)
        for (let i = 0; i < 30; i++) {
            this.spawnSingleObstacle(Phaser.Math.Between(400, 1500));
        }
    }

    spawnSingleObstacle(distance = null) {
        const obstacleTypes = [
            { emoji: '🌲', fontSize: '100px', bodyRad: 10, isTree: true },
            { emoji: '🌳', fontSize: '100px', bodyRad: 10, isTree: true },
            { emoji: '🪨', fontSize: '50px', bodyRad: 20 },
            { emoji: '🌿', fontSize: '50px', bodyRad: 20 },
            { emoji: '🛖', fontSize: '150px', bodyRad: 65 }
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
            pond.fillEllipse(x, y, 80, 50);

            const pondCollider = this.add.zone(x, y, 70, 40);
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
                obs.body.setOffset((obs.width - type.bodyRad * 2) / 2, obs.height - type.bodyRad * 2 - 10);
            } else {
                // Center collision
                obs.body.setOffset((obs.width - type.bodyRad * 2) / 2, (obs.height - type.bodyRad * 2) / 2);
            }
        }
    }

    spawnBatSwarm() {
        const side = Phaser.Math.Between(0, 3); // 0:L, 1:R, 2:T, 3:B
        const count = 30 + Math.floor(this.getDifficulty() * 2);
        const playerSpeed = 80 * this.playerStats.speed;
        const swarmSpeed = playerSpeed * 4.5;
        const difficulty = this.getDifficulty();
        const hp = (2 + (difficulty * 1)) * 0.5;

        for (let i = 0; i < count; i++) {
            this.time.delayedCall(i * 40, () => {
                const cam = this.cameras.main;
                const margin = 40; // Spawns just outside the visible edge
                let startX, startY;

                // Freshly calculate camera bounds for each bat so they follow player movement
                if (side === 0) { // From Left
                    startX = cam.worldView.left - margin;
                    startY = cam.worldView.top + Math.random() * cam.worldView.height;
                } else if (side === 1) { // From Right
                    startX = cam.worldView.right + margin;
                    startY = cam.worldView.top + Math.random() * cam.worldView.height;
                } else if (side === 2) { // From Top
                    startX = cam.worldView.left + Math.random() * cam.worldView.width;
                    startY = cam.worldView.top - margin;
                } else { // From Bottom
                    startX = cam.worldView.left + Math.random() * cam.worldView.width;
                    startY = cam.worldView.bottom + margin;
                }

                const ox = (Math.random() - 0.5) * 60;
                const oy = (Math.random() - 0.5) * 60;
                const bat = this.add.text(startX + ox, startY + oy, '🦇', { fontSize: '20px' }).setOrigin(0.5);
                this.physics.add.existing(bat);
                bat.body.setCircle(8);
                bat.hp = hp; bat.maxHp = hp; bat.speed = swarmSpeed;
                bat.isSwarm = true;
                bat.isBat = true;
                this.enemies.add(bat);

                // Target the player's current position to guarantee they sweep through
                const angle = Phaser.Math.Angle.Between(bat.x, bat.y, this.player.x, this.player.y);
                const finalAngle = angle + (Math.random() - 0.5) * 0.15; // Tight spread

                bat.body.setVelocity(
                    Math.cos(finalAngle) * swarmSpeed,
                    Math.sin(finalAngle) * swarmSpeed
                );

                // Self-destruct when far away (increased to ensure screen crossing)
                this.time.addEvent({
                    delay: 5000,
                    callback: () => { if (bat.active) bat.destroy(); }
                });
            });
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

    getDifficulty() {
        // playTimeMs is the "play time" (Survival time excluding minigame deductions)
        // totalMinigameTimeMs is global in game.js
        const playTimeMs = this.accumulatedTime + totalMinigameTimeMs;
        const seconds = playTimeMs / 1000;

        // Base scaling: 1 "level" worth of difficulty per 30 seconds
        let difficulty = seconds / 30;

        if (seconds > 300) {
            // Aggressive scaling after 5 minutes
            difficulty += Math.pow((seconds - 300) / 10, 1.2);
        }

        // Start at minimum difficulty 1
        return Math.max(1, difficulty);
    }

    updateWeapons() {
        this.enemies.getChildren().forEach(e => {
            if (e.stunTimer > 0) {
                e.stunTimer--;
            } else if (!e.isSwarm) {
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
        // Sequential Strike Sequence: Forward, Up, Back, Down
        // L1-2: [F]
        // L3: [F, B]
        // L4: [F, U, B]
        // L5+: [F, U, B, D]

        const sequence = ['front'];
        if (w.level >= 4) sequence.push('up');
        if (w.level >= 3) sequence.push('back');
        if (w.level >= 5) sequence.push('down');

        // Stats Calculation
        // Level 2, 4, 6, 8... increase range? (Current logic was a bit messy)
        // New logic: 
        // L2: +5 Dmg
        // L6+: Alternates Range (+40) and Damage (+5)
        let dmgBonus = 0;
        let rangeBonus = 0;

        if (w.level >= 2) dmgBonus += 5; // Level 2 bonus

        if (w.level >= 6) {
            const post5 = w.level - 5;
            // Odd post5 (6, 8, 10): Range
            // Even post5 (7, 9, 11): Damage
            rangeBonus += Math.ceil(post5 / 2) * 40;
            dmgBonus += Math.floor(post5 / 2) * 5;
        }

        const range = 220 + rangeBonus;
        const damage = (15 + dmgBonus) * this.playerStats.might;
        const strikeDuration = 150;

        sequence.forEach((dir, index) => {
            this.time.delayedCall(index * strikeDuration, () => {
                this.performWhipStrike(dir, damage, range, strikeDuration);
            });
        });
    }

    performWhipStrike(direction, damage, range, duration) {
        synthShoot('whip');
        const whip = this.add.graphics();
        const px = this.player.x;
        const py = this.player.y;
        const thickness = 75;

        // Direction mapping: 
        // front: facing (scaleX), back: -facing, up: rotate -90, down: rotate 90
        let angleOffset = 0;
        if (direction === 'back') angleOffset = Math.PI;
        if (direction === 'up') angleOffset = -Math.PI / 2;
        if (direction === 'down') angleOffset = Math.PI / 2;

        const facing = this.player.scaleX; // 1 (right) or -1 (left)
        const baseAngle = facing === 1 ? 0 : Math.PI;
        const finalAngle = baseAngle + angleOffset;

        // Visuals
        [
            { color: 0x0000cc, thick: 40, alpha: 0.4, scale: 1.1 },
            { color: 0x00ffff, thick: 15, alpha: 0.8, scale: 1.0 },
            { color: 0xffffff, thick: 5, alpha: 1.0, scale: 0.9 }
        ].forEach(l => {
            whip.lineStyle(l.thick, l.color, l.alpha);

            // We use a simplified path for all directions by rotating the coordinate system conceptually
            // or just calculating points based on finalAngle.
            // Old logic used cubicBezierTo which was hardcoded for horizontal. 
            // Let's adapt it to any angle.

            const path = new Phaser.Curves.Path(px, py);

            // Calculate control points based on angle
            const cp1x = px + Math.cos(finalAngle) * range * l.scale * 0.5;
            const cp1y = py + Math.sin(finalAngle) * range * l.scale * 0.5;

            const cp2x = px + Math.cos(finalAngle + 0.2 * facing) * range * l.scale * 0.8;
            const cp2y = py + Math.sin(finalAngle + 0.2 * facing) * range * l.scale * 0.8;

            const endX = px + Math.cos(finalAngle - 0.1 * facing) * range * l.scale;
            const endY = py + Math.sin(finalAngle - 0.1 * facing) * range * l.scale;

            path.moveTo(px, py);
            path.cubicBezierTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
            path.draw(whip);
        });

        // Particles
        whip.fillStyle(0xaaddff, 0.8);
        for (let i = 0; i < 8; i++) {
            const dist = Math.random() * range * 0.8;
            const pAngle = finalAngle + (Math.random() - 0.5) * 0.3;
            const pxr = px + Math.cos(pAngle) * dist;
            const pyr = py + Math.sin(pAngle) * dist;
            whip.fillCircle(pxr, pyr, Phaser.Math.Between(2, 4));
        }

        // Hit Detection
        this.enemies.getChildren().forEach(e => {
            const dx = e.x - px;
            const dy = e.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= range) {
                const angleToEnemy = Math.atan2(dy, dx);
                // Difference between finalAngle and angleToEnemy
                let diff = Math.abs(Phaser.Math.Angle.Normalize(angleToEnemy - finalAngle));
                if (diff < 0.6) { // ~35 degrees cone
                    this.damageEnemy(e, damage, 300);
                }
            }
        });

        this.tweens.add({ targets: whip, alpha: 0, duration: duration, onComplete: () => whip.destroy() });
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
                if (b.returnTimer <= 0 && !b.reversed && b.body) {
                    b.body.velocity.x *= -1; b.body.velocity.y *= -1; b.reversed = true;
                }
            }

        });
    }

    handlePlayerHit(player, enemy) {
        if (this.invulnTimer > 0) return;

        synthHurt();
        // Calculate damage: 1 base + 1 per minute of play time (restoring the time deducted by minigames)
        const playTimeMs = this.accumulatedTime + totalMinigameTimeMs;
        const damage = 1 + Math.floor(playTimeMs / 60000);
        this.playerStats.hp -= damage;
        this.invulnTimer = 60;

        // Remove Player Knockback
        // (Removed lines that set knockbackVelocity)

        updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
        if (this.playerStats.hp <= 0 && this.gameState !== 'GAMEOVER') {
            this.gameState = 'GAMEOVER';
            this.gameOver();
        }
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
            enemy.body.checkCollision.none = true; // No more hitting things
            enemy.body.setVelocity(enemy.body.velocity.x * 1.5, enemy.body.velocity.y * 1.5); // Boost death slide
            enemy.body.setDrag(1000); // Slow down gradually
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
                    if (enemy.isBoss) {
                        for (let i = 0; i < 5; i++) {
                            const offsetX = (Math.random() - 0.5) * 40;
                            const offsetY = (Math.random() - 0.5) * 40;
                            const g = this.add.circle(enemy.x + offsetX, enemy.y + offsetY, 6, 0x00ff88);
                            this.physics.add.existing(g);
                            g.val = 10; g.type = 'xp';
                            this.gems.add(g);
                        }
                    } else {
                        const g = this.add.circle(enemy.x, enemy.y, 6, 0x00ff88);
                        this.physics.add.existing(g);
                        g.val = 5; g.type = 'xp';
                        this.gems.add(g);
                    }
                    this.killCount++;
                    if (!enemy.isBoss && Math.random() < 0.01) {
                        this.spawnLootbox(enemy.x, enemy.y);
                    }
                    updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
                    enemy.destroy();
                }
            });
        }
    }

    spawnLootbox(x, y) {
        const weapons = POWER_UPS.filter(p => p.type === 'weapon');
        const specials = [
            { id: 'heart', icon: '❤️', type: 'special' },
            { id: 'vortex', icon: '🌀', type: 'special' },
            { id: 'tornado', icon: '🌪️', type: 'special' }
        ];
        const choices = [...weapons, ...specials];
        const choice = Phaser.Math.RND.pick(choices);

        const container = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 50, 50, 0xffd700).setAlpha(0.8);
        const icon = this.add.text(0, 0, choice.icon || choice.emoji, { fontSize: '30px' }).setOrigin(0.5);
        container.add([bg, icon]);

        this.physics.add.existing(container);
        container.body.setSize(50, 50);
        container.body.setOffset(-25, -25);
        container.reward = choice;
        this.lootboxes.add(container);

        // Flashing gold square
        this.tweens.add({
            targets: bg,
            alpha: 0.3,
            duration: 300,
            yoyo: true,
            repeat: -1
        });
    }

    handleLootboxPickup(player, box) {
        if (box.collected) return;
        box.collected = true;

        const reward = box.reward;
        const iconStr = reward.icon || reward.emoji;

        synthLootbox();

        // Visual orbit animation before activation
        const flyingIcon = this.add.text(box.x, box.y, iconStr, { fontSize: '30px' }).setOrigin(0.5);
        box.destroy();

        let orbitAngle = 0;
        this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 800,
            onUpdate: (tween) => {
                const t = tween.getValue();
                orbitAngle += 0.25;
                const radius = 60 * (1 - t * 0.4);

                flyingIcon.x = this.player.x + Math.cos(orbitAngle) * radius;
                flyingIcon.y = this.player.y + Math.sin(orbitAngle) * radius;
                flyingIcon.rotation += 0.15;

                if (t > 0.6) {
                    const snapT = (t - 0.6) / 0.4;
                    flyingIcon.x = Phaser.Math.Linear(flyingIcon.x, this.player.x, snapT);
                    flyingIcon.y = Phaser.Math.Linear(flyingIcon.y, this.player.y, snapT);
                    flyingIcon.scale = 1.2 * (1 - snapT);
                }
            },
            onComplete: () => {
                flyingIcon.destroy();

                // Bonus triggers EXACTLY when icon flies into player
                if (reward.type === 'weapon') {
                    this.applyReward(reward);
                } else {
                    if (reward.id === 'heart') {
                        this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + 30);
                    } else if (reward.id === 'vortex') {
                        this.gems.getChildren().forEach(gem => {
                            if (gem.type === 'xp') gem.vortexed = true;
                        });
                    } else if (reward.id === 'tornado') {
                        this.spawnTornado();
                    }
                }
                updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
                synthGem(); // Secondary snap sound
            }
        });
    }

    spawnTornado() {
        // Invisible center for the spiral movement
        const tornado = this.add.circle(this.player.x, this.player.y, 5, 0xffffff, 0);
        this.physics.add.existing(tornado);
        this.tornados.add(tornado);

        tornado.theta = 0;
        tornado.spawnX = this.player.x;
        tornado.spawnY = this.player.y;
        tornado.a = 50;  // Initial offset
        tornado.b = 8;   // Spiral expansion rate
        tornado.fireballs = [];

        // Create a swirling mass of fireballs
        for (let i = 0; i < 12; i++) {
            const fb = this.add.text(this.player.x, this.player.y, '🔥', { fontSize: '40px' }).setOrigin(0.5);
            this.physics.add.existing(fb);
            fb.body.setCircle(15);
            this.tornados.add(fb);

            fb.orbitRadius = Phaser.Math.Between(20, 70);
            fb.orbitSpeed = Phaser.Math.FloatBetween(0.1, 0.2);
            fb.orbitAngle = (i / 12) * Math.PI * 2;
            tornado.fireballs.push(fb);
        }

        if (!this.activeTornados) this.activeTornados = [];
        this.activeTornados.push(tornado);

        this.time.delayedCall(5000, () => {
            if (tornado.fireballs) tornado.fireballs.forEach(f => { if (f.active) f.destroy(); });
            tornado.destroy();
        });
    }

    updateGems() {
        this.gems.getChildren().forEach(g => {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, g.x, g.y);
            if (d < 150 || g.vortexed) this.physics.moveToObject(g, this.player, 600);
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
        const types = ['spelling', 'wordrec', 'scramble', 'sentencematch'];
        const type = types[Math.floor(Math.random() * types.length)];
        startMiniGame(type, 'chest');
    }

    gameOver() {
        // Character can't be controlled (handled in update check)
        this.player.body.setVelocity(0, 0);
        this.player.body.setImmovable(true);

        // Disable enemy movement/spawn
        this.enemies.getChildren().forEach(e => {
            if (e.body) e.body.setVelocity(0, 0);
        });

        // Death Sequence
        synthDeath();

        // Turn red and scale up slightly for drama
        this.tweens.add({
            targets: this.player,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 1500,
            ease: 'Power2'
        });

        this.tweens.addCounter({
            from: 255,
            to: 0,
            duration: 2000,
            onUpdate: (tween) => {
                const value = Math.floor(tween.getValue());
                // Gradual shift to full red (keeping red at 255, lowering G and B)
                this.player.setTint(Phaser.Display.Color.GetColor(255, value, value));
            },
            onComplete: () => {
                // Flash white screen then show result
                this.cameras.main.flash(500, 255, 255, 255);

                this.time.delayedCall(500, () => {
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
                    const scoreSec = Math.max(0, survivalTimeSec);

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
                    const displayText = selectedDay && selectedTime ? `${selectedDay} ${selectedTime}` : 'N/A';
                    document.getElementById('finalContentDisplay').innerText = displayText;

                    document.getElementById('gameOverScreen').classList.remove('hidden');
                });
            }
        });
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
                if (reward.id === 'whip') p.weapons.push({ type: 'whip', level: 1, timer: 0, cooldown: 120 });
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

// --- WIZARD STATE ---
let selectedDay = null;
let selectedTime = null;
let selectedStudent = null;

function initMenus() {
    if (typeof CLASS_CONFIG === 'undefined' || typeof CLASS_DAYS === 'undefined') {
        console.error("CLASS_CONFIG or CLASS_DAYS is undefined. Make sure teaching_content.js is loaded correctly.");
        return;
    }

    // Populate Day buttons
    const dayContainer = document.getElementById('day-buttons');
    dayContainer.innerHTML = '';

    CLASS_DAYS.forEach(day => {
        const btn = document.createElement('button');
        btn.className = 'wizard-btn bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200';
        btn.innerText = day;
        btn.onclick = () => selectDay(day);
        dayContainer.appendChild(btn);
    });
}

function selectDay(day) {
    selectedDay = day;

    // Hide step 1, show step 2
    document.getElementById('step-day').classList.add('hidden');
    document.getElementById('step-time').classList.remove('hidden');

    // Populate time buttons for this day
    const timeContainer = document.getElementById('time-buttons');
    const noClassMsg = document.getElementById('no-class-msg');
    timeContainer.innerHTML = '';

    const dayData = CLASS_CONFIG[day];

    if (dayData && Object.keys(dayData).length > 0) {
        noClassMsg.classList.add('hidden');
        Object.keys(dayData).forEach(time => {
            const btn = document.createElement('button');
            btn.className = 'wizard-btn bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200';
            btn.innerText = time;
            btn.onclick = () => selectTime(time);
            timeContainer.appendChild(btn);
        });
    } else {
        // No classes for this day
        noClassMsg.classList.remove('hidden');
    }
}

function selectTime(time) {
    selectedTime = time;

    // Hide step 2, show step 3
    document.getElementById('step-time').classList.add('hidden');
    document.getElementById('step-student').classList.remove('hidden');

    // Populate student buttons
    const studentContainer = document.getElementById('student-buttons');
    studentContainer.innerHTML = '';

    const classData = CLASS_CONFIG[selectedDay][time];

    if (classData && classData.students) {
        classData.students.forEach(student => {
            const btn = document.createElement('button');
            btn.className = 'wizard-btn bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200';
            btn.innerText = student;
            btn.onclick = () => selectStudent(student);
            studentContainer.appendChild(btn);
        });
    }
}

function selectStudent(student) {
    selectedStudent = student;

    // Hide step 3, show step 4 (greeting)
    document.getElementById('step-student').classList.add('hidden');
    document.getElementById('step-greeting').classList.remove('hidden');

    // Update greeting text
    document.getElementById('greeting-text').innerText = `Hello, ${student}!`;

    // Load content for this class
    loadContent();
}

// --- BACK NAVIGATION ---
function goBackToDay() {
    document.getElementById('step-time').classList.add('hidden');
    document.getElementById('step-day').classList.remove('hidden');
    selectedDay = null;
}

function goBackToTime() {
    document.getElementById('step-student').classList.add('hidden');
    document.getElementById('step-time').classList.remove('hidden');
    selectedTime = null;
}

function goBackToStudent() {
    document.getElementById('step-greeting').classList.add('hidden');
    document.getElementById('step-student').classList.remove('hidden');
    selectedStudent = null;
}

// --- GAME INTRO ---
function showGameIntro() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameIntroOverlay').classList.remove('hidden');
}

function startGameFromIntro() {
    document.getElementById('gameIntroOverlay').classList.add('hidden');
    triggerStartGame();
}

function triggerStartGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameIntroOverlay').classList.add('hidden');
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
    const allGameTypes = ['spelling', 'wordrec', 'scramble', 'sentencematch'];
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
                if (nextLevel === 2) description = "Increased Damage";
                else if (nextLevel === 3) description = "Back Attack";
                else if (nextLevel === 4) description = "Up Attack";
                else if (nextLevel === 5) description = "Down Attack";
                else {
                    const post5 = nextLevel - 5;
                    description = post5 % 2 !== 0 ? "Increased Range" : "Increased Damage";
                }
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
        const sentencematchTimer = document.getElementById('sentencematch-timer');
        if (sentencematchTimer) sentencematchTimer.textContent = timeString;

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
    if (type === 'sentencematch') startSentenceMatchGame();
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
    document.getElementById('sentenceMatchGame').classList.add('hidden');

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
    if (!CLASS_CONFIG || !selectedDay || !selectedTime) return;

    const classData = CLASS_CONFIG[selectedDay] && CLASS_CONFIG[selectedDay][selectedTime];

    if (!classData || !classData.content) {
        console.warn("No content configured for:", selectedDay, selectedTime);
        return;
    }

    const { book, unit, page } = classData.content;

    // Default to empty
    SPELLING_WORDS = [];
    SIGHT_WORDS = [];
    GRAMMAR_SENTENCES = [];

    // Use Spaced Repetition logic to get all available items up to current page
    const sortedPages = getSortedPagesForBook(book);
    const activePageIndex = sortedPages.findIndex(p => p.book === book && p.unit === unit && p.page === page.toString());

    // We populate the global arrays with ALL eligible items (current + future)
    // The specific weighted selection will happen during minigame start
    const unitsToLoad = sortedPages.slice(activePageIndex);

    unitsToLoad.forEach(p => {
        const content = TEACHING_CONTENT[book] && TEACHING_CONTENT[book][p.unit] && TEACHING_CONTENT[book][p.unit][p.page];
        if (content) {
            if (content.vocab) {
                content.vocab.forEach(w => {
                    if (!SPELLING_WORDS.includes(w)) SPELLING_WORDS.push(w);
                });
            }
            if (content.sentences) {
                content.sentences.forEach(s => {
                    // Avoid dupes if necessary, though sentences might be unique across pages usually
                    GRAMMAR_SENTENCES.push(s);
                });
            }
        }
    });

    // Format SIGHT_WORDS (legacy legacy...)
    SIGHT_WORDS = SPELLING_WORDS.map(w => [w]);

    if (SPELLING_WORDS.length === 0) {
        // Final fallback if absolutely nothing found
        const prefix = `${book} U${unit} P${page}`;
        SPELLING_WORDS = [`${prefix} Word1`];
        SIGHT_WORDS = [[`${prefix} Word1`]];
        GRAMMAR_SENTENCES = [`${prefix} Sentence 1.`];
    }
}

// --- MINIGAMES ---

function startSpellingGame() {
    const level = game.scene.getScene('MainScene').playerStats.level;
    if (SPELLING_WORDS.length === 0) { handleMinigameSuccess('spelling'); return; }

    // Weighted selection
    const { book, unit, page } = CLASS_CONFIG[selectedDay][selectedTime].content;
    const word = getWeightedItemForGame(book, unit, page, 'vocab');
    currentTTSWord = word;

    const totalChars = word.length;
    // Always use ALL letters - no level-based scaling
    // But spaces should be pre-filled
    const indices = [];
    for (let i = 0; i < totalChars; i++) {
        if (word[i] !== ' ') {
            indices.push(i);
        }
    }
    const missingIndices = [...indices]; // All non-space characters are missing
    let missingCount = missingIndices.length;

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
            // Show literal characters like spaces
            displayHtml += char === ' ' ? '&nbsp;' : char;
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

    const { book, unit, page } = CLASS_CONFIG[selectedDay][selectedTime].content;
    const target = getWeightedItemForGame(book, unit, page, 'vocab');

    currentTTSWord = target;
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

    const { book, unit, page } = CLASS_CONFIG[selectedDay][selectedTime].content;
    const rawEntry = getWeightedItemForGame(book, unit, page, 'sentences');
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


// --- SENTENCE MATCH MINIGAME ---
let gameModeSelectedBTile = null;

function startSentenceMatchGame() {
    const { book, unit, page } = CLASS_CONFIG[selectedDay][selectedTime].content;
    // Get sentence pairs using weighted selection (similar to other minigames but for 5 items)
    const sortedPages = getSortedPagesForBook(book);
    const activePageIndex = sortedPages.findIndex(p => p.book === book && p.unit === unit && p.page === page.toString());

    // Game Mode logic: content from current page onwards (or falling back to current if at end)
    let gamePages = [];
    if (activePageIndex !== -1) {
        const gamePageIndices = [];
        for (let i = activePageIndex; i < sortedPages.length; i++) {
            gamePageIndices.push(i);
        }
        gamePages = gamePageIndices.map(idx => sortedPages[idx]);
    } else {
        // Fallback if page not found in sorted list
        gamePages = [{ book, unit, page: page.toString(), absIndex: 0 }];
    }

    // Pick 5 pairs using the weighted logic
    let pairs = pickUniqueItems(gamePages, 5, 'sentencePairs', activePageIndex, true);

    // Fallback if selection returns nothing
    if (pairs.length === 0) {
        pairs = [
            { a: "What's your name?", b: "My name is Sarah." },
            { a: "How old are you?", b: "I'm seven years old." },
            { a: "What colour is the apple?", b: "The apple is red." },
            { a: "Where's the book?", b: "The book is on the desk." },
            { a: "Is it a cat?", b: "No, it isn't a cat." }
        ];
    }

    // Shuffle and ensure we have up to 3 pairs
    const shuffledPairs = pairs.sort(() => 0.5 - Math.random()).slice(0, 3);

    // Store in game element for later reference
    const gameEl = document.getElementById('sentenceMatchGame');
    gameEl.dataset.pairs = JSON.stringify(shuffledPairs);

    // Create shuffled B sentences
    const bSentences = shuffledPairs.map((p, i) => ({ text: p.b, correctIndex: i }));
    bSentences.sort(() => 0.5 - Math.random());

    // Build pairs UI
    const pairsContainer = document.getElementById('sentencematch-pairs');
    pairsContainer.innerHTML = shuffledPairs.map((pair, index) => `
        <div class="match-pair-row flex flex-col sm:flex-row gap-2 items-stretch">
            <div class="sentence-a flex-1 bg-indigo-600 p-3 rounded-lg text-white font-medium text-sm" data-index="${index}">
                ${pair.a}
            </div>
            <div class="gm-sentence-b-slot flex-1 bg-gray-200 p-3 rounded-lg min-h-[45px] border-2 border-dashed border-gray-400 flex items-center justify-center cursor-pointer text-gray-700" 
                 data-target-index="${index}" 
                 onclick="handleGameModeSlotClick(${index})">
                <span class="text-gray-400 text-sm">Click to place</span>
            </div>
        </div>
    `).join('');

    // Build dock UI
    const dock = document.getElementById('sentencematch-dock');
    dock.innerHTML = bSentences.map(item => `
        <button class="gm-sentence-b-tile bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                data-correct-index="${item.correctIndex}"
                onclick="selectGameModeBTile(this)">
            ${item.text}
        </button>
    `).join('');

    gameModeSelectedBTile = null;

    document.getElementById('sentencematch-actions').classList.remove('hidden');
    document.getElementById('sentencematch-result-action').classList.add('hidden');
    document.getElementById('sentenceMatchGame').classList.remove('hidden');
}

function selectGameModeBTile(tile) {
    document.querySelectorAll('.gm-sentence-b-tile').forEach(t => t.classList.remove('ring-4', 'ring-yellow-400'));
    gameModeSelectedBTile = tile;
    tile.classList.add('ring-4', 'ring-yellow-400');
}

function handleGameModeSlotClick(slotIndex) {
    const slot = document.querySelector(`.gm-sentence-b-slot[data-target-index="${slotIndex}"]`);

    const existingTile = slot.querySelector('.gm-sentence-b-tile');
    if (existingTile) {
        returnGameModeTileToDock(existingTile);
        slot.innerHTML = '<span class="text-gray-400 text-sm">Click to place</span>';
        return;
    }

    if (gameModeSelectedBTile) {
        slot.innerHTML = '';
        slot.appendChild(gameModeSelectedBTile);
        gameModeSelectedBTile.classList.remove('ring-4', 'ring-yellow-400');
        gameModeSelectedBTile = null;
    }
}

function returnGameModeTileToDock(tile) {
    const dock = document.getElementById('sentencematch-dock');
    tile.classList.remove('ring-4', 'ring-yellow-400');
    tile.style.backgroundColor = '';
    dock.appendChild(tile);
}

function checkSentenceMatch() {
    const slots = document.querySelectorAll('.gm-sentence-b-slot');
    let allCorrect = true;
    let anyPlaced = false;

    slots.forEach((slot) => {
        const tile = slot.querySelector('.gm-sentence-b-tile');

        if (tile) {
            anyPlaced = true;
            const correctIndex = parseInt(tile.dataset.correctIndex);
            const targetIndex = parseInt(slot.dataset.targetIndex);

            if (correctIndex === targetIndex) {
                tile.style.backgroundColor = '#10b981'; // green
            } else {
                tile.style.backgroundColor = '#ef4444'; // red
                allCorrect = false;
            }
        } else {
            allCorrect = false;
        }
    });

    if (!anyPlaced) return;

    if (allCorrect) {
        handleMinigameSuccess('sentencematch');
    } else {
        synthError();
        isFirstAttempt = false;
        // Reset after 2 seconds
        setTimeout(() => {
            const tiles = document.querySelectorAll('.gm-sentence-b-tile');
            tiles.forEach(tile => {
                returnGameModeTileToDock(tile);
            });
            const slots = document.querySelectorAll('.gm-sentence-b-slot');
            slots.forEach(slot => {
                slot.innerHTML = '<span class="text-gray-400 text-sm">Click to place</span>';
            });
        }, 2000);
    }
}


function handleMinigameSuccess(gameType) {
    let actionsId, resultId;
    if (gameType === 'spelling') { actionsId = 'spelling-actions'; resultId = 'spelling-result-action'; }
    else if (gameType === 'rec') { actionsId = 'rec-options'; resultId = 'rec-result-action'; }
    else if (gameType === 'sentencematch') { actionsId = 'sentencematch-actions'; resultId = 'sentencematch-result-action'; }
    else { actionsId = 'grammar-actions'; resultId = 'grammar-result-action'; }

    if (actionsId) document.getElementById(actionsId).classList.add('hidden');
    const resultDiv = document.getElementById(resultId);
    resultDiv.classList.remove('hidden');

    // New reward logic:
    // - Spelling and Grammar: always give reward if answered correctly (even on subsequent tries)
    // - Sight words (rec): only give reward on first try within time limit
    const shouldGiveReward = (gameType === 'spelling' || gameType === 'grammar' || gameType === 'sentencematch') || isFirstAttempt;

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

// --- KEYBOARD SUPPORT FOR MINIGAMES ---
window.addEventListener('keydown', (e) => {
    // Check if Study Mode is active - if so, let it handle the keyboard
    if (typeof STUDY_STATE !== 'undefined' && STUDY_STATE.active) return;

    // Check if Spelling Minigame is active
    const spellingGameEl = document.getElementById('spellingGame');
    if (spellingGameEl && !spellingGameEl.classList.contains('hidden')) {
        handleGameSpellingKeyDown(e.key);
    }
});

function handleGameSpellingKeyDown(key) {
    if (key === 'Enter') {
        checkSpelling();
    } else if (key === 'Backspace') {
        clearSpelling();
    } else if (key.length === 1 && key.match(/[a-z0-9]/i)) {
        const bubbles = document.querySelectorAll('.letter-bubble');
        for (let bubble of bubbles) {
            if (bubble.innerText.toLowerCase() === key.toLowerCase() && bubble.style.visibility !== 'hidden') {
                handleSpellingInput(bubble.innerText, bubble);
                break;
            }
        }
    }
}
