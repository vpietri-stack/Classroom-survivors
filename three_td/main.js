// ============================================================
// SCHOOL DEFENSE 3D — main.js
// Bootstrap, renderer, camera rig (rotatable 3/4 ortho diorama),
// game loop, state machine, projectiles/effects, wave flow.
// ============================================================
import * as THREE from 'three';
import { buildWorld, terrainHeight, NavGrid, SCHOOL_R, MAP_HALF } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { WaveDirector, WAVES } from './enemies.js';
import { BuildManager } from './build.js';
import { updateHUD, showWaveBanner, showSkipButton, showEnd } from './hud.js';
import { loadAssets } from './assets.js';
import { initFx, updateFx } from './fx.js';
import { initAudio, resumeAudio, SFX, setAudioEnabled, isAudioEnabled } from './audio.js';

// ---------------- RENDERER ----------------
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x87b5d6, 55, 95);

// lights: warm sun + cool sky fill (flat-shaded diorama look)
scene.add(new THREE.HemisphereLight(0xbdd7ee, 0x5a7247, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.15);
sun.position.set(18, 30, 12);
scene.add(sun);

// ---------------- CAMERA RIG ----------------
const ELEV = THREE.MathUtils.degToRad(35);
const CAM_DIST = 60;
let azimuthIdx = 0;                     // 0..3 -> 45/135/225/315 deg
let camAngle = THREE.MathUtils.degToRad(45);
let camTargetAngle = camAngle;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
const followPoint = new THREE.Vector3(0, 0, 8);
let shake = 0;

function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    const halfH = 13;                    // world units half-height of view
    const halfW = halfH * (w / h);
    camera.left = -halfW; camera.right = halfW;
    camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function updateCamera(dt) {
    // shortest-arc lerp toward target angle
    let diff = camTargetAngle - camAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camAngle += diff * Math.min(1, dt * 6);

    if (game.player) {
        followPoint.lerp(new THREE.Vector3(game.player.pos.x, 0, game.player.pos.z), Math.min(1, dt * 5));
    }
    const fx = followPoint.x, fz = followPoint.z;
    const cx = fx + Math.sin(camAngle) * Math.cos(ELEV) * CAM_DIST;
    const cz = fz + Math.cos(camAngle) * Math.cos(ELEV) * CAM_DIST;
    const cy = Math.sin(ELEV) * CAM_DIST;
    camera.position.set(cx, cy, cz);
    if (shake > 0) {
        shake = Math.max(0, shake - dt * 2);
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
    }
    camera.lookAt(fx, terrainHeight(fx, fz) * 0.5, fz);
    // XZ-projected forward for camera-relative movement
    const f = new THREE.Vector3(fx - cx, 0, fz - cz).normalize();
    game.cameraForward = f;
}

// ---------------- GAME CONTEXT ----------------
const nav = new NavGrid();
let worldRefs = null;                    // built after assets load
const input = new Input();

const game = {
    scene, input, nav,
    player: null, build: null, waves: null,
    enemies: [], projectiles: [], effects: [],
    schoolHp: 30, kills: 0, time: 0, startedAt: 0,
    state: 'menu',                       // menu | gap | wave | won | lost
    cameraForward: new THREE.Vector3(0, 0, -1),
    shakeCamera(n) { shake = Math.max(shake, n); },
    damageSchool(n) {
        if (game.state === 'won' || game.state === 'lost') return;
        game.schoolHp -= n;
        game.shakeCamera(0.35);
        SFX.schoolHit();
        if (game.schoolHp <= 0) { game.schoolHp = 0; endGame(false); }
    },
    damageStructure(struct, n) { game.build.damage(struct, n, game); },
    spawnFrostRing(pos, radius) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 0.8, 20),
            new THREE.MeshBasicMaterial({ color: 0xaee6ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(pos.x, pos.y + 0.12, pos.z);
        scene.add(ring);
        game.effects.push({ mesh: ring, t: 0, dur: 0.5, type: 'shockwave', maxR: radius });
    }
};

game.waves = new WaveDirector();
Object.defineProperty(game, 'structures', { get: () => (game.build ? game.build.structures : []) });

// Build the world + entities once GLB assets are loaded (or failed → procedural).
let _initDone = false;
function initGame() {
    if (_initDone) return;
    _initDone = true;
    worldRefs = buildWorld(scene);
    game.player = new Player(scene);
    game.build = new BuildManager(scene, worldRefs, nav);
    initFx(scene, camera);
}

// ---------------- INPUT WIRING ----------------
input.on('sword', () => game.player && game.player.trySword(game));
input.on('bow', () => game.player && game.player.tryBow(game));
input.on('special', () => game.player && game.player.trySpecial(game));
input.on('buildToggle', () => game.build && game.build.toggle());
input.on('buildSelect', t => game.build && game.build.select(t));
input.on('rotate', dir => {
    azimuthIdx = (azimuthIdx + (dir > 0 ? 1 : 3)) % 4;
    camTargetAngle = THREE.MathUtils.degToRad(45 + 90 * azimuthIdx);
});

// Tap/click on terrain to place a structure (build mode only)
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function tryPlaceFromScreen(clientX, clientY) {
    if (!worldRefs || !game.build || !game.build.open || !game.build.selected) return;
    ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(worldRefs.terrain);
    if (hits.length > 0) {
        const p = hits[0].point;
        game.build.tryPlaceAt(p.x, p.z, game);
    }
}
canvas.addEventListener('mousedown', e => tryPlaceFromScreen(e.clientX, e.clientY));
canvas.addEventListener('touchstart', e => {
    if (!game.build || !game.build.open) return;
    const t = e.changedTouches[0];
    tryPlaceFromScreen(t.clientX, t.clientY);
    e.preventDefault();
}, { passive: false });

// ---------------- WAVE FLOW ----------------
let gapTimer = 0;
const FIRST_GAP = 8, BETWEEN_GAP = 15;

function startGap(seconds) {
    game.state = 'gap';
    gapTimer = seconds;
    showSkipButton(true, seconds);
}
function startWave() {
    showSkipButton(false);
    const n = game.waves.waveNumber + 1;
    game.waves.startNextWave();
    game.state = 'wave';
    SFX.waveStart();
    showWaveBanner(`🌊 Wave ${n}`, n === WAVES.length ? 'FINAL WAVE — the boss is coming!' : '');
}
document.getElementById('skipWaveBtn').addEventListener('click', () => {
    if (game.state === 'gap') startWave();
});

function endGame(won) {
    game.state = won ? 'won' : 'lost';
    if (won) SFX.victory(); else SFX.defeat();
    const t = Math.round((performance.now() - game.startedAt) / 1000);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    showEnd(won,
        `Waves survived: <b>${won ? WAVES.length : game.waves.waveNumber}</b><br>` +
        `Enemies defeated: <b>${game.kills}</b><br>` +
        `School HP left: <b>${game.schoolHp}/30</b><br>` +
        `Time: <b>${mm}:${ss}</b>`
    );
}

document.getElementById('startBtn').addEventListener('click', () => {
    if (!_initDone) return;
    initAudio();
    resumeAudio();
    document.getElementById('startOverlay').classList.add('hidden');
    game.startedAt = performance.now();
    showWaveBanner('🏫 Defend the School!', 'Build up before the first wave hits');
    startGap(FIRST_GAP);
});
document.getElementById('replayBtn').addEventListener('click', () => location.reload());

// Sound mute toggle
document.getElementById('muteBtn').addEventListener('click', () => {
    const on = !isAudioEnabled();
    setAudioEnabled(on);
    const btn = document.getElementById('muteBtn');
    btn.textContent = on ? '🔊' : '🔇';
    btn.classList.toggle('muted', !on);
});

// ---------------- PROJECTILES & EFFECTS ----------------
function updateProjectiles(dt) {
    for (let i = game.projectiles.length - 1; i >= 0; i--) {
        const pr = game.projectiles[i];
        pr.life -= dt;
        pr.mesh.position.addScaledVector(pr.dir, pr.speed * dt);
        let dead = pr.life <= 0;

        if (!dead && pr.side === 'player') {
            for (const e of game.enemies) {
                if (e.dead) continue;
                const d = Math.hypot(e.pos.x - pr.mesh.position.x, e.pos.z - pr.mesh.position.z);
                if (d < pr.radius + e.radius) {
                    if (pr.splash) {
                        for (const e2 of game.enemies) {
                            if (e2.dead) continue;
                            const d2 = Math.hypot(e2.pos.x - pr.mesh.position.x, e2.pos.z - pr.mesh.position.z);
                            if (d2 < pr.splash + e2.radius) e2.takeDamage(pr.dmg, game);
                        }
                        game.spawnFrostRing(pr.mesh.position, pr.splash); // reuse ring as blast fx
                    } else {
                        e.takeDamage(pr.dmg, game);
                    }
                    dead = true;
                    break;
                }
            }
        } else if (!dead && pr.side === 'enemy') {
            const pos = pr.mesh.position;
            if (pr.targetKind === 'player' && !game.player.dead) {
                if (Math.hypot(game.player.pos.x - pos.x, game.player.pos.z - pos.z) < 0.9) {
                    game.player.takeDamage(pr.dmg, game);
                    dead = true;
                }
            } else if (pr.targetKind === 'structure' && pr.targetRef && pr.targetRef.hp > 0) {
                if (Math.hypot(pr.targetRef.pos.x - pos.x, pr.targetRef.pos.z - pos.z) < 1.2) {
                    game.damageStructure(pr.targetRef, pr.dmg);
                    dead = true;
                }
            } else if (pr.targetKind === 'school') {
                if (Math.hypot(pos.x, pos.z) < SCHOOL_R + 0.6) {
                    game.damageSchool(1);   // ranged chip damage vs school
                    dead = true;
                }
            }
        }
        if (!dead && (Math.abs(pr.mesh.position.x) > MAP_HALF + 5 || Math.abs(pr.mesh.position.z) > MAP_HALF + 5)) dead = true;
        if (dead) {
            scene.remove(pr.mesh);
            game.projectiles.splice(i, 1);
        }
    }
}

function updateEffects(dt) {
    for (let i = game.effects.length - 1; i >= 0; i--) {
        const fx = game.effects[i];
        fx.t += dt;
        const p = Math.min(1, fx.t / fx.dur);
        if (fx.type === 'shockwave') {
            fx.mesh.scale.setScalar(1 + p * fx.maxR);
            fx.mesh.material.opacity = 0.9 * (1 - p);
        } else if (fx.type === 'shrink') {
            fx.mesh.scale.setScalar(Math.max(0.001, 1 - p));
            fx.mesh.rotation.y += dt * 6;
        }
        if (p >= 1) {
            scene.remove(fx.mesh);
            game.effects.splice(i, 1);
        }
    }
}

// ---------------- MAIN LOOP ----------------
let last = performance.now();

// Advance the simulation by dt seconds (no render). Factored out so the rAF
// loop and the headless debug stepper (window.__step) share identical logic.
function stepSim(dt) {
    game.time += dt;
    if (game.state === 'menu') return;

    game.player.update(dt, game);

    if (game.state === 'gap') {
        gapTimer -= dt;
        showSkipButton(true, gapTimer);
        if (gapTimer <= 0) startWave();
    } else if (game.state === 'wave') {
        game.waves.update(dt, game);
        if (game.waves.waveCleared(game)) {
            game.player.onWaveClear();
            game.enemies = game.enemies.filter(e => !e.dead);
            if (game.waves.hasMoreWaves) {
                showWaveBanner('✅ Wave cleared!', '+10 arrows · +10 HP');
                SFX.waveClear();
                startGap(BETWEEN_GAP);
            } else {
                endGame(true);
            }
        }
    }

    for (const e of game.enemies) e.update(dt, game);
    game.build.updateTowers(dt, game);
    game.build.updateDrops(dt, game);
    game.build.updateHighlights(dt, game);
    updateProjectiles(dt);
    updateEffects(dt);
    updateFx(dt);
    updateHUD(game);
}

function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepSim(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
}
requestAnimationFrame(loop);

// ---------------- BOOTSTRAP ----------------
// Load GLB assets (with visible progress), then build the world. If any
// asset fails (offline/older browser), models.js falls back to procedural
// primitives — the game always becomes playable.
const loadingMsg = document.getElementById('loadingMsg');
const startBtn = document.getElementById('startBtn');
startBtn.disabled = true;
startBtn.style.opacity = '0.5';
loadAssets((done, total) => {
    loadingMsg.textContent = `Loading models… ${done}/${total}`;
}).catch(e => {
    console.warn('[assets] load error — using procedural models', e);
}).finally(() => {
    initGame();
    loadingMsg.style.display = 'none';
    startBtn.disabled = false;
    startBtn.style.opacity = '1';
});

// Expose for headless testing / debugging
window.__game = game;
// Deterministic stepper for headless tests (rAF pauses when the tab is hidden).
window.__step = (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) stepSim(dt); renderer.render(scene, camera); };
