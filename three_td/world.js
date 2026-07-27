// ============================================================
// SCHOOL DEFENSE 3D — world.js
// Terrain (hill heightmap), school, gates, scenery, build grid,
// A* pathfinding over the grid with structure costs.
// ============================================================
import * as THREE from 'three';
import { makeSchool, makeTree, makeRock, makeGate, mat } from './models.js';

export const MAP_HALF = 30;          // world is 60x60 centered at 0
export const CELL = 2;               // grid cell size
export const GRID_N = 30;            // 30x30 cells
export const HILL_H = 6;
export const HILL_R = 18;
export const SCHOOL_R = 4.2;         // school footprint radius (no build / no walk)
export const BUILD_MIN_R = 5.2;      // buildable ring
export const BUILD_MAX_R = 24;

export const GATES = [
    new THREE.Vector3(0, 0, -28),
    new THREE.Vector3(-24, 0, 20),
    new THREE.Vector3(24, 0, 20)
];

// ---------------- TERRAIN ----------------
export function terrainHeight(x, z) {
    const d = Math.sqrt(x * x + z * z);
    if (d >= HILL_R) return 0;
    // smooth cosine hill
    return HILL_H * 0.5 * (1 + Math.cos(Math.PI * d / HILL_R));
}

export function buildWorld(scene) {
    // --- terrain mesh with vertex colors ---
    const seg = 60;
    const geo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrassLow = new THREE.Color(0x4a8f3c);
    const cGrassHi = new THREE.Color(0x6fbf58);
    const cPeak = new THREE.Color(0x9ccf7a);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const h = terrainHeight(x, z);
        pos.setY(i, h);
        const t = h / HILL_H;
        if (t > 0.75) tmp.copy(cPeak);
        else tmp.lerpColors(cGrassLow, cGrassHi, t / 0.75);
        // subtle checker variation for a hand-painted feel
        const n = (Math.sin(x * 0.7) * Math.cos(z * 0.9)) * 0.04;
        colors[i * 3] = tmp.r + n;
        colors[i * 3 + 1] = tmp.g + n;
        colors[i * 3 + 2] = tmp.b + n;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    scene.add(terrain);

    // --- water border (flat blue plane slightly below) ---
    const water = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshBasicMaterial({ color: 0x3a7ca5 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.6;
    scene.add(water);

    // --- school on the hilltop ---
    const school = makeSchool();
    school.position.set(0, terrainHeight(0, 0), 0);
    scene.add(school);

    // --- spawn gates ---
    for (const g of GATES) {
        const gate = makeGate();
        gate.position.set(g.x, terrainHeight(g.x, g.z), g.z);
        gate.lookAt(0, gate.position.y, 0);
        scene.add(gate);
    }

    // --- scenery: deterministic pseudo-random trees & rocks ---
    let s = 42;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 20 + rnd() * 8.5;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (GATES.some(g => Math.hypot(g.x - x, g.z - z) < 5)) continue;
        const obj = rnd() < 0.7 ? makeTree(0.8 + rnd() * 0.7) : makeRock(0.7 + rnd() * 0.9);
        obj.position.set(x, terrainHeight(x, z), z);
        obj.rotation.y = rnd() * Math.PI * 2;
        scene.add(obj);
    }

    // --- build grid overlay (shown only in build mode) ---
    const gridGroup = new THREE.Group();
    gridGroup.visible = false;
    const cellGeo = new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.9);
    const cellMatOk = new THREE.MeshBasicMaterial({ color: 0x6dcf7a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const cellMatSel = new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    scene.add(gridGroup);

    return { terrain, school, gridGroup, cellGeo, cellMatOk, cellMatSel };
}

// ---------------- GRID HELPERS ----------------
export function worldToCell(x, z) {
    const i = Math.floor((x + MAP_HALF) / CELL);
    const j = Math.floor((z + MAP_HALF) / CELL);
    if (i < 0 || i >= GRID_N || j < 0 || j >= GRID_N) return null;
    return { i, j };
}
export function cellCenter(i, j) {
    return new THREE.Vector3(
        i * CELL - MAP_HALF + CELL / 2,
        0,
        j * CELL - MAP_HALF + CELL / 2
    );
}
export function isBuildableCell(i, j) {
    const c = cellCenter(i, j);
    const r = Math.hypot(c.x, c.z);
    return r >= BUILD_MIN_R && r <= BUILD_MAX_R;
}

// ---------------- PATHFINDING ----------------
// Cost grid: 1 = free. Structures add cost so enemies path "through" them
// (then stop and attack the structure) — PvZ behavior, never unreachable.
export class NavGrid {
    constructor() {
        this.cost = new Float32Array(GRID_N * GRID_N).fill(1);
        this.structAt = new Array(GRID_N * GRID_N).fill(null);
        this.version = 0;
        // school footprint = impassable target zone (enemies stop at edge)
        this.schoolCells = new Set();
        for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
            const c = cellCenter(i, j);
            if (Math.hypot(c.x, c.z) < SCHOOL_R) this.schoolCells.add(i + j * GRID_N);
        }
    }
    idx(i, j) { return i + j * GRID_N; }
    setStructure(i, j, structure, cost) {
        this.structAt[this.idx(i, j)] = structure;
        this.cost[this.idx(i, j)] = cost;
        this.version++;
    }
    clearStructure(i, j) {
        this.structAt[this.idx(i, j)] = null;
        this.cost[this.idx(i, j)] = 1;
        this.version++;
    }
    getStructure(i, j) { return this.structAt[this.idx(i, j)]; }

    // A* from world pos to school edge. wallCostMult lets tanks prefer smashing.
    // Returns array of Vector3 waypoints (world coords, y=0).
    findPath(fromX, fromZ, wallCostMult = 1) {
        const start = worldToCell(fromX, fromZ);
        if (!start) return [];
        const N = GRID_N;
        const open = [];               // simple binary-ish sorted insert (grid is small)
        const gScore = new Float32Array(N * N).fill(Infinity);
        const came = new Int32Array(N * N).fill(-1);
        const closed = new Uint8Array(N * N);
        const h = (i, j) => Math.hypot(i - N / 2, j - N / 2);
        const sIdx = this.idx(start.i, start.j);
        gScore[sIdx] = 0;
        open.push({ f: h(start.i, start.j), idx: sIdx });

        let goal = -1;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        while (open.length) {
            // pop lowest f
            let bi = 0;
            for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
            const cur = open.splice(bi, 1)[0];
            if (closed[cur.idx]) continue;
            closed[cur.idx] = 1;
            const ci = cur.idx % N, cj = Math.floor(cur.idx / N);
            if (this.schoolCells.has(cur.idx)) { goal = cur.idx; break; }
            for (const [dx, dy] of dirs) {
                const ni = ci + dx, nj = cj + dy;
                if (ni < 0 || ni >= N || nj < 0 || nj >= N) continue;
                const nIdx = ni + nj * N;
                if (closed[nIdx]) continue;
                // no corner cutting through structures diagonally
                if (dx !== 0 && dy !== 0) {
                    if (this.structAt[ci + nj * N] || this.structAt[ni + cj * N]) continue;
                }
                let c = this.cost[nIdx];
                if (c > 1) c *= wallCostMult;
                const step = (dx !== 0 && dy !== 0) ? 1.414 : 1;
                const ng = gScore[cur.idx] + step * c;
                if (ng < gScore[nIdx]) {
                    gScore[nIdx] = ng;
                    came[nIdx] = cur.idx;
                    open.push({ f: ng + h(ni, nj), idx: nIdx });
                }
            }
        }
        if (goal < 0) return [];
        // reconstruct
        const path = [];
        let cur = goal;
        while (cur !== -1) {
            const i = cur % N, j = Math.floor(cur / N);
            path.push(cellCenter(i, j));
            cur = came[cur];
        }
        path.reverse();
        // drop the start cell (we're already there)
        if (path.length > 1) path.shift();
        return path;
    }
}
