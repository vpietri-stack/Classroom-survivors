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
        this.nextSwarmTime = Phaser.Math.Between(30 * 60, 90 * 60);

        this.playerStats = {
            hp: 100, maxHp: 100,
            level: 1, xp: 0, nextLevelXp: 30,
            might: 1, speed: 1, cooldown: 1,
            weapons: []
        };
        this.knockbackVelocity = { x: 0, y: 0 };
        this.invulnTimer = 0;

        this.physics.world.setBounds(-4000, -4000, 8000, 8000);

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
        this.handleResize(this.scale.gameSize);

        this.input.addPointer(2);

        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.gems = this.physics.add.group();
        this.lootboxes = this.physics.add.group();
        this.tornados = this.physics.add.group();
        this.obstacles = this.physics.add.staticGroup();

        this.player = this.add.text(0, 0, '🧙‍♂️', { fontSize: '50px', padding: { top: 10 } }).setOrigin(0.5);
        this.physics.add.existing(this.player);
        this.player.body.setCircle(20);
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
                            const trail = this.add.text(fb.x, fb.y, '🔥', { fontSize: '20px' }).setOrigin(0.5).setAlpha(0.5);
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
        let sprite = isBat ? '🦇' : (type === 2 ? '🧟' : '👾');

        const difficulty = this.getDifficulty();
        const hp = 2 + (difficulty * 1);
        const speed = (17 + (Math.random() * 10) + (difficulty * 0.7));

        const enemy = this.add.text(ex, ey, sprite, { fontSize: '25px', padding: { top: 5 } }).setOrigin(0.5);
        this.physics.add.existing(enemy);
        enemy.body.setCircle(10);
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
        const count = 80;
        const radius = 600;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const ex = this.player.x + Math.cos(angle) * radius;
            const ey = this.player.y + Math.sin(angle) * radius;

            const difficulty = this.getDifficulty();
            const sprite = '🧟';
            const hp = 2 + (difficulty * 1);
            const speed = 27 + (difficulty * 0.3);

            const enemy = this.add.text(ex, ey, sprite, { fontSize: '25px', padding: { top: 5 } }).setOrigin(0.5);
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
            const isCrate = Math.random() < 0.2;
            const type = isCrate ? { emoji: '📦', fontSize: '40px', bodyRad: 20, isCrate: true } : Phaser.Math.RND.pick(obstacleTypes);
            const obs = this.add.text(x, y, type.emoji, { fontSize: type.fontSize, padding: { top: 40 } }).setOrigin(0.5);

            if (isCrate) {
                this.physics.add.existing(obs, false);
                obs.body.setImmovable(true);
                obs.hp = 10;
                obs.isCrate = true;
                this.physics.add.collider(this.bullets, obs, (b, crate) => {
                    this.damageCrate(crate, b.dmg || 10);
                    if (b.type !== 'axe' && b.type !== 'cross') b.destroy();
                });
            } else {
                this.obstacles.add(obs);
            }

            obs.body.setCircle(type.bodyRad);
            if (type.isTree) {
                obs.body.setOffset((obs.width - type.bodyRad * 2) / 2, obs.height - type.bodyRad * 2 - 10);
            } else {
                obs.body.setOffset((obs.width - type.bodyRad * 2) / 2, (obs.height - type.bodyRad * 2) / 2);
            }
        }
    }

    damageCrate(crate, dmg) {
        crate.hp -= dmg;
        crate.setTint(0xcccccc);
        this.time.delayedCall(100, () => { if (crate.active) crate.clearTint(); });
        synthHit();
        if (crate.hp <= 0) {
            if (Math.random() < 0.3) this.spawnLootbox(crate.x, crate.y);
            else if (Math.random() < 0.6) {
                const g = this.add.text(crate.x, crate.y, '🟢', { fontSize: '15px' }).setOrigin(0.5);
                this.physics.add.existing(g);
                g.val = 5; g.type = 'xp'; this.gems.add(g);
            }
            crate.destroy();
        }
    }

    spawnBatSwarm() {
        const side = Phaser.Math.Between(0, 3);
        const count = 30 + Math.floor(this.getDifficulty() * 2);
        const playerSpeed = 80 * this.playerStats.speed;
        const swarmSpeed = playerSpeed * 4.5;
        const difficulty = this.getDifficulty();
        const hp = (2 + (difficulty * 1)) * 0.5;

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
                const bat = this.add.text(startX + ox, startY + oy, '🦇', { fontSize: '20px' }).setOrigin(0.5);
                this.physics.add.existing(bat);
                bat.body.setCircle(8);
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
        const playTimeMs = this.accumulatedTime + totalMinigameTimeMs;
        const seconds = playTimeMs / 1000;
        let difficulty = seconds / 30;

        if (seconds > 300) {
            difficulty += Math.pow((seconds - 300) / 10, 1.2);
        }

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
        const sequence = ['front'];
        if (w.level >= 4) sequence.push('up');
        if (w.level >= 3) sequence.push('back');
        if (w.level >= 5) sequence.push('down');

        let dmgBonus = 0;
        let rangeBonus = 0;

        if (w.level >= 2) dmgBonus += 5;

        if (w.level >= 6) {
            const post5 = w.level - 5;
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

        let angleOffset = 0;
        if (direction === 'back') angleOffset = Math.PI;
        if (direction === 'up') angleOffset = -Math.PI / 2;
        if (direction === 'down') angleOffset = Math.PI / 2;

        const facing = this.player.scaleX;
        const baseAngle = facing === 1 ? 0 : Math.PI;
        const finalAngle = baseAngle + angleOffset;

        [
            { color: 0x0000cc, thick: 40, alpha: 0.4, scale: 1.1 },
            { color: 0x00ffff, thick: 15, alpha: 0.8, scale: 1.0 },
            { color: 0xffffff, thick: 5, alpha: 1.0, scale: 0.9 }
        ].forEach(l => {
            whip.lineStyle(l.thick, l.color, l.alpha);

            const path = new Phaser.Curves.Path(px, py);

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

        whip.fillStyle(0xaaddff, 0.8);
        for (let i = 0; i < 8; i++) {
            const dist = Math.random() * range * 0.8;
            const pAngle = finalAngle + (Math.random() - 0.5) * 0.3;
            const pxr = px + Math.cos(pAngle) * dist;
            const pyr = py + Math.sin(pAngle) * dist;
            whip.fillCircle(pxr, pyr, Phaser.Math.Between(2, 4));
        }

        this.enemies.getChildren().forEach(e => {
            const dx = e.x - px;
            const dy = e.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= range) {
                const angleToEnemy = Math.atan2(dy, dx);
                let diff = Math.abs(Phaser.Math.Angle.Normalize(angleToEnemy - finalAngle));
                if (diff < 0.6) {
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
        const spreadAngle = 10 * (Math.PI / 180);

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

                const size = 60 * (1 + w.level * 0.2);
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

    updateBullets() {
        this.bullets.getChildren().forEach(b => {
            if (b.type === 'cross') {
                b.returnTimer--;
                if (b.returnTimer === 0) b.body.setVelocity(-b.body.velocity.x, 0);
            }
            if (b.type === 'axe') b.rotation += 0.2;
            else b.rotation += 0.1;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
            if (dist > 1000) b.destroy();
        });
    }

    handlePlayerHit(player, enemy) {
        if (this.invulnTimer > 0) return;
        const dmg = enemy.isBoss ? 20 : 10;
        this.playerStats.hp -= dmg;
        synthHurt();
        this.invulnTimer = 60;
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
        this.knockbackVelocity.x = Math.cos(angle) * 300;
        this.knockbackVelocity.y = Math.sin(angle) * 300;
        if (this.playerStats.hp <= 0) this.gameOver();
        updateDOMHUD(this.playerStats, Math.floor(this.accumulatedTime / 1000), this.killCount);
    }

    damageEnemy(enemy, amount, knockback = 0) {
        if (!enemy.active) return;
        enemy.hp -= amount;
        synthHit();

        // Damage Text (Juice)
        this.spawnDamagePop(enemy.x, enemy.y, Math.round(amount));

        enemy.setTint(0xff0000);
        enemy.alpha = 0.8;
        this.time.delayedCall(100, () => {
            if (enemy.active) {
                enemy.clearTint();
                enemy.alpha = 1.0;
            }
        });

        if (knockback > 0 && enemy.body) {
            const kbVal = knockback * 1.5; // Buffed knockback push
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            enemy.body.setVelocity(Math.cos(angle) * kbVal, Math.sin(angle) * kbVal);
            enemy.stunTimer = 25; // Buffed stun time
        }

        if (enemy.hp <= 0) {
            enemy.active = false;
            if (enemy.body) enemy.body.enable = false;

            if (enemy.isBoss) {
                this.spawnLootbox(enemy.x, enemy.y);
                this.killCount += 10;
            } else {
                if (Math.random() < 0.05) {
                    const g = this.add.text(enemy.x, enemy.y, '💎', { fontSize: '20px' }).setOrigin(0.5);
                    this.physics.add.existing(g);
                    g.val = 15; g.type = 'xp'; this.gems.add(g);
                } else {
                    const g = this.add.text(enemy.x, enemy.y, '🟢', { fontSize: '15px' }).setOrigin(0.5);
                    this.physics.add.existing(g);
                    g.val = 5; g.type = 'xp'; this.gems.add(g);
                }
                this.killCount++;
            }

            // Death animation: fade out and float up
            this.tweens.add({
                targets: enemy,
                alpha: 0,
                y: enemy.y - 40,
                scale: 0.5,
                duration: 400,
                ease: 'Cubic.easeOut',
                onComplete: () => enemy.destroy()
            });
        }
    }

    spawnDamagePop(x, y, amount) {
        const txt = this.add.text(x, y + (Math.random() - 0.5) * 20, amount, {
            fontSize: '18px',
            fontFamily: 'Fredoka',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: txt,
            y: y - 50,
            alpha: 0,
            scale: 1.5,
            duration: 600,
            ease: 'Back.easeOut',
            onComplete: () => txt.destroy()
        });
    }

    spawnLootbox(x, y) {
        const box = this.add.text(x, y, '🎁', { fontSize: '35px' }).setOrigin(0.5);
        this.physics.add.existing(box);
        this.lootboxes.add(box);
        const rewards = [
            { id: 'heart', name: 'Health', icon: '❤️', type: 'heal' },
            { id: 'vortex', name: 'Vacuum', icon: '🧲', type: 'bonus' },
            { id: 'tornado', name: 'Fire Storm', icon: '🔥', type: 'bonus' }
        ];
        const weaponPool = POWER_UPS.filter(p => p.type === 'weapon');
        rewards.push(weaponPool[Math.floor(Math.random() * weaponPool.length)]);
        box.reward = rewards[Math.floor(Math.random() * rewards.length)];
    }

    handleLootboxPickup(player, box) {
        if (box.collected) return;
        box.collected = true;

        const reward = box.reward;
        const iconStr = reward.icon || reward.emoji;

        synthLootbox();

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
        let zoom = width / 800;
        zoom = Phaser.Math.Clamp(zoom, 0.4, 1.0);
        this.cameras.main.setZoom(zoom);
        if (this.bg) {
            this.bg.setSize(width / zoom + 100, this.scale.height / zoom + 100);
        }
    }
}

config.scene = MainScene;

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
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameIntroOverlay').classList.add('hidden');
    document.getElementById('gameSelectionOverlay').classList.add('hidden');
    initAudio();
    if (!game) game = new Phaser.Game(config);
    else { game.scene.resume('MainScene'); }
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
