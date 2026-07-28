// ============================================================
// SCHOOL DEFENSE 3D — build.js
// Grid placement (walls + 3 towers), tower AI, coin/ammo drops.
// ============================================================
import * as THREE from 'three';
import { makeStructure, makeCoin, makeAmmoPack, makeArrowProjectile, makeCannonBall } from './models.js';
import { terrainHeight, worldToCell, cellCenter, isBuildableCell } from './world.js';
import { spawnBurst, showFloatText } from './fx.js';
import { SFX } from './audio.js';

export const STRUCT_DEFS = {
    wall: { cost: 10, hp: 200, reinforceCost: 10, reinforceHp: 150 },
    arrow: { cost: 30, hp: 80, dmg: 8, range: 9, rate: 0.8 },
    frost: { cost: 40, hp: 80, radius: 6, slow: 0.5, slowMs: 1300, rate: 1.0 },
    cannon: { cost: 60, hp: 80, dmg: 20, range: 8, rate: 2.0, splash: 2.5 }
};
const PLACE_RANGE = 4.5;   // how far from the player you can build

export class BuildManager {
    constructor(scene, worldRefs, nav) {
        this.scene = scene;
        this.nav = nav;
        this.worldRefs = worldRefs;      // { gridGroup, cellGeo, cellMatOk, cellMatSel }
        this.coins = 60;
        this.open = false;
        this.selected = null;
        this.structures = [];
        this.drops = [];                 // coins & ammo packs
        this._highlightPool = [];
        this._highlightTimer = 0;
        this._rangeRing = null;      // shows selected tower's reach at the player
    }

    // ---------------- UI STATE ----------------
    toggle() {
        this.open = !this.open;
        this.worldRefs.gridGroup.visible = this.open;
        document.getElementById('buildBar').classList.toggle('open', this.open);
        if (!this.open) this.selected = null;
        this._refreshBarUI();
    }
    select(type) {
        if (!this.open) this.toggle();
        this.selected = (this.selected === type) ? null : type;
        this._refreshBarUI();
    }
    _refreshBarUI() {
        document.querySelectorAll('.build-btn').forEach(b => {
            b.classList.toggle('selected', b.dataset.build === this.selected);
            const def = STRUCT_DEFS[b.dataset.build];
            b.classList.toggle('unaffordable', this.coins < def.cost);
        });
    }

    // ---------------- PLACEMENT ----------------
    /** Attempt to place the selected structure at world (x,z). */
    tryPlaceAt(x, z, game) {
        if (!this.open || !this.selected) return false;
        const c = worldToCell(x, z);
        if (!c || !isBuildableCell(c.i, c.j)) return false;
        const center = cellCenter(c.i, c.j);
        const p = game.player.pos;
        if (Math.hypot(center.x - p.x, center.z - p.z) > PLACE_RANGE) return false;
        // player standing in the cell? don't entomb them
        const pc = worldToCell(p.x, p.z);
        if (pc && pc.i === c.i && pc.j === c.j) return false;

        const existing = this.nav.getStructure(c.i, c.j);
        const def = STRUCT_DEFS[this.selected];

        // Reinforce: wall selected on an existing level-1 wall
        if (existing) {
            if (this.selected === 'wall' && existing.type === 'wall' && existing.level === 1) {
                if (this.coins < def.reinforceCost) return false;
                this.coins -= def.reinforceCost;
                existing.level = 2;
                existing.maxHp += def.reinforceHp;
                existing.hp += def.reinforceHp;
                this._swapMesh(existing);
                this._refreshBarUI();
                SFX.reinforce();
                return true;
            }
            return false;
        }

        if (this.coins < def.cost) return false;
        this.coins -= def.cost;

        const struct = {
            type: this.selected, level: 1,
            hp: def.hp, maxHp: def.hp,
            pos: new THREE.Vector3(center.x, terrainHeight(center.x, center.z), center.z),
            cell: c, cd: 0, mesh: null, hpBar: null, flashT: 0
        };
        this._swapMesh(struct);
        this.structures.push(struct);
        this.nav.setStructure(c.i, c.j, struct, 50);
        this._refreshBarUI();
        SFX.build();
        return true;
    }

