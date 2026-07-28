// ============================================================
// SCHOOL DEFENSE 3D — models.js
// Procedural low-poly model factory (Tunic-ish flat-shaded look).
// Every function returns a THREE.Group centered at origin, feet at y=0.
// Interface is GLB-swappable: replace bodies with loaded Kenney models
// later without touching game logic.
// ============================================================
import * as THREE from 'three';
import { hasAsset, cloneModel } from './assets.js';

const _mats = new Map();
export function mat(color) {
    if (!_mats.has(color)) {
        _mats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
    }
    return _mats.get(color);
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    return m;
}
function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 6) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
    m.position.set(x, y, z);
    return m;
}
function cone(r, h, color, x = 0, y = 0, z = 0, seg = 6) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
    m.position.set(x, y, z);
    return m;
}
function sph(r, color, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(color));
    m.position.set(x, y, z);
    return m;
}

// Soft dark disc under characters (cheap fake shadow, WeChat-safe)
const _blobGeo = new THREE.CircleGeometry(1, 12);
const _blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
export function blobShadow(radius = 0.7) {
    const m = new THREE.Mesh(_blobGeo, _blobMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(radius);
    m.position.y = 0.03;
    m.renderOrder = 1;
    return m;
}

// ---------------- PLAYER (little green-tunic hero) ----------------
export function makePlayer() {
    const g = new THREE.Group();
    const body = cone(0.45, 1.0, 0x3f9b4f, 0, 0.7, 0, 8);      // tunic
    const head = sph(0.32, 0xf2c9a0, 0, 1.45, 0);               // head
    const hat = cone(0.3, 0.55, 0x2f7a3d, 0, 1.85, 0, 6);       // pointy hat
    hat.rotation.z = 0.25;
    g.add(body, head, hat);

    // Sword on a pivot so we can swing it
    const swordPivot = new THREE.Group();
    swordPivot.position.set(0.42, 0.95, 0);
    const blade = box(0.09, 0.09, 1.05, 0xd8dee6, 0, 0, -0.62);
    const guard = box(0.3, 0.08, 0.08, 0xb08d3e, 0, 0, -0.12);
    const grip = box(0.07, 0.07, 0.22, 0x5b4632, 0, 0, 0.06);
    swordPivot.add(blade, guard, grip);
    swordPivot.rotation.x = 0.5; // resting angle
    g.add(swordPivot);
    g.userData.swordPivot = swordPivot;

    // Bow held on the left (visual only)
    const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.045, 6, 10, Math.PI),
        mat(0x8a5a2b)
    );
    bow.position.set(-0.45, 0.95, 0);
    bow.rotation.y = Math.PI / 2;
    g.add(bow);

    g.add(blobShadow(0.65));
    return g;
}

// ---------------- ENEMIES ----------------
export function makeEnemy(type) {
    const g = new THREE.Group();
    if (type === 'runner') {
        g.add(cone(0.38, 0.85, 0xc0392b, 0, 0.55, 0, 6));
        g.add(sph(0.26, 0xe07b6a, 0, 1.15, 0));
        const eyeL = box(0.07, 0.07, 0.07, 0x222222, -0.1, 1.2, 0.22);
        const eyeR = box(0.07, 0.07, 0.07, 0x222222, 0.1, 1.2, 0.22);
        g.add(eyeL, eyeR);
        g.add(blobShadow(0.5));
    } else if (type === 'tank' || type === 'boss') {
        const s = type === 'boss' ? 1.8 : 1.0;
        const body = box(1.0 * s, 1.1 * s, 0.8 * s, 0x7a4a21, 0, 0.75 * s, 0);
        const head = box(0.55 * s, 0.5 * s, 0.55 * s, 0x9c6631, 0, 1.55 * s, 0);
        const hornL = cone(0.09 * s, 0.3 * s, 0xe8e0d0, -0.3 * s, 1.95 * s, 0, 5);
        const hornR = cone(0.09 * s, 0.3 * s, 0xe8e0d0, 0.3 * s, 1.95 * s, 0, 5);
        const armL = box(0.28 * s, 0.9 * s, 0.28 * s, 0x6b3f1c, -0.68 * s, 0.75 * s, 0);
        const armR = box(0.28 * s, 0.9 * s, 0.28 * s, 0x6b3f1c, 0.68 * s, 0.75 * s, 0);
        g.add(body, head, hornL, hornR, armL, armR);
        if (type === 'boss') {
            const crown = cyl(0.32, 0.38, 0.25, 0xd4af37, 0, 2.15 * s, 0, 6);
            g.add(crown);
        }
        g.add(blobShadow(0.85 * s));
    } else { // ranged
        g.add(cone(0.4, 1.0, 0x6c3fa0, 0, 0.6, 0, 6));
        g.add(sph(0.27, 0xb99bd8, 0, 1.28, 0));
        const staff = cyl(0.04, 0.04, 1.3, 0x4a3620, 0.4, 0.85, 0, 5);
        const orb = sph(0.12, 0x9b59d0, 0.4, 1.55, 0);
        g.add(staff, orb);
        g.add(blobShadow(0.55));
    }
    return g;
}

