// ============================================================
// SCHOOL DEFENSE 3D — player.js
// Hero movement (camera-relative), sword / bow / special combat,
// death & respawn at the school.
// ============================================================
import * as THREE from 'three';
import { makePlayer, makeArrowProjectile, makeShockwave } from './models.js';
import { terrainHeight, worldToCell, MAP_HALF, SCHOOL_R } from './world.js';
import { spawnBurst, showFloatText } from './fx.js';

export const PLAYER = {
    MAX_HP: 50, SPEED: 8,
    SWORD_DMG: 15, SWORD_RANGE: 2.8, SWORD_ARC: Math.PI * 2 / 3, SWORD_CD: 0.45,
    BOW_DMG: 12, BOW_CD: 0.5, ARROW_SPEED: 24, START_ARROWS: 30,
    SPECIAL_DMG: 60, SPECIAL_RADIUS: 7, SPECIAL_CD: 30,
    RESPAWN_TIME: 5
};

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.mesh = makePlayer();
        this.pos = new THREE.Vector3(0, 0, SCHOOL_R + 2.5);
        this.facing = 0;                  // radians, 0 = +Z
        this.hp = PLAYER.MAX_HP;
        this.arrows = PLAYER.START_ARROWS;
        this.swordCd = 0;
        this.bowCd = 0;
        this.specialCd = 0;               // counts down; 0 = ready
        this.dead = false;
        this.respawnTimer = 0;
        this.swingT = -1;                 // sword swing anim progress
        this.hurtFlash = 0;
        this.walkT = 0;                   // walk-cycle phase
        this.moving = false;
        scene.add(this.mesh);
        this._syncMesh();
    }

    _syncMesh() {
        this.pos.y = terrainHeight(this.pos.x, this.pos.z);
        const bob = this.moving ? Math.abs(Math.sin(this.walkT)) * 0.14 : 0;
        this.mesh.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
        this.mesh.rotation.y = this.facing;
        this.mesh.rotation.z = this.moving ? Math.sin(this.walkT) * 0.05 : 0;
    }

    update(dt, game) {
        this.swordCd = Math.max(0, this.swordCd - dt);
        this.bowCd = Math.max(0, this.bowCd - dt);
        this.specialCd = Math.max(0, this.specialCd - dt);

        if (this.dead) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) this._respawn();
            return;
        }

        // --- camera-relative movement ---
        const mv = game.input.move;
        this.moving = false;
        if (mv.x !== 0 || mv.y !== 0) {
            const fwd = game.cameraForward;   // XZ-projected unit vector (set by main)
            const right = { x: -fwd.z, z: fwd.x };
            let dx = right.x * mv.x + fwd.x * (-mv.y);
            let dz = right.z * mv.x + fwd.z * (-mv.y);
            const m = Math.hypot(dx, dz);
            if (m > 1) { dx /= m; dz /= m; }
            const nx = this.pos.x + dx * PLAYER.SPEED * dt;
            const nz = this.pos.z + dz * PLAYER.SPEED * dt;
            if (this._canStand(nx, this.pos.z, game)) this.pos.x = nx;
            if (this._canStand(this.pos.x, nz, game)) this.pos.z = nz;
            if (m > 0.05) this.facing = Math.atan2(dx, dz);
            this.moving = true;
            this.walkT += dt * 11;
        }

        // --- sword swing animation ---
        if (this.swingT >= 0) {
            this.swingT += dt * 4.5;
            const p = this.mesh.userData.swordPivot;
            if (this.swingT >= 1) { this.swingT = -1; p.rotation.set(0.5, 0, 0); }
            else {
                const t = this.swingT;
                p.rotation.x = 0.5 - Math.sin(t * Math.PI) * 1.4;
                p.rotation.y = (t - 0.5) * 2.2;
            }
        }

        // hurt flash
        if (this.hurtFlash > 0) {
            this.hurtFlash -= dt;
            this.mesh.visible = Math.floor(this.hurtFlash * 14) % 2 === 0;
        } else this.mesh.visible = true;

        this._syncMesh();
    }

    _canStand(x, z, game) {
        if (Math.abs(x) > MAP_HALF - 1 || Math.abs(z) > MAP_HALF - 1) return false;
        if (Math.hypot(x, z) < SCHOOL_R) return false;              // school footprint
        const c = worldToCell(x, z);
        if (c && game.nav.getStructure(c.i, c.j)) return false;     // structures block
        return true;
    }

    // ---------------- COMBAT ----------------
    trySword(game) {
        if (this.dead || this.swordCd > 0) return;
        this.swordCd = PLAYER.SWORD_CD;
        this.swingT = 0;
        const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
        for (const e of game.enemies) {
            if (e.dead) continue;
            const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
            const d = Math.hypot(dx, dz);
            if (d > PLAYER.SWORD_RANGE + e.radius) continue;
            const dot = (dx * fx + dz * fz) / (d || 1);
            if (dot < Math.cos(PLAYER.SWORD_ARC / 2)) continue;
            e.takeDamage(PLAYER.SWORD_DMG, game);
            e.knockback(dx / (d || 1) * 6, dz / (d || 1) * 6);
        }
    }

    tryBow(game) {
        if (this.dead || this.bowCd > 0 || this.arrows <= 0) return;
        this.bowCd = PLAYER.BOW_CD;
        this.arrows--;
        // auto-aim: nearest living enemy within 60° facing cone, else straight ahead
        const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
        let best = null, bestD = Infinity;
        for (const e of game.enemies) {
            if (e.dead) continue;
            const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
            const d = Math.hypot(dx, dz);
            if (d > 22 || d < 0.5) continue;
            const dot = (dx * fx + dz * fz) / d;
            if (dot < 0.5) continue; // 60° cone
            if (d < bestD) { bestD = d; best = e; }
        }
        let dir;
        if (best) {
            dir = new THREE.Vector3(best.pos.x - this.pos.x, 0, best.pos.z - this.pos.z).normalize();
            this.facing = Math.atan2(dir.x, dir.z);
        } else {
            dir = new THREE.Vector3(fx, 0, fz);
        }
        const mesh = makeArrowProjectile();
        mesh.position.set(this.pos.x, this.pos.y + 1.1, this.pos.z);
        mesh.lookAt(mesh.position.clone().add(dir));
        this.scene.add(mesh);
        game.projectiles.push({
            mesh, dir, speed: PLAYER.ARROW_SPEED, dmg: PLAYER.BOW_DMG,
            side: 'player', life: 1.4, radius: 0.6
        });
    }

    trySpecial(game) {
        if (this.dead || this.specialCd > 0) return;
        this.specialCd = PLAYER.SPECIAL_CD;
        const wave = makeShockwave();
        wave.position.set(this.pos.x, this.pos.y + 0.15, this.pos.z);
        this.scene.add(wave);
        game.effects.push({ mesh: wave, t: 0, dur: 0.55, type: 'shockwave', maxR: PLAYER.SPECIAL_RADIUS });
        for (const e of game.enemies) {
            if (e.dead) continue;
            const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
            const d = Math.hypot(dx, dz);
            if (d > PLAYER.SPECIAL_RADIUS + e.radius) continue;
            e.takeDamage(PLAYER.SPECIAL_DMG, game);
            e.knockback(dx / (d || 1) * 16, dz / (d || 1) * 16);
        }
        game.shakeCamera(0.5);
    }

    takeDamage(n, game) {
        if (this.dead || this.hurtFlash > 0) return;
        this.hp -= n;
        this.hurtFlash = 0.6;
        spawnBurst(this.pos, 0xff4444, 6, 5);
        showFloatText(this.pos, '-' + n, '#ff6b6b', 16);
        game.shakeCamera(0.25);
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.respawnTimer = PLAYER.RESPAWN_TIME;
            this.mesh.visible = false;
            document.getElementById('respawnMsg').style.display = 'block';
        }
    }

    _respawn() {
        this.dead = false;
        this.hp = PLAYER.MAX_HP;
        this.pos.set(0, 0, SCHOOL_R + 2.5);
        this.hurtFlash = 1.2;
        document.getElementById('respawnMsg').style.display = 'none';
        this._syncMesh();
    }

    onWaveClear() {
        this.arrows += 10;
        this.hp = Math.min(PLAYER.MAX_HP, this.hp + 10);
    }
}
