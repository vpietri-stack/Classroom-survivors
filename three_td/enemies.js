// ============================================================
// SCHOOL DEFENSE 3D — enemies.js
// Runner / Tank / Ranged / Boss + wave director.
// Enemies A*-path to the school, smash structures in their way
// (tanks prefer smashing), ranged units stop and shoot.
// ============================================================
import * as THREE from 'three';
import { makeEnemy, makeMagicBolt } from './models.js';
import { terrainHeight, worldToCell, SCHOOL_R, GATES } from './world.js';

export const ENEMY_STATS = {
    runner: { hp: 25, speed: 5.5, coins: 3, schoolDmg: 1, schoolRate: 2.2, playerDmg: 6, structDmg: 6, attackRate: 1.0, radius: 0.55, wallMult: 1.0 },
    ranged: { hp: 40, speed: 3.5, coins: 5, schoolDmg: 1, schoolRate: 2.2, playerDmg: 6, structDmg: 6, attackRate: 1.5, radius: 0.6, wallMult: 1.0, shootRange: 8.5, projDmg: 6, projSpeed: 12 },
    tank: { hp: 120, speed: 2.2, coins: 8, schoolDmg: 3, schoolRate: 2.8, playerDmg: 10, structDmg: 20, attackRate: 1.4, radius: 0.85, wallMult: 0.2 },
    boss: { hp: 600, speed: 1.8, coins: 40, schoolDmg: 5, schoolRate: 3.0, playerDmg: 15, structDmg: 40, attackRate: 1.6, radius: 1.5, wallMult: 0.2 }
};

export class Enemy {
    constructor(type, gatePos, hpMult, scene) {
        const st = ENEMY_STATS[type];
        this.type = type;
        this.st = st;
        this.hp = st.hp * hpMult;
        this.maxHp = this.hp;
        this.radius = st.radius;
        this.dead = false;
        this.scene = scene;
        this.mesh = makeEnemy(type);
        // small spawn scatter so groups don't stack perfectly
        this.pos = new THREE.Vector3(
            gatePos.x + (Math.random() - 0.5) * 2.5, 0,
            gatePos.z + (Math.random() - 0.5) * 2.5
        );
        this.vel = new THREE.Vector2(0, 0);       // knockback velocity
        this.path = [];
        this.pathVersion = -1;
        this.pathTimer = 0;
        this.attackCd = 0;
        this.slowUntil = 0;
        this.slowFactor = 1;
        this.bobT = Math.random() * 10;
        this.flashT = 0;
        scene.add(this.mesh);
        this._sync();
    }

    _sync() {
        const bob = this.type === 'runner' ? Math.abs(Math.sin(this.bobT * 9)) * 0.25 : 0;
        this.pos.y = terrainHeight(this.pos.x, this.pos.z);
        this.mesh.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
    }

    _ensurePath(game) {
        if (this.pathVersion === game.nav.version && this.path.length > 0) return;
        this.path = game.nav.findPath(this.pos.x, this.pos.z, this.st.wallMult);
        this.pathVersion = game.nav.version;
    }

    update(dt, game) {
        if (this.dead) return;
        this.bobT += dt;
        this.attackCd = Math.max(0, this.attackCd - dt);
        if (this.flashT > 0) {
            this.flashT -= dt;
            this.mesh.visible = Math.floor(this.flashT * 18) % 2 === 0;
        } else this.mesh.visible = true;

        // knockback decay
        if (this.vel.lengthSq() > 0.01) {
            this.pos.x += this.vel.x * dt;
            this.pos.z += this.vel.y * dt;
            this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
        }

        const slow = (game.time < this.slowUntil) ? this.slowFactor : 1;
        const distCenter = Math.hypot(this.pos.x, this.pos.z);

        // --- reached the school: attack it ---
        if (distCenter < SCHOOL_R + 1.0) {
            this.mesh.lookAt(0, this.mesh.position.y, 0);
            if (this.attackCd <= 0) {
                this.attackCd = this.st.schoolRate;
                game.damageSchool(this.st.schoolDmg);
                this._lungeFx();
            }
            this._sync();
            return;
        }

        // --- melee player if adjacent (opportunistic) ---
        const p = game.player;
        if (!p.dead) {
            const dP = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
            if (dP < this.radius + 0.9 && this.attackCd <= 0) {
                this.attackCd = this.st.attackRate;
                p.takeDamage(this.st.playerDmg, game);
                this._lungeFx();
            }
        }

        // --- ranged: stop and shoot nearest target in range ---
        if (this.type === 'ranged') {
            const target = this._pickRangedTarget(game);
            if (target) {
                this.mesh.lookAt(target.x, this.mesh.position.y, target.z);
                if (this.attackCd <= 0) {
                    this.attackCd = this.st.attackRate;
                    this._shoot(target, game);
                }
                this._sync();
                return;
            }
        }

        // --- follow path; smash structures blocking the next step ---
        this.pathTimer -= dt;
        if (this.pathTimer <= 0) { this._ensurePath(game); this.pathTimer = 0.8 + Math.random() * 0.6; }
        if (this.path.length === 0) { this._sync(); return; }

        const wp = this.path[0];
        const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
        const d = Math.hypot(dx, dz);

        // structure on the next waypoint? attack it instead of walking through
        const c = worldToCell(wp.x, wp.z);
        const struct = c ? game.nav.getStructure(c.i, c.j) : null;
        if (struct && d < 2.2) {
            this.mesh.lookAt(wp.x, this.mesh.position.y, wp.z);
            if (this.attackCd <= 0) {
                this.attackCd = this.st.attackRate;
                game.damageStructure(struct, this.st.structDmg);
                this._lungeFx();
            }
            this._sync();
            return;
        }

        if (d < 0.35) { this.path.shift(); this._sync(); return; }
        const sp = this.st.speed * slow;
        this.pos.x += dx / d * sp * dt;
        this.pos.z += dz / d * sp * dt;
        this.mesh.lookAt(wp.x, this.mesh.position.y, wp.z);
        this._sync();
    }