// ---------------- STRUCTURES ----------------
// Build a GLB tower: base model + a "head" model on top that aims/spins.
function glbTower(baseKey, topKey, opts = {}) {
    const g = new THREE.Group();
    const baseScale = opts.baseScale || 1.7;
    const base = cloneModel(baseKey, baseScale);
    g.add(base);
    const baseTopY = (opts.baseTop != null ? opts.baseTop : 0.6) * baseScale;
    const pivot = new THREE.Group();
    pivot.position.y = baseTopY;
    const top = cloneModel(topKey, opts.topScale || 1.8);
    pivot.add(top);
    g.add(pivot);
    g.userData.head = pivot;
    return g;
}

export function makeStructure(type, level = 1) {
    // Prefer GLB models when the asset pack loaded; else procedural.
    // Walls stay procedural: the crenellated stone block reads as a
    // defensive wall far better than the kit's wooden scaffold.
    if (hasAsset('towerRound')) {
        if (type === 'arrow') return glbTower('towerRound', 'ballista', { topScale: 1.9 });
        if (type === 'cannon') return glbTower('towerSquare', 'cannon', { baseTop: 0.5, topScale: 2.0 });
        if (type === 'frost') {
            const g = glbTower('towerRound', 'crystals', { topScale: 1.4 });
            return g;
        }
    }
    return makeStructureProcedural(type, level);
}

function makeStructureProcedural(type, level = 1) {
    const g = new THREE.Group();
    if (type === 'wall') {
        const c = level >= 2 ? 0x8d9aa8 : 0xa8a29a;
        const wall = box(1.8, level >= 2 ? 1.9 : 1.4, 1.8, c, 0, (level >= 2 ? 1.9 : 1.4) / 2, 0);
        g.add(wall);
        // crenellations
        for (const dx of [-0.6, 0, 0.6]) {
            g.add(box(0.35, 0.3, 0.35, c, dx, (level >= 2 ? 1.9 : 1.4) + 0.15, 0.6));
            g.add(box(0.35, 0.3, 0.35, c, dx, (level >= 2 ? 1.9 : 1.4) + 0.15, -0.6));
        }
    } else if (type === 'arrow') {
        g.add(cyl(0.55, 0.7, 1.9, 0xb0a494, 0, 0.95, 0, 8));
        g.add(cyl(0.72, 0.72, 0.35, 0x8d8478, 0, 2.0, 0, 8));
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 10, Math.PI), mat(0x8a5a2b));
        bow.position.y = 2.35;
        g.add(bow);
        g.userData.head = bow; // aims at target
    } else if (type === 'frost') {
        g.add(cyl(0.5, 0.65, 1.2, 0x7fb3d5, 0, 0.6, 0, 6));
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat(0xaee6ff));
        crystal.position.y = 1.75;
        g.add(crystal);
        g.userData.head = crystal; // spins
    } else if (type === 'cannon') {
        g.add(box(1.5, 0.8, 1.5, 0x6e6257, 0, 0.4, 0));
        const barrel = cyl(0.22, 0.3, 1.1, 0x3d3833, 0, 0, 0, 8);
        barrel.rotation.x = Math.PI / 2 - 0.5;
        const barrelPivot = new THREE.Group();
        barrelPivot.position.set(0, 1.0, 0);
        barrelPivot.add(barrel);
        barrel.position.z = -0.4;
        g.add(barrelPivot);
        g.userData.head = barrelPivot;
    }
    return g;
}

