// ============================================================
// SCHOOL DEFENSE 3D — fx.js
// Cheap, pooled combat feedback:
//  - spawnBurst: small particle bursts (pooled meshes, no allocation churn)
//  - showFloatText: DOM floating damage/coin numbers (projected once,
//    animated with CSS — no per-frame projection cost)
// ============================================================
import * as THREE from 'three';

let _scene = null, _camera = null;

// ---------------- PARTICLES (pooled) ----------------
const POOL_SIZE = 80;
const _pool = [];
const _active = [];
const _pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const _pMats = new Map();
function pMat(color) {
    if (!_pMats.has(color)) _pMats.set(color, new THREE.MeshBasicMaterial({ color }));
    return _pMats.get(color);
}

export function initFx(scene, camera) {
    _scene = scene;
    _camera = camera;
    for (let i = 0; i < POOL_SIZE; i++) {
        const m = new THREE.Mesh(_pGeo, pMat(0xffffff));
        m.visible = false;
        scene.add(m);
        _pool.push(m);
    }
}

export function spawnBurst(pos, color = 0xffffff, count = 6, speed = 5) {
    if (!_scene) return;
    for (let i = 0; i < count; i++) {
        const m = _pool.pop();
        if (!m) break; // pool exhausted — skip silently
        m.material = pMat(color);
        m.visible = true;
        m.position.set(pos.x, (pos.y || 0) + 0.9, pos.z);
        m.scale.setScalar(0.7 + Math.random() * 0.7);
        const a = Math.random() * Math.PI * 2;
        const up = 2.5 + Math.random() * 3;
        _active.push({
            m,
            vx: Math.cos(a) * speed * (0.4 + Math.random() * 0.6),
            vy: up,
            vz: Math.sin(a) * speed * (0.4 + Math.random() * 0.6),
            life: 0.45 + Math.random() * 0.2
        });
    }
}

export function updateFx(dt) {
    for (let i = _active.length - 1; i >= 0; i--) {
        const p = _active[i];
        p.life -= dt;
        if (p.life <= 0) {
            p.m.visible = false;
            _pool.push(p.m);
            _active.splice(i, 1);
            continue;
        }
        p.vy -= 14 * dt; // gravity
        p.m.position.x += p.vx * dt;
        p.m.position.y += p.vy * dt;
        p.m.position.z += p.vz * dt;
        p.m.rotation.x += dt * 8;
        p.m.rotation.y += dt * 6;
        const s = Math.min(1, p.life / 0.25);
        p.m.scale.setScalar(s * 0.9);
    }
}

// ---------------- FLOATING TEXT (DOM) ----------------
const _v = new THREE.Vector3();
let _textLayer = null;
const MAX_TEXTS = 24;
let _liveTexts = 0;

function ensureLayer() {
    if (_textLayer) return _textLayer;
    _textLayer = document.createElement('div');
    _textLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:14;overflow:hidden;';
    document.body.appendChild(_textLayer);
    // one-time keyframes for the float-up animation
    const style = document.createElement('style');
    style.textContent = `@keyframes fxFloatUp {
        0% { transform: translate(-50%, 0) scale(0.7); opacity: 0; }
        15% { transform: translate(-50%, -10px) scale(1.15); opacity: 1; }
        100% { transform: translate(-50%, -46px) scale(1); opacity: 0; }
    }`;
    document.head.appendChild(style);
    return _textLayer;
}

export function showFloatText(worldPos, text, cssColor = '#fff', sizePx = 15) {
    if (!_camera || _liveTexts >= MAX_TEXTS) return;
    _v.set(worldPos.x, (worldPos.y || 0) + 1.8, worldPos.z).project(_camera);
    if (_v.z > 1) return; // behind camera
    const x = (_v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;` +
        `color:${cssColor};font-weight:900;font-size:${sizePx}px;` +
        `font-family:'Segoe UI',system-ui,sans-serif;` +
        `text-shadow:0 1px 3px rgba(0,0,0,0.8);` +
        `animation:fxFloatUp 0.75s ease-out forwards;will-change:transform,opacity;`;
    ensureLayer().appendChild(el);
    _liveTexts++;
    setTimeout(() => { el.remove(); _liveTexts--; }, 800);
}
