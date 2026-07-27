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

// --- MAIN SCENE ---
class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    create() {
        this.startTime = Date.now();
        this.frameTime = 0;
        this.gameState = 'PLAYING';
        this.gameTime = 0;
        this.accumulatedTime = 0;
        this.spawnTimer = 0;
        this.killCount = 0;
        this.nextSwarmTime = Phaser.Math.Between(30 * 60, 90 * 60);

        this.playerStats = {
            hp: 100, maxHp: 100,
            level: 1, xp: 0, nextLevelXp: 30,
            might: 1, speed: 1, cooldown: 1,
            weapons: []
        };
        this.knockbackVelocity = { x: 0, y: 0 };
        this.invulnTimer = 0;

        // --- Game-feel ("juice") state ---
        this.hitstopUntil = 0;          // world-freeze on meaty impacts
        this.lastHitstopAt = 0;         // cooldown so hitstop stays a rare accent
        this.recentKills = [];          // timestamps for multi-kill detection
        this.combo = 0;                 // kill combo counter
        this.comboExpire = 0;
        this.particlePool = [];         // shared pooled particles (perf)
        this.popPool = [];              // pooled damage-pop texts (perf)
        this.physics.world.timeScale = 1; // reset after death slow-mo restarts

        this.physics.world.setBounds(-4000, -4000, 8000, 8000);