// ---------------- SCHOOL ----------------
export function makeSchool() {
    const g = new THREE.Group();
    const main = box(7, 3.2, 5, 0xd8b48a, 0, 1.6, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.3, 2.2, 4), mat(0xb5432f));
    roof.position.y = 4.3;
    roof.rotation.y = Math.PI / 4;
    const door = box(1.1, 1.7, 0.15, 0x6b4226, 0, 0.85, 2.55);
    g.add(main, roof, door);
    for (const dx of [-2.4, -0.8, 0.8, 2.4]) {
        g.add(box(0.8, 0.8, 0.12, 0xbfe3f0, dx, 2.1, 2.52));
        g.add(box(0.8, 0.8, 0.12, 0xbfe3f0, dx, 2.1, -2.52));
    }
    // clock tower + flag
    const tower = box(1.4, 2.4, 1.4, 0xcaa574, 0, 5.4, 0);
    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.1, 4), mat(0xb5432f));
    towerRoof.position.y = 7.15;
    towerRoof.rotation.y = Math.PI / 4;
    const pole = cyl(0.05, 0.05, 1.6, 0x888888, 0, 8.3, 0, 5);
    const flag = box(0.8, 0.5, 0.05, 0xe74c3c, 0.45, 8.6, 0);
    g.add(tower, towerRoof, pole, flag);
    g.userData.flag = flag;
    return g;
}

// ---------------- SCENERY ----------------
export function makeTree(scale = 1) {
    if (hasAsset('tree')) {
        const key = Math.random() < 0.5 ? 'tree' : 'treeSmall';
        const m = cloneModel(key, (key === 'tree' ? 4.2 : 5.5) * scale);
        m.rotation.y = Math.random() * Math.PI * 2;
        m.position.y = -0.15; // sink slightly into sloped terrain
        return m;
    }
    const g = new THREE.Group();
    g.add(cyl(0.18, 0.24, 1.0, 0x6b4a2b, 0, 0.5, 0, 6));
    g.add(cone(1.0, 1.6, 0x2e7d46, 0, 1.7, 0, 7));
    g.add(cone(0.75, 1.3, 0x389455, 0, 2.5, 0, 7));
    g.scale.setScalar(scale);
    return g;
}
export function makeRock(scale = 1) {
    if (hasAsset('rock')) {
        const key = Math.random() < 0.5 ? 'rock' : 'rockSmall';
        const m = cloneModel(key, (key === 'rock' ? 2.6 : 3.2) * scale);
        m.rotation.y = Math.random() * Math.PI * 2;
        m.position.y = -0.1; // sink slightly into sloped terrain
        return m;
    }
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), mat(0x8f9498));
    m.position.y = 0.3 * scale;
    m.scale.set(scale, scale * 0.7, scale);
    m.rotation.y = Math.random() * Math.PI;
    return m;
}
export function makeGate() {
    const g = new THREE.Group();
    const l = box(0.5, 2.6, 0.5, 0x5d4a66, -1.2, 1.3, 0);
    const r = box(0.5, 2.6, 0.5, 0x5d4a66, 1.2, 1.3, 0);
    const top = box(3.4, 0.5, 0.5, 0x4a3a52, 0, 2.75, 0);
    const glow = box(2.0, 2.2, 0.15, 0x9b59d0, 0, 1.2, 0);
    glow.material = new THREE.MeshBasicMaterial({ color: 0x9b59d0, transparent: true, opacity: 0.35 });
    g.add(l, r, top, glow);
    return g;
}

// ---------------- PICKUPS & PROJECTILES ----------------
export function makeCoin() {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10), mat(0xf5c542));
    m.rotation.x = Math.PI / 2;
    const g = new THREE.Group();
    g.add(m);
    g.position.y = 0.5;
    return g;
}
export function makeAmmoPack() {
    const g = new THREE.Group();
    g.add(box(0.5, 0.35, 0.5, 0x8a5a2b, 0, 0.2, 0));
    g.add(cyl(0.03, 0.03, 0.7, 0xd8dee6, -0.08, 0.55, 0, 4));
    g.add(cyl(0.03, 0.03, 0.7, 0xd8dee6, 0.1, 0.6, 0.05, 4));
    return g;
}
const _arrowGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 4);
export function makeArrowProjectile(color = 0xe8dcc0) {
    const m = new THREE.Mesh(_arrowGeo, mat(color));
    m.rotation.x = Math.PI / 2; // points along -Z after lookAt
    const g = new THREE.Group();
    g.add(m);
    return g;
}
export function makeCannonBall() {
    return sph(0.28, 0x3d3833);
}
export function makeMagicBolt() {
    return sph(0.2, 0xc65fff);
}

// Expanding shockwave ring for the special attack
export function makeShockwave() {
    const m = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1.15, 24),
        new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.15;
    return m;
}

// White ring flash for sword swings — a quick expanding ring around the
// player. Full ring so it needs no facing orientation (robust + reads as a
// slash impact). Spawned as a short 'shockwave' effect.
export function makeSlashArc(range = 2.8) {
    const m = new THREE.Mesh(
        new THREE.RingGeometry(range * 0.55, range * 0.72, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.6;
    return m;
}