    _swapMesh(struct) {
        if (struct.mesh) this.scene.remove(struct.mesh);
        const mesh = makeStructure(struct.type, struct.level);
        mesh.position.copy(struct.pos);
        // HP bar
        const barBg = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.14, 0.14),
            new THREE.MeshBasicMaterial({ color: 0x111111 })
        );
        const barFg = new THREE.Mesh(
            new THREE.BoxGeometry(1.56, 0.1, 0.16),
            new THREE.MeshBasicMaterial({ color: 0x4caf50 })
        );
        const h = struct.type === 'wall' ? 2.6 : 2.9;
        barBg.position.y = h; barFg.position.y = h;
        barBg.visible = false; barFg.visible = false;
        mesh.add(barBg, barFg);
        struct.hpBar = { bg: barBg, fg: barFg };
        struct.mesh = mesh;
        this.scene.add(mesh);
    }

    damage(struct, n, game) {
        struct.hp -= n;
        struct.flashT = 0.2;
        spawnBurst(struct.pos, 0xb0a494, 4, 4);
        const ratio = Math.max(0, struct.hp / struct.maxHp);
        struct.hpBar.bg.visible = true;
        struct.hpBar.fg.visible = true;
        struct.hpBar.fg.scale.x = Math.max(0.02, ratio);
        struct.hpBar.fg.material.color.setHex(ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xffc107 : 0xf44336);
        if (struct.hp <= 0) this._destroy(struct, game);
    }

    _destroy(struct, game) {
        this.nav.clearStructure(struct.cell.i, struct.cell.j);
        this.structures = this.structures.filter(s => s !== struct);
        game.effects.push({ mesh: struct.mesh, t: 0, dur: 0.35, type: 'shrink' });
    }

    // ---------------- TOWERS ----------------
    updateTowers(dt, game) {
        for (const s of this.structures) {
            if (s.flashT > 0) {
                s.flashT -= dt;
                s.mesh.visible = Math.floor(s.flashT * 20) % 2 === 0;
            } else s.mesh.visible = true;
            if (s.type === 'wall') continue;
            s.cd = Math.max(0, s.cd - dt);
            const def = STRUCT_DEFS[s.type];

            if (s.type === 'frost') {
                // idle spin
                if (s.mesh.userData.head) s.mesh.userData.head.rotation.y += dt * 2;
                if (s.cd <= 0) {
                    let hit = false;
                    for (const e of game.enemies) {
                        if (e.dead) continue;
                        if (Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) <= def.radius) {
                            e.applySlow(def.slow, def.slowMs, game);
                            hit = true;
                        }
                    }
                    s.cd = def.rate;
                    if (hit) { game.spawnFrostRing(s.pos, def.radius); SFX.frost(); }
                }
                continue;
            }

            // shooter towers: nearest living enemy in range
            let best = null, bestD = Infinity;
            for (const e of game.enemies) {
                if (e.dead) continue;
                const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
                if (d <= def.range && d < bestD) { bestD = d; best = e; }
            }
            if (!best) continue;
            if (s.mesh.userData.head) {
                s.mesh.userData.head.lookAt(best.pos.x, s.pos.y + 2, best.pos.z);
            }
            if (s.cd > 0) continue;
            s.cd = def.rate;
            if (s.type === 'cannon') SFX.cannon(); else SFX.towerShoot();
            const dir = new THREE.Vector3(best.pos.x - s.pos.x, 0, best.pos.z - s.pos.z).normalize();
            const mesh = s.type === 'cannon' ? makeCannonBall() : makeArrowProjectile(0xc8b88a);
            mesh.position.set(s.pos.x, s.pos.y + 2.2, s.pos.z);
            if (s.type !== 'cannon') mesh.lookAt(mesh.position.clone().add(dir));
            this.scene.add(mesh);
            game.projectiles.push({
                mesh, dir, speed: s.type === 'cannon' ? 14 : 20, dmg: def.dmg,
                side: 'player', life: 1.2, radius: 0.7,
                splash: s.type === 'cannon' ? def.splash : 0
            });
        }
    }

    // ---------------- HIGHLIGHT GRID ----------------
    updateHighlights(dt, game) {
        if (!this.open) { if (this._rangeRing) this._rangeRing.visible = false; return; }
        // range preview ring for the selected shooter/frost tower
        this._updateRangeRing(game);
        this._highlightTimer -= dt;
        if (this._highlightTimer > 0) return;
        this._highlightTimer = 0.15;
        const { gridGroup, cellGeo, cellMatOk } = this.worldRefs;
        let used = 0;
        const p = game.player.pos;
        const pc = worldToCell(p.x, p.z);
        if (!pc) return;
        const R = Math.ceil(PLACE_RANGE / 2) + 1;
        for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) {
            const i = pc.i + di, j = pc.j + dj;
            if (!isBuildableCell(i, j)) continue;
            if (this.nav.getStructure(i, j)) continue;
            const c = cellCenter(i, j);
            if (Math.hypot(c.x - p.x, c.z - p.z) > PLACE_RANGE) continue;
            let m = this._highlightPool[used];
            if (!m) {
                m = new THREE.Mesh(cellGeo, cellMatOk);
                m.rotation.x = -Math.PI / 2;
                this._highlightPool.push(m);
                gridGroup.add(m);
            }
            m.visible = true;
            m.position.set(c.x, terrainHeight(c.x, c.z) + 0.06, c.z);
            used++;
        }
        for (let k = used; k < this._highlightPool.length; k++) this._highlightPool[k].visible = false;
    }

    _updateRangeRing(game) {
        const def = this.selected ? STRUCT_DEFS[this.selected] : null;
        const reach = def ? (def.range || def.radius || 0) : 0;
        if (!reach) { if (this._rangeRing) this._rangeRing.visible = false; return; }
        if (!this._rangeRing) {
            this._rangeRing = new THREE.Mesh(
                new THREE.RingGeometry(0.94, 1.0, 48),
                new THREE.MeshBasicMaterial({ color: 0x6dcf7a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
            );
            this._rangeRing.rotation.x = -Math.PI / 2;
            this.scene.add(this._rangeRing);
        }
        const p = game.player.pos;
        this._rangeRing.visible = true;
        this._rangeRing.position.set(p.x, terrainHeight(p.x, p.z) + 0.08, p.z);
        this._rangeRing.scale.setScalar(reach);
        this._rangeRing.material.color.setHex(this.selected === 'frost' ? 0xaee6ff : 0x6dcf7a);
    }

    // ---------------- DROPS ----------------
    dropCoins(pos, value) {
        // one pile mesh per kill (cheap), value carried on it
        const mesh = makeCoin();
        mesh.position.set(pos.x + (Math.random() - 0.5), 0, pos.z + (Math.random() - 0.5));
        mesh.position.y = terrainHeight(mesh.position.x, mesh.position.z) + 0.4;
        this.scene.add(mesh);
        this.drops.push({ mesh, value, kind: 'coin', t: 0 });
    }
    dropAmmo(pos) {
        const mesh = makeAmmoPack();
        mesh.position.set(pos.x + (Math.random() - 0.5), 0, pos.z + (Math.random() - 0.5));
        mesh.position.y = terrainHeight(mesh.position.x, mesh.position.z);
        this.scene.add(mesh);
        this.drops.push({ mesh, value: 5, kind: 'ammo', t: 0 });
    }
    updateDrops(dt, game) {
        const p = game.player;
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.t += dt;
            d.mesh.rotation.y += dt * 3;
            if (!p.dead) {
                const dx = p.pos.x - d.mesh.position.x, dz = p.pos.z - d.mesh.position.z;
                const dist = Math.hypot(dx, dz);
                if (dist < 2.5) { // magnet
                    d.mesh.position.x += dx / (dist || 1) * 8 * dt;
                    d.mesh.position.z += dz / (dist || 1) * 8 * dt;
                }
                if (dist < 0.9) {
                    if (d.kind === 'coin') {
                        this.coins += d.value;
                        showFloatText(p.pos, '+' + d.value + ' 🪙', '#ffd75e', 14);
                        SFX.coin();
                    } else {
                        p.arrows += d.value;
                        showFloatText(p.pos, '+' + d.value + ' 🏹', '#9fd6ff', 14);
                        SFX.ammo();
                    }
                    this.scene.remove(d.mesh);
                    this.drops.splice(i, 1);
                    this._refreshBarUI();
                    continue;
                }
            }
            if (d.t > 25) { // expire
                this.scene.remove(d.mesh);
                this.drops.splice(i, 1);
            }
        }
    }
}