    _pickRangedTarget(game) {
        const r = this.st.shootRange;
        let best = null, bestD = Infinity;
        const p = game.player;
        if (!p.dead) {
            const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
            if (d < r && d < bestD) { bestD = d; best = { x: p.pos.x, z: p.pos.z, kind: 'player' }; }
        }
        for (const s of game.structures) {
            if (s.hp <= 0) continue;
            const d = Math.hypot(s.pos.x - this.pos.x, s.pos.z - this.pos.z);
            if (d < r && d < bestD) { bestD = d; best = { x: s.pos.x, z: s.pos.z, kind: 'structure', ref: s }; }
        }
        const dSchool = Math.hypot(this.pos.x, this.pos.z) - SCHOOL_R;
        if (dSchool < r && dSchool < bestD) best = { x: 0, z: 0, kind: 'school' };
        return best;
    }

    _shoot(target, game) {
        const mesh = makeMagicBolt();
        mesh.position.set(this.pos.x, this.pos.y + 1.4, this.pos.z);
        this.scene.add(mesh);
        const dir = new THREE.Vector3(target.x - this.pos.x, 0, target.z - this.pos.z).normalize();
        game.projectiles.push({
            mesh, dir, speed: this.st.projSpeed, dmg: this.st.projDmg,
            side: 'enemy', life: 1.6, radius: 0.8,
            targetKind: target.kind, targetRef: target.ref || null
        });
    }

    _lungeFx() {
        // quick scale pop as an attack telegraph
        this.mesh.scale.setScalar(1.18);
        setTimeout(() => { if (this.mesh) this.mesh.scale.setScalar(1); }, 120);
    }

    knockback(vx, vz) {
        const resist = (this.type === 'tank' || this.type === 'boss') ? 0.3 : 1;
        this.vel.x += vx * resist;
        this.vel.y += vz * resist;
    }

    applySlow(factor, durationMs, game) {
        this.slowFactor = factor;
        this.slowUntil = game.time + durationMs / 1000;
    }

    takeDamage(n, game) {
        if (this.dead) return;
        this.hp -= n;
        this.flashT = 0.25;
        if (this.hp <= 0) this._die(game);
    }

    _die(game) {
        this.dead = true;
        game.kills++;
        game.build.dropCoins(this.pos, this.st.coins);
        if ((this.type === 'tank' || this.type === 'boss') && Math.random() < 0.8) {
            game.build.dropAmmo(this.pos);
        }
        // shrink-out death effect, then remove
        game.effects.push({ mesh: this.mesh, t: 0, dur: 0.3, type: 'shrink' });
    }
}

// ============================================================
// WAVE DIRECTOR
// ============================================================
export const WAVES = [
    { runner: 6, tank: 0, ranged: 0, boss: 0, hpMult: 1.0, interval: 1.3, gates: 1 },
    { runner: 10, tank: 2, ranged: 0, boss: 0, hpMult: 1.0, interval: 1.1, gates: 1 },
    { runner: 12, tank: 3, ranged: 3, boss: 0, hpMult: 1.1, interval: 1.0, gates: 2 },
    { runner: 16, tank: 5, ranged: 5, boss: 0, hpMult: 1.2, interval: 0.85, gates: 3 },
    { runner: 22, tank: 8, ranged: 8, boss: 1, hpMult: 1.3, interval: 0.7, gates: 3 }
];

export class WaveDirector {
    constructor() {
        this.waveIdx = -1;          // current wave (0-based), -1 = not started
        this.queue = [];            // [{delay, type}]
        this.timer = 0;
        this.spawning = false;
    }
    get waveNumber() { return this.waveIdx + 1; }
    get hasMoreWaves() { return this.waveIdx < WAVES.length - 1; }

    startNextWave() {
        this.waveIdx++;
        const w = WAVES[this.waveIdx];
        const list = [];
        for (const t of ['runner', 'tank', 'ranged', 'boss']) {
            for (let i = 0; i < (w[t] || 0); i++) list.push(t);
        }
        // shuffle so types interleave
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        // boss always arrives last
        const bi = list.indexOf('boss');
        if (bi >= 0) { list.splice(bi, 1); list.push('boss'); }
        this.queue = list.map(type => ({ type }));
        this.timer = 0.5;
        this.spawning = true;
        return w;
    }

    update(dt, game) {
        if (!this.spawning) return;
        this.timer -= dt;
        if (this.timer <= 0 && this.queue.length > 0) {
            const w = WAVES[this.waveIdx];
            const entry = this.queue.shift();
            const usable = GATES.slice(0, w.gates || GATES.length);
            const gate = usable[Math.floor(Math.random() * usable.length)];
            game.enemies.push(new Enemy(entry.type, gate, w.hpMult, game.scene));
            this.timer = w.interval * (0.8 + Math.random() * 0.4);
        }
        if (this.queue.length === 0) this.spawning = false;
    }

    waveCleared(game) {
        return !this.spawning && this.queue.length === 0 &&
               game.enemies.every(e => e.dead);
    }
}