        if (!this.textures.exists('grass')) {
            const gr = this.make.graphics({ x: 0, y: 0, add: false });
            gr.fillStyle(0x2d5016);
            gr.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 50; i++) {
                gr.fillStyle(0x3d6b1e, 0.5);
                gr.fillCircle(Phaser.Math.Between(0, 512), Phaser.Math.Between(0, 512), Phaser.Math.Between(2, 10));
            }
            gr.generateTexture('grass', 512, 512);
            gr.destroy();
        }

        this.bg = this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 'grass').setOrigin(0.5);
        this.bg.setScrollFactor(0);

        // Blob shadows layer: created right after bg so it renders under all
        // characters (creation order), redrawn each frame in updateJuice()
        this.shadowGfx = this.add.graphics();

        this.game.canvas.style.touchAction = 'none';
        document.body.style.touchAction = 'none';
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        document.body.style.overflow = 'hidden';

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
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.handleResize, this);
        });
        this.handleResize(this.scale.gameSize);

        this.input.addPointer(2);

        // Pre-generate emoji textures to prevent massive FPS drops
        const makeEmoji = (key, char, size, padTop = 0) => {
            if (!this.textures.exists(key)) {
                const t = this.add.text(0, 0, char, { fontSize: size + 'px', padding: { top: padTop } });
                const wh = Math.max(t.width, t.height, 1) * 1.2; // Add 20% margin
                const rt = this.make.renderTexture({ width: wh, height: wh, add: false });
                rt.draw(t, wh * 0.1, wh * 0.1); // Center slightly
                rt.saveTexture(key);
                t.destroy();
                rt.texture = null;
                rt.destroy();
            }
        };

        makeEmoji('player', '🧙‍♂️', 50, 10);
        makeEmoji('boss', '👹', 80, 20);
        makeEmoji('bat', '🦇', 25, 5);
        makeEmoji('bat_swarm', '🦇', 20, 0);
        makeEmoji('zombie', '🧟', 25, 5);
        makeEmoji('alien', '👾', 25, 5);
        makeEmoji('orb', '🔮', 24, 0); // Match cross size (24px)
        makeEmoji('axe', '🪓', 24, 0);
        makeEmoji('cross', '✝️', 24, 0);
        makeEmoji('knife', '🔪', 24, 0);
        makeEmoji('bottle', '🧪', 30, 0);
        makeEmoji('fire_large', '🔥', 40, 0);
        makeEmoji('fire_small', '🔥', 20, 0);
        makeEmoji('obs_🌲', '🌲', 100, 40);
        makeEmoji('obs_🌳', '🌳', 100, 40);
        makeEmoji('obs_🪨', '🪨', 50, 40);
        makeEmoji('obs_🌿', '🌿', 50, 40);
        makeEmoji('obs_🛖', '🛖', 150, 40);

        const allPowerUps = [...POWER_UPS,
        { id: 'heart', icon: '❤️' },
        { id: 'vortex', icon: '🌀' },
        { id: 'tornado', icon: '🌪️' }
        ];
        allPowerUps.forEach(p => makeEmoji('pu_' + p.id, p.icon || p.emoji, 40, 0));

        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.fireWakes = this.physics.add.group();
        this.gems = this.physics.add.group();
        this.powerUps = this.physics.add.group();
        this.tornados = this.physics.add.group();
        this.obstacles = this.physics.add.staticGroup();

        this.player = this.add.image(0, 0, 'player').setOrigin(0.5);
        this.player.setScale(1.5);
        this.physics.add.existing(this.player);
        this.player.body.setCircle(20 * 1.5);
        this.player.body.setOffset(
            (this.player.width - 20 * 1.5 * 2) / 2,
            (this.player.height - 20 * 1.5 * 2) / 2
        );
        this.player.body.setCollideWorldBounds(false);

        this.cameras.main.startFollow(this.player);
        this.spawnObstacles();

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

        this.joystick = { active: false, x: 0, y: 0, originX: 0, originY: 0, angle: 0, force: 0, pointerId: null };

        this.input.on('pointerdown', (pointer) => {
            if (!this.joystick.active && pointer.y > this.scale.height * 0.5) {
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

        // Shared particle layer (perf: one graphics for ALL burst particles)
        this.particleGfx = this.add.graphics().setDepth(50);

        // Kill combo counter (top-center, screen-space)
        this.comboText = this.add.text(this.scale.width / 2, 110, '', {
            fontSize: '30px', fontFamily: 'Fredoka', color: '#ffdd33',
            stroke: '#000000', strokeThickness: 5, fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);

        // Low-HP danger vignette (radial gradient texture, edges only)
        if (!this.textures.exists('vs_vignette')) {
            const cv = this.textures.createCanvas('vs_vignette', 256, 256);
            const cx = cv.getContext();
            const grd = cx.createRadialGradient(128, 128, 70, 128, 128, 128);
            grd.addColorStop(0, 'rgba(255,0,0,0)');
            grd.addColorStop(1, 'rgba(255,0,0,0.55)');
            cx.fillStyle = grd;
            cx.fillRect(0, 0, 256, 256);
            cv.refresh();
        }
        this.vignette = this.add.image(this.scale.width / 2, this.scale.height / 2, 'vs_vignette')
            .setDisplaySize(this.scale.width, this.scale.height)
            .setScrollFactor(0).setDepth(90).setAlpha(0);

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
        this.physics.add.overlap(this.fireWakes, this.enemies, (f, e) => {
            const now = this.time.now;
            if (!e.lastFireWakeTime || now - e.lastFireWakeTime > 200) {
                e.lastFireWakeTime = now;
                this.damageEnemy(e, f.dmg, f.knockback !== undefined ? f.knockback : 10);
            }
        }, null, this);
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
        this.physics.add.overlap(this.player, this.powerUps, this.handlePowerUpPickup, null, this);
        this.physics.add.overlap(this.tornados, this.enemies, (t, e) => this.damageEnemy(e, 999), null, this);

        this.applyReward({ id: 'whip', name: 'Magic Whip', type: 'weapon' });
        updateDOMHUD(this.playerStats, 0, 0);

        for (let i = 0; i < 50; i++) {
            this.spawnEnemy(Phaser.Math.Between(300, 1000));
        }
    }

    update(time, delta) {
        if (this.gameState === 'GAMEOVER') {
            this.player.body.setVelocity(0, 0);
            this.updateJuice(); // keep particles/shadows alive during death slow-mo
            return;
        }
        if (this.gameState !== 'PLAYING') return;

        // Hitstop: world briefly slowed to ~12% on meaty impacts (game feel)
        this.physics.world.timeScale = this.time.now < this.hitstopUntil ? 8 : 1;

        let dx = 0, dy = 0;
        const speed = 160 * this.playerStats.speed; // Doubled base speed (from 80 to 160)
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
        const wobble = Math.sin(this.gameTime * 0.25) * 0.08;
        if (dx !== 0 || dy !== 0) {
            const facingX = dx < 0 ? -1.5 : (dx > 0 ? 1.5 : (this.player.scaleX > 0 ? 1.5 : -1.5));
            this.player.setScale(facingX * (1 + wobble), 1.5 * (1 - wobble));
        } else {
            const idleWobble = Math.sin(this.gameTime * 0.08) * 0.04;
            const facingX = this.player.scaleX > 0 ? 1.5 : -1.5;
            this.player.setScale(facingX * (1 + idleWobble), 1.5 * (1 - idleWobble));
        }

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
        const difficulty = this.getDifficulty();
        // Spawn delay: starts at 15 frames, decreases with difficulty, floor at 2 frames
        const spawnDelay = Math.max(2, 15 / difficulty);
        if (this.spawnTimer > spawnDelay) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }

        this.updateWeapons();
        this.updateBullets();
        this.updateGems();
        this.updateJuice();
        this.gameTime++;
        this.accumulatedTime += delta;
        updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);

        this.obstacleTimer = (this.obstacleTimer || 0) + 1;
        if (this.obstacleTimer > 30 && this.obstacles.getChildren().length < 150) {
            this.spawnSingleObstacle();
            this.obstacleTimer = 0;
        }
        if (this.gameTime % 120 === 0) {
            this.cleanupDistantObstacles();
        }

        this.nextSwarmTime--;
        if (this.nextSwarmTime <= 0) {
            this.spawnBatSwarm();
            this.nextSwarmTime = Phaser.Math.Between(3000, 4200);
        }

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

                        if (this.gameTime % 2 === 0) {
                            const trail = this.add.image(fb.x, fb.y, 'fire_small').setOrigin(0.5).setAlpha(0.5);
                            this.time.delayedCall(250, () => trail.destroy());
                        }
                    });
                }
            });
        }
    }

    spawnEnemy(distance = null) {
        if (this.killCount >= 300) {
            this.spawnBoss();
            this.killCount = 0;
            return;
        }
        // Perf cap: don't exceed ~160 live enemies (WeChat/older iPads)
        if (this.enemies.getChildren().length >= 160) return;
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);

        let dist = distance;
        if (dist === null) {
            const cam = this.cameras.main;
            dist = Math.sqrt(Math.pow(cam.width, 2) + Math.pow(cam.height, 2)) / 2 + 100;
        }

        const ex = this.player.x + Math.cos(angle) * dist;
        const ey = this.player.y + Math.sin(angle) * dist;

        const type = Math.floor(this.gameTime / 1800) % 3;
        const isBat = type === 1;
        const textureKey = isBat ? 'bat' : (type === 2 ? 'zombie' : 'alien');

        const difficulty = this.getDifficulty();
        // HP: starts at 12 (one spirit wand hit). 
        // Growth is slowed so that at 10 mins (diff ~11.3) HP is ~12 * (1 + 10.3 * 0.13) = ~28 (two wand hits)
        const hp = 12 * (1 + (difficulty - 1) * 0.13);
        // Speed: starts at 16 (0.1x player base speed of 160), scales with difficulty
        const speed = 16 * difficulty + (Math.random() * 5);

        const enemy = this.add.image(ex, ey, textureKey).setOrigin(0.5);
        this.physics.add.existing(enemy);
        enemy.body.setCircle(10);
        enemy.body.setOffset(
            (enemy.width - 10 * 2) / 2,
            (enemy.height - 10 * 2) / 2
        );
        enemy.hp = hp; enemy.maxHp = hp; enemy.speed = speed; enemy.isBoss = false;
        enemy.isBat = isBat;
        enemy.stunTimer = 0;
        this.enemies.add(enemy);
    }

    spawnBoss() {
        const boss = this.add.image(this.player.x, this.player.y - 600, 'boss').setOrigin(0.5);
        this.physics.add.existing(boss);
        boss.body.setCircle(35);
        boss.body.setOffset(
            (boss.width - 35 * 2) / 2,
            (boss.height - 35 * 2) / 2
        );
        const difficulty = this.getDifficulty();
        // Boss: 25x regular enemy HP
        boss.hp = 12 * 25 * (1 + (difficulty - 1) * 0.13);
        boss.speed = 20 * difficulty;
        boss.isBoss = true;
        boss.stunTimer = 0;
        this.enemies.add(boss);

        // Boss Spawn visual juice
        this.cameras.main.shake(500, 0.015);
        this.cameras.main.flash(300, 255, 0, 0, 0.4);
        
        const warningText = this.add.text(this.scale.width / 2, this.scale.height / 3, '⚠️ BOSS INCOMING! ⚠️', {
            fontSize: '40px',
            fontFamily: 'Fredoka',
            color: '#ff0055',
            stroke: '#000000',
            strokeThickness: 6,
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        
        this.tweens.add({
            targets: warningText,
            scale: 1.4,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            ease: 'Sine.easeOut',
            onComplete: () => warningText.destroy()
        });
    }

    spawnEnemyCircle() {
        const count = 80;
        const radius = 600;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const ex = this.player.x + Math.cos(angle) * radius;
            const ey = this.player.y + Math.sin(angle) * radius;

            const difficulty = this.getDifficulty();
            const hp = 12 * (1 + (difficulty - 1) * 0.13);
            const speed = 16 * difficulty;

            const enemy = this.add.image(ex, ey, 'zombie').setOrigin(0.5);
            this.physics.add.existing(enemy);
            enemy.body.setCircle(10);
            enemy.hp = hp; enemy.maxHp = hp; enemy.speed = speed; enemy.isBoss = false;
            enemy.stunTimer = 0;
            this.enemies.add(enemy);
        }
    }

    spawnObstacles() {
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

        if (Math.random() < 0.15) {
            const pond = this.add.graphics();
            pond.fillStyle(0x355e3b, 0.8);
            pond.fillEllipse(x, y, 80, 50);

            const pondCollider = this.add.zone(x, y, 70, 40);
            this.physics.add.existing(pondCollider, true);
            this.obstacles.add(pondCollider);
            pondCollider.linkedGraphics = pond;
        } else {
            const type = Phaser.Math.RND.pick(obstacleTypes);
            const obs = this.add.image(x, y, 'obs_' + type.emoji).setOrigin(0.5);

            this.obstacles.add(obs);
            obs.body.setCircle(type.bodyRad);
            if (type.isTree) {
                obs.body.setOffset((obs.width - type.bodyRad * 2) / 2, obs.height - type.bodyRad * 2 - 10);
            } else {
                obs.body.setOffset((obs.width - type.bodyRad * 2) / 2, (obs.height - type.bodyRad * 2) / 2);
            }
        }
    }

    spawnBatSwarm() {
        const side = Phaser.Math.Between(0, 3);
        const difficulty = this.getDifficulty();
        const count = 20 + Math.floor(difficulty * 5);
        const playerSpeed = 160 * this.playerStats.speed;
        const swarmSpeed = playerSpeed * 3;
        // Bat swarm HP: half of regular enemy HP
        const hp = 6 * (1 + (difficulty - 1) * 0.13);

        for (let i = 0; i < count; i++) {
            this.time.delayedCall(i * 40, () => {
                const cam = this.cameras.main;
                const margin = 40;
                let startX, startY;

                if (side === 0) {
                    startX = cam.worldView.left - margin;
                    startY = cam.worldView.top + Math.random() * cam.worldView.height;
                } else if (side === 1) {
                    startX = cam.worldView.right + margin;
                    startY = cam.worldView.top + Math.random() * cam.worldView.height;
                } else if (side === 2) {
                    startX = cam.worldView.left + Math.random() * cam.worldView.width;
                    startY = cam.worldView.top - margin;
                } else {
                    startX = cam.worldView.left + Math.random() * cam.worldView.width;
                    startY = cam.worldView.bottom + margin;
                }

                const ox = (Math.random() - 0.5) * 60;
                const oy = (Math.random() - 0.5) * 60;
                const bat = this.add.image(startX + ox, startY + oy, 'bat_swarm').setOrigin(0.5);
                this.physics.add.existing(bat);
                bat.body.setCircle(8);
                bat.body.setOffset(
                    (bat.width - 8 * 2) / 2,
                    (bat.height - 8 * 2) / 2
                );
                bat.hp = hp; bat.maxHp = hp; bat.speed = swarmSpeed;
                bat.isSwarm = true;
                bat.isBat = true;
                this.enemies.add(bat);

                const angle = Phaser.Math.Angle.Between(bat.x, bat.y, this.player.x, this.player.y);
                const finalAngle = angle + (Math.random() - 0.5) * 0.15;

                bat.body.setVelocity(
                    Math.cos(finalAngle) * swarmSpeed,
                    Math.sin(finalAngle) * swarmSpeed
                );

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
        const secondsSinceStart = (Date.now() - this.startTime) / 1000;

        if (secondsSinceStart <= 300) {
            // First 5 minutes: gentle linear growth from 1.0 to 2.0
            return 1 + (secondsSinceStart / 300);
        }
        // After 5 minutes: exponential growth starting from 2.0
        // Doubles every 120 seconds — allows stats like damage and spawn rate to scale up fast
        return 2 * Math.pow(2, (secondsSinceStart - 300) / 120);
    }

    updateWeapons() {
        this.enemies.getChildren().forEach(e => {
            if (e.stunTimer > 0) {
                e.stunTimer--;
            } else if (!e.isSwarm) {
                // Calculate direct vector towards the player
                let tx = this.player.x - e.x;
                let ty = this.player.y - e.y;
                let tDist = Math.hypot(tx, ty);
                let vx = 0;
                let vy = 0;
                if (tDist > 0) {
                    vx = (tx / tDist) * e.speed;
                    vy = (ty / tDist) * e.speed;
                }

                // Add separation repulsion force from neighboring enemies
                let sepX = 0;
                let sepY = 0;
                let neighborsCount = 0;
                const separationRadius = 35; // optimal radius to match enemy graphic boundaries
                const children = this.enemies.getChildren();
                const count = children.length;

                for (let j = 0; j < count; j++) {
                    const other = children[j];
                    if (other === e || !other.active || other.isSwarm) continue;

                    // Quick bounding box check for high performance
                    const dx = e.x - other.x;
                    if (Math.abs(dx) < separationRadius) {
                        const dy = e.y - other.y;
                        if (Math.abs(dy) < separationRadius) {
                            const dist = Math.hypot(dx, dy);
                            if (dist > 0 && dist < separationRadius) {
                                // Stronger repulsion force the closer they are
                                const force = (separationRadius - dist) / separationRadius;
                                sepX += (dx / dist) * force;
                                sepY += (dy / dist) * force;
                                neighborsCount++;
                            }
                        }
                    }
                }

                if (neighborsCount > 0) {
                    sepX /= neighborsCount;
                    sepY /= neighborsCount;

                    // Blend player attraction and neighbor separation vectors
                    vx += sepX * e.speed * 1.5;
                    vy += sepY * e.speed * 1.5;

                    // Smooth speed control
                    const currentSpeed = Math.hypot(vx, vy);
                    const maxAllowedSpeed = e.speed * 1.3;
                    if (currentSpeed > maxAllowedSpeed) {
                        vx = (vx / currentSpeed) * maxAllowedSpeed;
                        vy = (vy / currentSpeed) * maxAllowedSpeed;
                    }
                }

                if (e.body) {
                    e.body.setVelocity(vx, vy);
                }
            }

            // Squash and stretch wobble based on whether they are moving
            if (e.active && e.body) {
                const isMoving = e.body.velocity.x !== 0 || e.body.velocity.y !== 0;
                const wobbleSpeed = e.isBoss ? 0.08 : 0.2;
                const wobbleAmp = e.isBoss ? 0.04 : 0.08;
                const seed = e.x + e.y; // unique phase offset per enemy
                const wobbleVal = Math.sin(this.gameTime * wobbleSpeed + seed) * wobbleAmp;
                
                const baseScale = e.isBoss ? 1.0 : (e.isSwarm ? 0.8 : 1.0);
                const facingX = e.body.velocity.x < 0 ? -baseScale : baseScale;
                
                if (isMoving) {
                    e.setScale(facingX * (1 + wobbleVal), baseScale * (1 - wobbleVal));
                } else {
                    e.setScale(facingX, baseScale);
                }
            }
        });

        this.playerStats.weapons.forEach(w => {
            w.timer++;
            if (w.type === 'orb') {
                if (!w.sprites) w.sprites = [];
                if (!w.hitCooldowns) w.hitCooldowns = new Map();
                if (w.sprites.length !== w.level) {
                    w.sprites.forEach(s => s.destroy()); w.sprites = [];
                    for (let i = 0; i < w.level; i++) {
                        const orb = this.add.image(0, 0, 'orb').setOrigin(0.5).setScale(1.5); // Match cross scale (1.5x)
                        this.physics.add.existing(orb); w.sprites.push(orb);
                    }
                }
                w.angle = (w.angle || 0) + 0.05;
                // Decrement all cooldowns and clean up destroyed enemies
                w.hitCooldowns.forEach((val, key) => {
                    if (!key.active) { w.hitCooldowns.delete(key); return; }
                    if (val > 0) w.hitCooldowns.set(key, val - 1);
                });
                w.sprites.forEach((s, i) => {
                    const theta = w.angle + (i * (Math.PI * 2 / w.level));
                    s.x = this.player.x + Math.cos(theta) * w.range;
                    s.y = this.player.y + Math.sin(theta) * w.range;
                    this.enemies.getChildren().forEach(e => {
                        if (Phaser.Math.Distance.Between(s.x, s.y, e.x, e.y) < 30 && (!w.hitCooldowns.has(e) || w.hitCooldowns.get(e) <= 0)) {
                            this.damageEnemy(e, w.dmg * this.playerStats.might, 200);
                            w.hitCooldowns.set(e, 20); // 20-frame cooldown per enemy
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
            const b = this.add.circle(this.player.x, this.player.y, 10.5, 0x00ffff); // 7 * 1.5
            this.bullets.add(b);
            this.physics.add.existing(b);
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearest.x, nearest.y);
            b.body.setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);
            b.dmg = 12 * (1 + w.level * 0.2) * this.playerStats.might; b.type = 'wand'; b.life = 60;
            b.setScale(1.5);
        }
    }

    fireWhip(w) {
        const sequence = ['front'];

        // Damage upgrades are at level 2, 5, 8, etc.
        const dmgUpgrades = Math.floor((w.level + 1) / 3);
        const damage = (15 + dmgUpgrades * 15) * this.playerStats.might;

        const range = 330; 
        const strikeDuration = 150;

        sequence.forEach((dir, index) => {
            this.time.delayedCall(index * strikeDuration, () => {
                this.performWhipStrike(dir, damage, range, strikeDuration, w.level);
            });
        });
    }

    performWhipStrike(direction, damage, range, duration, whipLevel = 1) {
        synthShoot('whip');
        const whip = this.add.graphics();
        const cpx = this.player.x;
        const cpy = this.player.y;

        const facing = this.player.scaleX > 0 ? 1 : -1;
        let strikeAngle = facing === 1 ? 0 : Math.PI;

        const hitEnemies = new Set();
        const progress = { value: 0 };
        
        let hasShakedCrack = false;
        let hasShakedHit = false;
        let finalPoints = [];

        this.tweens.add({
            targets: progress,
            value: 1,
            duration: duration,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                if (!whip.active) return;
                whip.clear();

                const currentCpx = this.player.x;
                const currentCpy = this.player.y;
                
                // Segment points of the curving, arching whip using a pure cubic Bezier curve
                const numSegments = 16;
                const points = [];

                const angle = strikeAngle;
                const dx = Math.cos(angle);
                const dy = Math.sin(angle);
                const px_perp = -Math.sin(angle);
                const py_perp = Math.cos(angle);

                const currentRange = range * (0.25 + 0.75 * progress.value);
                
                // The arch is deep in the middle of the swing and straightens at full extension
                const archOffset = 65 * (1.1 - progress.value) * facing;

                const p0 = { x: currentCpx, y: currentCpy };
                const p3 = { x: currentCpx + dx * currentRange, y: currentCpy + dy * currentRange };

                // Control points placed to form a beautiful, single-direction convex crescent arch
                const p1 = {
                    x: p0.x + dx * currentRange * 0.33 + px_perp * archOffset * 0.7,
                    y: p0.y + dy * currentRange * 0.33 + py_perp * archOffset * 0.7
                };
                const p2 = {
                    x: p0.x + dx * currentRange * 0.66 + px_perp * archOffset * 1.1,
                    y: p0.y + dy * currentRange * 0.66 + py_perp * archOffset * 1.1
                };

                for (let i = 0; i <= numSegments; i++) {
                    const t = i / numSegments;
                    
                    // Cubic Bezier interpolation (mathematically perfect, single-arc curve with no zig-zags)
                    const mt = 1 - t;
                    const mt2 = mt * mt;
                    const mt3 = mt2 * mt;
                    const t2 = t * t;
                    const t3 = t2 * t;

                    const sx = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
                    const sy = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
                    
                    points.push({ x: sx, y: sy, t: t });
                }
                finalPoints = points;

                const isFire = whipLevel >= 2;
                const widthUpgrades = Math.floor((whipLevel - 1) / 3);
                const hitTolerance = 45 + widthUpgrades * 18;

                // 0. Powerful shockwave underlay for visual wind displacement pressure
                const underlayWidth = 24 + widthUpgrades * 12;
                const underlayColor = 0xddffff;
                const underlayAlpha = 0.28;
                whip.lineStyle(underlayWidth, underlayColor, underlayAlpha * (1 - progress.value));
                whip.beginPath();
                whip.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    whip.lineTo(points[i].x, points[i].y);
                }
                whip.strokePath();

                // 1. Draw leather shadow outline
                const shadowWidth = 10 + widthUpgrades * 4;
                const shadowColor = 0x221104;
                whip.lineStyle(shadowWidth, shadowColor, 0.55 * (1 - progress.value * 0.3));
                whip.beginPath();
                whip.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    whip.lineTo(points[i].x, points[i].y);
                }
                whip.strokePath();

                // 2. Draw whip body
                const bodyWidth = 4 + widthUpgrades * 2;
                const bodyColor = 0x6e350d;
                whip.lineStyle(bodyWidth, bodyColor, 0.95 * (1 - progress.value * 0.3));
                whip.beginPath();
                whip.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    whip.lineTo(points[i].x, points[i].y);
                }
                whip.strokePath();

                // 3. Draw whip segment beads (gives classic 2D pixel-art segmented look)
                points.forEach(p => {
                    const baseSize = 8.5 + widthUpgrades * 3;
                    const size = baseSize * (1 - p.t * 0.5); // tapers from handle to tip
                    const alpha = (p.t > 0.8) ? 1.0 : 0.85;
                    const color = (p.t > 0.85) ? 0xffffff : (p.t > 0.55 ? 0xd4a373 : 0x8b5a2b);
                    whip.fillStyle(color, alpha * (1 - progress.value * 0.35));
                    whip.fillCircle(p.x, p.y, size);
                });

                // 4. Draw retro "CRACK!" starburst at the tip when fully extended
                if (progress.value > 0.75) {
                    const tip = points[points.length - 1];
                    
                    if (!hasShakedCrack) {
                        this.cameras.main.shake(70, 0.005);
                        hasShakedCrack = true;
                    }

                    // Starburst backdrop glow
                    const starColor = 0xffeb3b;
                    whip.fillStyle(starColor, 0.85 * (1 - progress.value));
                    whip.fillCircle(tip.x, tip.y, 16);
                    whip.fillStyle(0xffffff, 1.0 * (1 - progress.value));
                    whip.fillCircle(tip.x, tip.y, 10);

                    // Crosshair crack lines radiating outwards
                    whip.lineStyle(3, 0xffffff, 0.95 * (1 - progress.value));
                    const spikeLen = 18;
                    whip.lineBetween(tip.x - spikeLen, tip.y, tip.x + spikeLen, tip.y);
                    whip.lineBetween(tip.x, tip.y - spikeLen, tip.x, tip.y + spikeLen);
                    
                    // Slanted spike accents
                    whip.lineStyle(2, starColor, 0.75 * (1 - progress.value));
                    whip.lineBetween(tip.x - spikeLen * 0.7, tip.y - spikeLen * 0.7, tip.x + spikeLen * 0.7, tip.y + spikeLen * 0.7);
                    whip.lineBetween(tip.x - spikeLen * 0.7, tip.y + spikeLen * 0.7, tip.x + spikeLen * 0.7, tip.y - spikeLen * 0.7);

                    // Chance to spawn crack particles on tip snap
                    if (Math.random() < 0.3) {
                        this.spawnBurstParticles(tip.x, tip.y, starColor, 4, 3);
                    }
                }

                // 5. Accurate segment-by-segment proximity hitbox detection
                this.enemies.getChildren().forEach(e => {
                    if (hitEnemies.has(e) || !e.active) return;

                    // Iterate over segment points to check for localized collision
                    for (let i = 1; i < points.length; i++) {
                        const p = points[i];
                        const dist = Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y);
                        
                        // Generous hit tolerance to make it feel super satisfying and responsive
                        if (dist < hitTolerance) {
                            this.damageEnemy(e, damage, 300);
                            hitEnemies.add(e);

                            // Extra electric whip snap impact spark burst right at collision coordinate
                            const sparkColor = isFire ? 0xff5500 : 0xffeb3b;
                            this.spawnBurstParticles(p.x, p.y, sparkColor, 8, 3.5);
                            this.spawnBurstParticles(p.x, p.y, 0xffffff, 5, 2.0);

                            if (!hasShakedHit) {
                                this.cameras.main.shake(90, 0.006);
                                hasShakedHit = true;
                            }
                            break; // Stop checking segments for this enemy since they are hit
                        }
                    }
                });
            },
            onComplete: () => {
                const isFire = whipLevel >= 2;
                if (isFire) {
                    const widthUpgrades = Math.floor((whipLevel - 1) / 3);
                    const currentCpx = this.player.x;
                    const currentCpy = this.player.y;
                    
                    // Create a beautiful, sweeping asymmetric "comma" wave (curves down, hooks inward/backward at the head)
                    const numArcPoints = 32;
                    const arcPoints = [];
                    
                    // Starts slightly in front of the player, extends to the full whip range in the facing direction
                    const startX = currentCpx + 15 * facing;
                    const endX = currentCpx + range * facing;
                    
                    // In Phaser, Y is positive downwards. The whip always arches downwards (a smile curve under the player),
                    // so we make the fire path arch downward to perfectly trace and match the whip's sweep!
                    const verticalBulge = 45 + widthUpgrades * 10; 
                    
                    for (let i = 0; i <= numArcPoints; i++) {
                        const t = i / numArcPoints;
                        
                        // Sweeps forward to peak range at t ~ 0.91, then hooks slightly back/inward
                        const x_scale = (1.5 * t - 0.6 * t * t * t) / 0.914;
                        const ax = startX + (endX - startX) * x_scale;
                        
                        // Gentle smile curve initially, sweeping down into a sharp downward hook at the head
                        const y_scale = 0.35 * Math.sin(t * Math.PI) + 0.8 * Math.pow(t, 2.2);
                        const ay = currentCpy + verticalBulge * y_scale;
                        
                        arcPoints.push({ x: ax, y: ay, t: t });
                    }

                    // Helper function to draw a gorgeous, tapered crescent polygon in Phaser
                    const drawCrescent = (graphics, points, baseThickness, color, alpha) => {
                        if (points.length < 3) return;
                        graphics.fillStyle(color, alpha);
                        graphics.beginPath();
                        
                        const outerPoints = [];
                        const innerPoints = [];
                        
                        for (let i = 0; i < points.length; i++) {
                            const p = points[i];
                            const t = p.t;
                            
                            let dx, dy;
                            if (i === 0) {
                                dx = points[1].x - p.x;
                                dy = points[1].y - p.y;
                            } else if (i === points.length - 1) {
                                dx = p.x - points[i-1].x;
                                dy = p.y - points[i-1].y;
                            } else {
                                dx = points[i+1].x - points[i-1].x;
                                dy = points[i+1].y - points[i-1].y;
                            }
                            
                            const len = Math.sqrt(dx * dx + dy * dy);
                            const nx = len > 0 ? -dy / len : 0;
                            const ny = len > 0 ? dx / len : 0;
                            
                            // Beautiful asymmetrical comma-shaped thickness (thin tail near player, thick sweeping head at outer edge)
                            // Pushed power to 4.0 so the crescent has a long thin neck and massive fiery head before hooking back
                            const thickness = baseThickness * Math.sin(Math.pow(t, 4.0) * Math.PI);
                            
                            outerPoints.push({ x: p.x + nx * thickness, y: p.y + ny * thickness });
                            innerPoints.push({ x: p.x - nx * thickness, y: p.y - ny * thickness });
                        }
                        
                        // Draw outer boundary forward
                        graphics.moveTo(outerPoints[0].x, outerPoints[0].y);
                        for (let i = 1; i < outerPoints.length; i++) {
                            graphics.lineTo(outerPoints[i].x, outerPoints[i].y);
                        }
                        // Draw inner boundary backward to close the shape
                        for (let i = innerPoints.length - 1; i >= 0; i--) {
                            graphics.lineTo(innerPoints[i].x, innerPoints[i].y);
                        }
                        
                        graphics.closePath();
                        graphics.fillPath();
                    };

                    const burningPath = this.add.graphics();
                    const totalDuration = 1800;
                    
                    const flameColors = [0xff2200, 0xff5500, 0xff9c00, 0xffea00];
                    const sparkColors = [0xffea00, 0xffbb00, 0xffffff];
                    const smokeColors = [0x222222, 0x3d3d3d, 0x5a5a5a];

                    // Add lightweight, invisible physics triggers along this perfect arc to handle damage detection
                    // We instantiate them immediately so they can track the expanding shockwave front dynamically
                    const hitBodies = [];
                    const step = Math.max(1, Math.floor(numArcPoints / 7));
                    for (let i = 1; i < numArcPoints - 1; i += step) {
                        const p = arcPoints[i];
                        if (p) {
                            const triggerSize = 25 + widthUpgrades * 6; // generous size for explosive feel
                            const trigger = this.add.circle(p.x, p.y, triggerSize, 0x000000, 0); // fully invisible trigger
                            this.fireWakes.add(trigger);
                            this.physics.add.existing(trigger);
                            trigger.body.setCircle(triggerSize);
                            trigger.dmg = Math.ceil(damage * 0.10); // 10% of initial whip strike
                            trigger.knockback = 10; // small knockback effect so it affects enemies without launching them
                            hitBodies.push(trigger);
                        }
                    }

                    // --- INITIAL EXPLOSION / DENSE FIRE BURST ---
                    // Spawn highly visible, gorgeous burning particle effects along the entire arc to ignite it!
                    arcPoints.forEach((p, index) => {
                        // Skip the absolute tips a tiny bit for a nice tapered fire effect
                        if (index < 2 || index > numArcPoints - 2) return;
                        
                        // 1. Blazing rising flame circles
                        if (Math.random() < 0.85) {
                            const flameColor = flameColors[Phaser.Math.Between(0, flameColors.length - 1)];
                            const flameSize = Phaser.Math.Between(7, 13);
                            const flame = this.add.circle(p.x + Phaser.Math.Between(-4, 4), p.y + Phaser.Math.Between(-4, 4), flameSize, flameColor, 0.9);
                            
                            this.tweens.add({
                                targets: flame,
                                y: flame.y - Phaser.Math.Between(30, 60),
                                x: flame.x + Phaser.Math.Between(-12, 12),
                                scale: { from: 1.3, to: 0.1 },
                                alpha: { from: 0.9, to: 0 },
                                duration: Phaser.Math.Between(800, 1200),
                                ease: 'Quad.easeOut',
                                onComplete: () => flame.destroy()
                             });
                        }
                        
                        // 2. High-speed rising hot spark embers
                        if (Math.random() < 0.65) {
                            const sparkColor = sparkColors[Phaser.Math.Between(0, sparkColors.length - 1)];
                            const sparkSize = Phaser.Math.Between(2.2, 4.0);
                            const spark = this.add.circle(p.x, p.y, sparkSize, sparkColor, 1.0);
                            
                            this.tweens.add({
                                targets: spark,
                                x: spark.x + Phaser.Math.Between(-20, 20),
                                y: spark.y - Phaser.Math.Between(50, 85),
                                alpha: 0,
                                scale: 0.1,
                                duration: Phaser.Math.Between(700, 1200),
                                ease: 'Sine.easeOut',
                                onComplete: () => spark.destroy()
                            });
                        }

                        // 3. Puffy dark smoke clouds rising
                        if (Math.random() < 0.45) {
                            const smokeColor = smokeColors[Phaser.Math.Between(0, smokeColors.length - 1)];
                            const smokeSize = Phaser.Math.Between(9, 16);
                            const smoke = this.add.circle(p.x + Phaser.Math.Between(-8, 8), p.y + Phaser.Math.Between(-8, 8), smokeSize, smokeColor, 0.35);
                            
                            this.tweens.add({
                                targets: smoke,
                                y: smoke.y - Phaser.Math.Between(45, 75),
                                x: smoke.x + Phaser.Math.Between(-18, 18),
                                scale: { from: 1.0, to: 2.8 },
                                alpha: { from: 0.35, to: 0 },
                                duration: Phaser.Math.Between(1200, 1700),
                                ease: 'Cubic.easeOut',
                                onComplete: () => smoke.destroy()
                            });
                        }
                    });

                    // We run a dynamic simulation where the fire path expands and travels outwards like a real pressure wave!
                    this.tweens.add({
                        targets: { val: 1 },
                        val: 0,
                        duration: totalDuration,
                        ease: 'Quad.easeIn',
                        onUpdate: (tween, target) => {
                            if (!burningPath || !burningPath.active) return;
                            burningPath.clear();
                            
                            const alpha = target.val;
                            const t_elapsed = 1 - alpha;
                            const flicker = 0.80 + Math.random() * 0.20;

                            // Calculate dynamic expanding arc points
                            const rangeFactor = 1.0 + t_elapsed * 0.45; // grows 45% longer
                            const bulgeFactor = 1.0 + t_elapsed * 0.75; // grows 75% deeper
                            const shiftX = t_elapsed * 90 * facing; // travels forward
                            const shiftY = t_elapsed * 55; // travels downward in sweeping direction
                            
                            const d_startX = currentCpx + 15 * facing + shiftX;
                            const d_endX = currentCpx + range * facing * rangeFactor + shiftX;
                            const d_verticalBulge = verticalBulge * bulgeFactor;
                            
                            const dynamicPoints = [];
                            for (let i = 0; i <= numArcPoints; i++) {
                                const t = i / numArcPoints;
                                const x_scale = (1.5 * t - 0.6 * t * t * t) / 0.914;
                                const ax = d_startX + (d_endX - d_startX) * x_scale;
                                
                                const y_scale = 0.35 * Math.sin(t * Math.PI) + 0.8 * Math.pow(t, 2.2);
                                const ay = currentCpy + d_verticalBulge * y_scale + shiftY;
                                
                                dynamicPoints.push({ x: ax, y: ay, t: t });
                            }

                            // Update invisible physics trigger positions to follow the expanding shockwave front!
                            let triggerIdx = 0;
                            for (let i = 1; i < numArcPoints - 1; i += step) {
                                const p = dynamicPoints[i];
                                const trigger = hitBodies[triggerIdx];
                                if (trigger && trigger.active && p) {
                                    const currentSize = (25 + widthUpgrades * 6) * (1.0 + t_elapsed * 1.2); // expands up to 2.2x size
                                    trigger.setPosition(p.x, p.y);
                                    trigger.setRadius(currentSize);
                                    if (trigger.body) {
                                        trigger.body.setCircle(currentSize);
                                        trigger.body.updateFromGameObject();
                                    }
                                }
                                triggerIdx++;
                            }

                            // Shockwave inflates and broadens as it diffuses in the air
                            const thicknessScale = 1.0 + t_elapsed * 1.5;
                            
                            // 1. Draw a smoky, charred grass crack underlay (very thick)
                            drawCrescent(burningPath, dynamicPoints, (14.0 + widthUpgrades * 3.5) * thicknessScale, 0x110800, 0.75 * alpha);
                            
                            // 2. Draw a gorgeous outer crimson/red flame crescent
                            drawCrescent(burningPath, dynamicPoints, (9.0 + widthUpgrades * 2.5) * thicknessScale, 0xb30000, 0.9 * alpha * flicker);
                            
                            // 3. Draw a vibrant inner burning orange crescent
                            drawCrescent(burningPath, dynamicPoints, (5.0 + widthUpgrades * 1.5) * thicknessScale, 0xff5500, 1.0 * alpha * flicker);
                            
                            // 4. Draw a razor-thin golden-white core crescent
                            drawCrescent(burningPath, dynamicPoints, (1.6 + widthUpgrades * 0.5) * thicknessScale, 0xffea00, 1.0 * alpha * flicker);

                            // --- CONTINUOUS ACTIVE PARTICLE GENERATION ---
                            // Particles blast outward from the expanding shockwave front in the direction of the wave's expansion!
                            for (let k = 0; k < 2; k++) {
                                if (Math.random() < 0.45) {
                                    const p = dynamicPoints[Phaser.Math.Between(2, dynamicPoints.length - 3)];
                                    if (p) {
                                        const flameColor = flameColors[Phaser.Math.Between(0, flameColors.length - 1)];
                                        const flameSize = Phaser.Math.Between(5, 10) * alpha;
                                        const flame = this.add.circle(p.x, p.y, flameSize, flameColor, 0.8 * alpha);
                                        
                                        const blastX = (Phaser.Math.Between(40, 100) * facing) + Phaser.Math.Between(-15, 15);
                                        const blastY = Phaser.Math.Between(30, 90) + Phaser.Math.Between(-15, 15);
                                        
                                        this.tweens.add({
                                            targets: flame,
                                            x: flame.x + blastX * (1.2 - alpha),
                                            y: flame.y + blastY * (1.2 - alpha),
                                            scale: { from: 1.1, to: 0.1 },
                                            alpha: 0,
                                            duration: Phaser.Math.Between(500, 850),
                                            ease: 'Quad.easeOut',
                                            onComplete: () => flame.destroy()
                                        });
                                    }
                                }

                                if (Math.random() < 0.35) {
                                    const p = dynamicPoints[Phaser.Math.Between(2, dynamicPoints.length - 3)];
                                    if (p) {
                                        const sparkColor = sparkColors[Phaser.Math.Between(0, sparkColors.length - 1)];
                                        const sparkSize = Phaser.Math.Between(1.8, 3.2);
                                        const spark = this.add.circle(p.x, p.y, sparkSize, sparkColor, 0.95 * alpha);
                                        
                                        const blastX = (Phaser.Math.Between(50, 120) * facing) + Phaser.Math.Between(-20, 20);
                                        const blastY = Phaser.Math.Between(40, 110) + Phaser.Math.Between(-20, 20);
                                        
                                        this.tweens.add({
                                            targets: spark,
                                            x: spark.x + blastX * (1.2 - alpha),
                                            y: spark.y + blastY * (1.2 - alpha),
                                            alpha: 0,
                                            scale: 0.1,
                                            duration: Phaser.Math.Between(450, 800),
                                            ease: 'Sine.easeOut',
                                            onComplete: () => spark.destroy()
                                        });
                                    }
                                }
                            }
                        },
                        onComplete: () => {
                            if (burningPath) burningPath.destroy();
                        }
                    });

                    // Destroy triggers after totalDuration so they deal damage while the wave is active, expanding, and fading
                    this.time.delayedCall(totalDuration, () => {
                        hitBodies.forEach(b => {
                            if (b && b.active) b.destroy();
                        });
                    });
                }
                whip.destroy();
            }
        });
    }

    fireAxe(w) {
        synthShoot('axe');
        const count = w.level;
        for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) / 2) * 50;
            const axe = this.add.image(this.player.x, this.player.y, 'axe').setOrigin(0.5).setScale(0.5);
            this.bullets.add(axe);
            this.physics.add.existing(axe);
            axe.body.setCircle(15);
            axe.body.setVelocity(this.player.scaleX * 150 + spread, -400);
            axe.body.gravity.y = 800;
            axe.dmg = 12 * this.playerStats.might; axe.type = 'axe';

            // Squash & stretch heave throw
            this.tweens.add({
                targets: axe,
                scaleX: 1.8,
                scaleY: 1.3,
                duration: 200,
                ease: 'Back.easeOut',
                onComplete: () => {
                    if (axe.active) {
                        axe.setScale(1.5);
                    }
                }
            });
        }
    }

    fireCross(w) {
        synthShoot('cross');
        const cross = this.add.image(this.player.x, this.player.y, 'cross').setOrigin(0.5).setScale(0.5);
        this.bullets.add(cross);
        this.physics.add.existing(cross);
        cross.body.setCircle(15);
        cross.body.setVelocity(this.player.scaleX * 300, 0);
        cross.dmg = 6 * this.playerStats.might; cross.type = 'cross'; cross.returnTimer = 40;

        // Bouncy expanding pop-out
        this.tweens.add({
            targets: cross,
            scale: 1.5,
            duration: 250,
            ease: 'Bounce.easeOut'
        });
    }

    fireKnife(w) {
        synthShoot('knife');
        const count = w.level;
        const spreadAngle = 10 * (Math.PI / 180);

        for (let i = 0; i < count; i++) {
            const offset = (i - (count - 1) / 2) * spreadAngle;
            const knife = this.add.image(this.player.x, this.player.y, 'knife').setOrigin(0.5).setScale(0.4);
            this.bullets.add(knife);
            this.physics.add.existing(knife);
            knife.body.setCircle(12);

            const baseAngle = this.player.scaleX > 0 ? 0 : Math.PI;
            const finalAngle = baseAngle + offset;

            knife.rotation = finalAngle;
            const speed = 500;
            knife.body.setVelocity(Math.cos(finalAngle) * speed, Math.sin(finalAngle) * speed);
            knife.dmg = 8 * this.playerStats.might; knife.type = 'knife';

            // Elastic thrust scaling
            this.tweens.add({
                targets: knife,
                scaleX: 2.3,
                scaleY: 0.9,
                duration: 120,
                ease: 'Quad.easeOut',
                yoyo: true,
                onComplete: () => {
                    if (knife.active) {
                        knife.setScale(1.5);
                    }
                }
            });
        }
    }

    fireSantaWater(w) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(100, 300);
        const tx = this.player.x + Math.cos(angle) * dist;
        const ty = this.player.y + Math.sin(angle) * dist;

        const bottle = this.add.image(tx, ty - 500, 'bottle').setOrigin(0.5);

        this.tweens.add({
            targets: bottle,
            y: ty,
            rotation: 10,
            duration: 600,
            ease: 'Quad.easeIn',
            onComplete: () => {
                bottle.destroy();
                noise(0.1);

                const size = 90 * (1 + w.level * 0.2); // 60 * 1.5
                const dmg = ((8 + w.level * 3) / 3) * (1 + w.level * 0.2) * this.playerStats.might;
                const duration = 20000;

                const puddle = this.add.graphics();
                puddle.fillStyle(0x4488ff, 0.5);
                puddle.fillCircle(0, 0, size / 2);
                puddle.setPosition(tx, ty);

                this.tweens.add({ targets: puddle, alpha: 0.2, scaleX: 1.1, scaleY: 1.1, yoyo: true, repeat: -1, duration: 600 });

                // Splash droplets inside the boiling puddle
                const bubbleTimer = this.time.addEvent({
                    delay: 200,
                    loop: true,
                    callback: () => {
                        if (!puddle || !puddle.active) { 
                            bubbleTimer.remove(); 
                            return; 
                        }
                        const rad = (size / 2) * Math.random();
                        const ang = Math.random() * Math.PI * 2;
                        const bx = tx + Math.cos(ang) * rad;
                        const by = ty + Math.sin(ang) * rad;
                        const drop = this.add.circle(bx, by, Phaser.Math.Between(2, 5), 0xaaddff, 0.8);
                        this.tweens.add({
                            targets: drop,
                            y: by - Phaser.Math.Between(10, 20),
                            alpha: 0,
                            scale: 1.5,
                            duration: 400,
                            onComplete: () => drop.destroy()
                        });
                    }
                });

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
                    bubbleTimer.remove();
                    tick.remove();
                    this.tweens.add({
                        targets: puddle, alpha: 0, duration: 500,
                        onComplete: () => puddle.destroy()
                    });
                });
            }
        });
    }

    updateBullets() {
        this.bullets.getChildren().forEach(b => {
            if (b.type === 'cross') {
                b.returnTimer--;
                if (b.returnTimer === 0) b.body.setVelocity(-b.body.velocity.x, 0);
            }
            if (b.type === 'axe') b.rotation += 0.2;
            else b.rotation += 0.1;
            
            // Spawn trailing particles
            if (this.gameTime % 2 === 0) {
                let trailColor = 0xffffff;
                let trailSize = 3;
                if (b.type === 'wand') { trailColor = 0x00ffff; trailSize = 5; }
                else if (b.type === 'cross') { trailColor = 0xffeb3b; trailSize = 4; }
                else if (b.type === 'axe') { trailColor = 0x9e9e9e; trailSize = 5; }
                else if (b.type === 'knife') { trailColor = 0xe0e0e0; trailSize = 3; }
                
                const trail = this.add.circle(b.x, b.y, trailSize, trailColor, 0.6);
                this.tweens.add({
                    targets: trail,
                    alpha: 0,
                    scale: 0.1,
                    duration: 300,
                    onComplete: () => trail.destroy()
                });
            }

            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
            if (dist > 1000) b.destroy();
        });
    }

    handlePlayerHit(player, enemy) {
        if (this.invulnTimer > 0) return;

        const difficulty = this.getDifficulty();
        // Damage scales with difficulty: 1 at start, grows with difficulty, cap at 25
        const dmg = Math.min(25, Math.ceil(difficulty));

        this.playerStats.hp -= dmg;
        synthHurt();
        this.invulnTimer = 60;

        // Taking a hit breaks the kill combo
        this.combo = 0;
        this.comboText.setVisible(false);
        
        // Visual Hit Juice
        this.cameras.main.shake(150, 0.012);
        this.cameras.main.flash(100, 255, 0, 0, 0.2); // slight red flash
        this.spawnBurstParticles(this.player.x, this.player.y, 0xff0000, 10, 4);

        if (this.playerStats.hp <= 0) this.gameOver();
        updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
    }

    damageEnemy(enemy, amount, knockback = 0) {
        if (!enemy.active) return;
        enemy.hp -= amount;

        // Hit Juice: Scale Pop & Alpha Tween
        this.tweens.add({
            targets: enemy,
            alpha: 0.3,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 50,
            yoyo: true,
            onComplete: () => { if (enemy.active) enemy.setScale(1); }
        });

        if (knockback > 0 && enemy.body) {
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            enemy.body.setVelocity(Math.cos(angle) * knockback, Math.sin(angle) * knockback);
            enemy.stunTimer = 15;
        }

        // Damage hit spark particles
        this.spawnBurstParticles(enemy.x, enemy.y, 0xff5555, 4, 3);

        // Damage Text (Juice) with Crit indicators
        const isCrit = amount > 15 || enemy.isBoss;
        this.spawnDamagePop(enemy.x, enemy.y, Math.round(amount), isCrit);

        if (enemy.hp <= 0) {
            enemy.active = false;
            enemy.body.checkCollision.none = true;
            enemy.body.setVelocity(enemy.body.velocity.x * 1.5, enemy.body.velocity.y * 1.5);
            enemy.body.setDrag(1000);
            synthHit();

            // Kill juice: combo + hitstop on boss kills and multi-kills
            this.registerCombo();
            const nowK = this.time.now;
            this.recentKills.push(nowK);
            this.recentKills = this.recentKills.filter(t => nowK - t < 300);
            if (enemy.isBoss) this.hitstop(120, true);
            else if (this.recentKills.length >= 4) this.hitstop(50); // cooldown-gated inside

            // Death Ring Explosion Particles
            const explosionColor = enemy.isBoss ? 0xff00ff : 0x00ff88;
            const particleCount = enemy.isBoss ? 35 : 15;
            const particleSize = enemy.isBoss ? 6 : 4;
            this.spawnBurstParticles(enemy.x, enemy.y, explosionColor, particleCount, particleSize);

            // Death animation: fade out and float up
            this.tweens.add({
                targets: enemy,
                alpha: 0,
                y: enemy.y - 15,
                scaleX: 0.8,
                scaleY: 0.8,
                duration: 500,
                onComplete: () => {
                    if (enemy.isBoss) {
                        if (Math.random() < 0.3) this.spawnPowerUp(enemy.x, enemy.y);
                        for (let i = 0; i < 5; i++) {
                            const g = this.add.circle(enemy.x + (Math.random() - 0.5) * 40, enemy.y + (Math.random() - 0.5) * 40, 6, 0x00ff88);
                            this.physics.add.existing(g);
                            g.val = 15; g.type = 'xp'; this.gems.add(g);
                        }
                    } else {
                        const g = this.add.circle(enemy.x, enemy.y, 6, 0x00ff88);
                        this.physics.add.existing(g);
                        g.val = 5; g.type = 'xp'; this.gems.add(g);

                        if (Math.random() < 0.01) {
                            this.spawnPowerUp(enemy.x, enemy.y);
                        }
                    }
                    this.killCount++;
                    updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
                    enemy.destroy();
                }
            });
        }
    }

    spawnPowerUp(x, y) {
        const weapons = POWER_UPS.filter(p => p.type === 'weapon');
        const specials = [
            { id: 'heart', icon: '❤️', type: 'special' },
            { id: 'vortex', icon: '🌀', type: 'special' },
            { id: 'tornado', icon: '🌪️', type: 'special' }
        ];
        const choices = [...weapons, ...specials];
        const choice = Phaser.Math.RND.pick(choices);

        const icon = this.add.image(x, y, 'pu_' + choice.id).setOrigin(0.5);

        this.physics.add.existing(icon);
        icon.body.setSize(40, 40);
        icon.body.setOffset(-20, -20);
        icon.reward = choice;
        this.powerUps.add(icon);

        // Flashing animation
        this.tweens.add({
            targets: icon,
            alpha: 0.5,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 400,
            yoyo: true,
            repeat: -1
        });
    }

    handlePowerUpPickup(player, powerup) {
        if (powerup.collected) return;
        powerup.collected = true;

        const reward = powerup.reward;
        const iconStr = reward.icon || reward.emoji;

        synthGem(); // Powerup pickup sound

        // Visual orbit animation before activation
        const flyingIcon = this.add.image(powerup.x, powerup.y, 'pu_' + reward.id).setOrigin(0.5);
        powerup.destroy();

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
                synthGem();
            }
        });
    }

    spawnBurstParticles(x, y, color = 0xffffff, count = 10, size = 4) {
        // Pooled: pushes into a shared array drawn by ONE graphics object in
        // updateJuice(). Replaces the old per-burst Graphics + 16ms timer
        // approach that caused GC pressure on low-end devices.
        if (this.particlePool.length > 400) return; // hard cap under heavy load
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.FloatBetween(2, 6);
            this.particlePool.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Phaser.Math.FloatBetween(size * 0.5, size * 1.5),
                color
            });
        }
    }

    // Per-frame pass: particles, blob shadows, combo expiry, low-HP vignette
    updateJuice() {
        // --- Pooled particles (single clear + redraw) ---
        const g = this.particleGfx;
        g.clear();
        let write = 0;
        for (let i = 0; i < this.particlePool.length; i++) {
            const p = this.particlePool[i];
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.95; p.vy *= 0.95;
            p.size *= 0.95;
            if (p.size > 0.5) {
                g.fillStyle(p.color, 0.8);
                g.fillCircle(p.x, p.y, p.size);
                this.particlePool[write++] = p;
            }
        }
        this.particlePool.length = write;

        // --- Blob shadows (grounds characters in the world) ---
        const s = this.shadowGfx;
        s.clear();
        s.fillStyle(0x000000, 0.22);
        s.fillEllipse(this.player.x, this.player.y + 26, 34, 12);
        const list = this.enemies.getChildren();
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e.active) continue;
            if (e.isBoss) s.fillEllipse(e.x, e.y + 42, 60, 20);
            else s.fillEllipse(e.x, e.y + 14, 22, 8);
        }

        // --- Combo expiry ---
        if (this.combo > 0 && this.time.now > this.comboExpire) {
            this.combo = 0;
            this.tweens.add({ targets: this.comboText, alpha: 0, duration: 300, onComplete: () => this.comboText.setVisible(false) });
        }

        // --- Low-HP danger vignette (pulsing) ---
        const hpPct = this.playerStats.hp / this.playerStats.maxHp;
        if (hpPct < 0.3) {
            this.vignette.setPosition(this.scale.width / 2, this.scale.height / 2);
            this.vignette.setDisplaySize(this.scale.width, this.scale.height);
            this.vignette.setAlpha(0.45 + Math.sin(this.time.now / 180) * 0.25);
        } else if (this.vignette.alpha > 0) {
            this.vignette.setAlpha(0);
        }
    }

    // Freeze the world briefly on meaty impacts (see update()).
    // Cooldown-gated: continuous multi-kills during swarm clears must NOT
    // strobe the timescale (reads as jitter). force = boss kills only.
    hitstop(ms, force = false) {
        const now = this.time.now;
        if (!force && now - this.lastHitstopAt < 1200) return;
        this.lastHitstopAt = now;
        this.hitstopUntil = Math.max(this.hitstopUntil, now + ms);
    }

    // Kill-combo bookkeeping: chained kills within 1.5s build the counter
    registerCombo() {
        const now = this.time.now;
        if (now > this.comboExpire) this.combo = 0;
        this.combo++;
        this.comboExpire = now + 1500;
        if (this.combo >= 5) {
            this.comboText.setText('x' + this.combo + ' COMBO!');
            this.comboText.setVisible(true).setAlpha(1);
            const baseScale = 1 + Math.min(this.combo, 40) * 0.012;
            // Kill the previous pop tween first — stacking tweens on the same
            // target makes the text (and frame time) flicker at high combos
            this.tweens.killTweensOf(this.comboText);
            this.tweens.add({ targets: this.comboText, scale: { from: baseScale * 1.35, to: baseScale }, duration: 130, ease: 'Back.out' });
        }
    }

    spawnDamagePop(x, y, amount, isCrit = false) {
        const color = isCrit ? '#ffcc00' : (amount > 15 ? '#ff4444' : '#ffffff');
        const size = isCrit ? '26px' : (amount > 15 ? '22px' : '16px');
        const driftX = (Math.random() - 0.5) * 60;

        // Pooled text objects (perf: avoids constant create/destroy churn)
        let txt = this.popPool.pop();
        if (!txt) {
            txt = this.add.text(0, 0, '', {
                fontSize: '16px', fontFamily: 'Fredoka', color: '#ffffff',
                stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(60);
        }
        txt.setText(String(amount));
        txt.setStyle({ fontSize: size, color: color, strokeThickness: isCrit ? 4 : 3 });
        txt.setPosition(x, y).setAlpha(1).setScale(1).setVisible(true);

        this.tweens.add({
            targets: txt,
            x: x + driftX,
            y: y - Phaser.Math.Between(60, 90),
            alpha: 0,
            scale: isCrit ? 1.8 : 1.4,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                txt.setVisible(false);
                if (this.popPool.length < 40) this.popPool.push(txt);
                else txt.destroy();
            }
        });
    }

    spawnTornado() {
        const tornado = this.add.circle(this.player.x, this.player.y, 5, 0xffffff, 0);
        this.physics.add.existing(tornado);
        this.tornados.add(tornado);

        tornado.theta = 0;
        tornado.spawnX = this.player.x;
        tornado.spawnY = this.player.y;
        tornado.a = 50;
        tornado.b = 8;
        tornado.fireballs = [];

        for (let i = 0; i < 12; i++) {
            const fb = this.add.image(this.player.x, this.player.y, 'fire_large').setOrigin(0.5);
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
                this.spawnBurstParticles(this.player.x, this.player.y, 0x00ffff, 5, 2.5);
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
            
            // Level up juice!
            this.spawnBurstParticles(this.player.x, this.player.y, 0xffff00, 25, 5);
            this.cameras.main.flash(300, 255, 255, 255, 0.3);
            
            const lvlText = this.add.text(this.player.x, this.player.y - 60, '⭐ LEVEL UP! ⭐', {
                fontSize: '28px',
                fontFamily: 'Fredoka',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 5,
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            this.tweens.add({
                targets: lvlText,
                y: this.player.y - 120,
                alpha: 0,
                scale: 1.5,
                duration: 1200,
                onComplete: () => lvlText.destroy()
            });

            this.triggerLevelUp();

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
        if (this.gameState === 'GAMEOVER') return; // guard against re-entry
        this.gameState = 'GAMEOVER';

        // Death slow-mo: world crawls while the death animation plays
        this.physics.world.timeScale = 4;
        const camZoom = this.cameras.main.zoom;
        this.cameras.main.zoomTo(Math.min(camZoom * 1.4, 1.6), 1400, 'Sine.easeOut');

        this.player.body.setVelocity(0, 0);
        this.player.body.setImmovable(true);

        this.enemies.getChildren().forEach(e => {
            if (e.body) e.body.setVelocity(0, 0);
        });

        synthDeath();

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
                this.player.setTint(Phaser.Display.Color.GetColor(255, value, value));
            },
            onComplete: () => {
                this.cameras.main.flash(500, 255, 255, 255);

                this.time.delayedCall(500, () => {
                    this.scene.pause();

                    if (minigameCountdownInterval) {
                        clearInterval(minigameCountdownInterval);
                        minigameCountdownInterval = null;
                    }

                    const totalPlayedTimeSec = Math.floor((this.accumulatedTime + totalMinigameTimeMs) / 1000);
                    const survivalTimeSec = Math.floor(this.accumulatedTime / 1000);
                    const minigameTimeSec = Math.floor(totalMinigameTimeMs / 1000);
                    const scoreSec = Math.max(0, survivalTimeSec);

                    const formatTime = (seconds) => {
                        const m = Math.floor(seconds / 60);
                        const s = seconds % 60;
                        return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
                    };

                    document.getElementById('finalLevel').innerText = this.playerStats.level;
                    document.getElementById('finalSurvivalTime').innerText = formatTime(totalPlayedTimeSec);
                    document.getElementById('finalMinigameTime').innerText = '-' + formatTime(minigameTimeSec);
                    document.getElementById('finalScore').innerText = formatTime(scoreSec);

                    const studentName = typeof selectedStudent !== 'undefined' && selectedStudent ? selectedStudent : '';
                    const classInfo = selectedDay && selectedTime ? `${selectedDay} ${selectedTime}` : 'N/A';
                    const displayText = studentName ? `${studentName} (${classInfo})` : classInfo;
                    document.getElementById('finalContentDisplay').innerText = displayText;

                    const isSessionIgnored = totalPlayedTimeSec < 120;
                    if (typeof srGameResults !== 'undefined') {
                        finalizeSession(srGameResults, !isSessionIgnored);
                    }
                    queueSessionEvent('vampireSurvivors', {
                        level: this.playerStats.level,
                        survivalTimeSec: survivalTimeSec,
                        minigameTimeSec: minigameTimeSec,
                        scoreSec: scoreSec,
                        kills: this.killCount,
                        ignored: isSessionIgnored
                    });
                    flushAnalyticsOnGameOver();

                    const targetText = typeof getActiveTargetText === 'function' ? getActiveTargetText() : null;
                    const banner = document.getElementById('vs-target-banner');
                    if (targetText && banner) {
                        banner.innerText = targetText;
                        banner.classList.remove('hidden');
                    } else if (banner) {
                        banner.classList.add('hidden');
                    }

                    const warning = document.getElementById('vsTargetWarning');
                    if (warning) {
                        if (isSessionIgnored) {
                            warning.innerText = "用时不到2分钟且挑战失败，本次练习不计入每周目标。";
                            warning.classList.remove('hidden');
                        } else {
                            warning.classList.add('hidden');
                        }
                    }

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
                if (reward.id === 'whip') {
                    const speedUpgrades = Math.floor(existing.level / 3);
                    existing.cooldown = Math.max(40, 120 - speedUpgrades * 25);
                }
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
        let zoom = width / 800;
        zoom = Phaser.Math.Clamp(zoom, 0.4, 1.0);
        this.cameras.main.setZoom(zoom);
        if (this.bg) {
            this.bg.setPosition(width / 2, this.scale.height / 2);
            this.bg.setSize(width / zoom + 100, this.scale.height / zoom + 100);
        }
    }
}

registerScene(MainScene);

// --- VS WRAPPER FUNCTIONS ---
function showGameIntro() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameSelectionOverlay').classList.add('hidden');
    document.getElementById('gameIntroOverlay').classList.remove('hidden');
}

function startGameFromIntro() {
    document.getElementById('gameIntroOverlay').classList.add('hidden');
    triggerVampireSurvivors();
}

function triggerVampireSurvivors() {
    activeGameMode = 'VS';
    
    // Reset SR tracking for this game session
    if (typeof srGameResults !== 'undefined') srGameResults = [];
    if (typeof srInSessionFailures !== 'undefined') srInSessionFailures = new Set();
    if (typeof srInSessionSuccesses !== 'undefined') srInSessionSuccesses = new Set();
    if (typeof srLastServedKey !== 'undefined') srLastServedKey = { vocab: null, sentences: null };
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameIntroOverlay').classList.add('hidden');
    document.getElementById('gameSelectionOverlay').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    // Show VS exit button
    const vsExitBtn = document.getElementById('vsExitBtn');
    if (vsExitBtn) vsExitBtn.classList.remove('hidden');
    initAudio();
    totalMinigameTimeMs = 0;
    // Ensure canvas is visible (may have been hidden by exitVampireSurvivors)
    if (game && game.canvas) {
        game.canvas.style.display = '';
    }
    if (!game) {
        config.parent = document.body;
        game = new Phaser.Game(config);
        game.events.once('ready', () => {
            setTimeout(() => {
                if (game && game.scale) {
                    game.scale.parent = document.body;
                    game.scale.parentIsWindow = true;
                    game.scale.resize(window.innerWidth, window.innerHeight);
                    game.scale.refresh();
                }
            }, 50);
        });
    } else {
        // Cancel any pending stop from endUno() — prevents stale stop() killing the new scene
        if (typeof window.unoStopTimeout !== 'undefined' && window.unoStopTimeout) {
            clearTimeout(window.unoStopTimeout);
            window.unoStopTimeout = null;
        }

        // Stop all active scenes immediately
        if (game.scene.isActive('UnoScene')) game.scene.stop('UnoScene');
        if (game.scene.isActive('MainScene')) game.scene.stop('MainScene');

        // Move canvas to body
        if (game.scale && typeof game.scale.setParent === 'function') {
            game.scale.setParent(document.body);
        } else {
            document.body.appendChild(game.canvas);
        }

        // Defer BOTH scale.refresh() and scene start into the same setTimeout so that
        // the browser has time to update layout/dimensions before create() reads them.
        setTimeout(() => {
            if (game && game.scale) {
                game.scale.parent = document.body;
                game.scale.parentIsWindow = true;
                game.scale.resize(window.innerWidth, window.innerHeight);
                game.scale.refresh();
            }
            // Always do a fresh start so create() runs and entities spawn correctly
            game.scene.start('MainScene');
        }, 100);
    }
}

function showPowerUpSelection(context) {
    document.getElementById('levelUpMenu').classList.remove('hidden');
    rewardContext = context;
    const container = document.getElementById('powerup-cards-container');
    container.innerHTML = '';

    const scene = game.scene.getScene('MainScene');
    const existingWeapons = scene ? scene.playerStats.weapons : [];

    const shuffled = [...POWER_UPS].sort(() => 0.5 - Math.random()).slice(0, 3);
    const allGameTypes = ['spelling', 'wordrec', 'scramble', 'sentencematch'];
    const pairings = shuffled.map(reward => {
        const randomGameType = allGameTypes[Math.floor(Math.random() * allGameTypes.length)];
        return { reward, gameType: randomGameType };
    });

    pairings.forEach(({ reward, gameType }) => {
        let description = reward.desc;
        if (reward.id === 'whip') {
            const weapon = existingWeapons.find(w => w.type === 'whip');
            if (weapon) {
                const nextLevel = weapon.level + 1;
                if (nextLevel === 2) {
                    description = "Flaming Wake (+Damage & Fire Arc)";
                } else if (nextLevel === 3) {
                    description = "Whip Speed (Attack More Often)";
                } else if (nextLevel === 4) {
                    description = "Fiery Expansion (+Whip Width & Flame Aura)";
                } else {
                    const cycle = (nextLevel - 2) % 3;
                    if (cycle === 0) description = "Searing Heat (+Damage)";
                    else if (cycle === 1) description = "Blazing Speed (Attack More Often)";
                    else description = "Wildfire Scope (+Whip Width & Flame Aura)";
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

// --- VS EXIT & REPLAY FUNCTIONS ---
function exitVampireSurvivors() {
    // Stop the VS game and return to game selection
    if (minigameCountdownInterval) {
        clearInterval(minigameCountdownInterval);
        minigameCountdownInterval = null;
    }
    if (game && game.scene && game.scene.isActive('MainScene')) {
        game.scene.stop('MainScene');
    }
    // Hide game over screen and HUD if visible
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('levelUpMenu').classList.add('hidden');
    // Hide any active mini-game overlays
    ['spellingGame', 'wordRecGame', 'sentenceMatchGame'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    // Hide the Phaser canvas (move off-screen or hide)
    if (game && game.canvas) {
        game.canvas.style.display = 'none';
    }
    // Hide VS exit button
    const vsExitBtn = document.getElementById('vsExitBtn');
    if (vsExitBtn) vsExitBtn.classList.add('hidden');
    activeGameMode = null;
    document.getElementById('gameSelectionOverlay').classList.remove('hidden');
}

function replayVampireSurvivors() {
    // Hide game over screen, restart the game
    document.getElementById('gameOverScreen').classList.add('hidden');
    triggerVampireSurvivors();
}
