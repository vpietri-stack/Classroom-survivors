// ============================================================
// SCHOOL DEFENSE 3D — assets.js
// Async GLB preloader (Kenney CC0 Tower Defense Kit, self-hosted).
// - Loads all models once, caches the source scene.
// - Converts MeshStandardMaterial -> MeshLambertMaterial (keeps the
//   colormap texture) so lighting stays cheap on WeChat/mobile.
// - getModel(key) returns a fresh, scaled clone (feet at y=0).
// If loading fails, callers fall back to procedural models (models.js).
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const BASE = './three_td/assets/';

// GLB files to preload (bundled subset of the Kenney TD kit)
const FILES = {
    ballista: 'weapon-ballista',
    cannon: 'weapon-cannon',
    crystals: 'tower-round-crystals',
    towerRound: 'tower-round-bottom-a',
    towerSquare: 'tower-square-bottom-a',
    wall: 'wood-structure',
    wallHigh: 'wood-structure-high',
    tree: 'detail-tree-large',
    treeSmall: 'detail-tree',
    rock: 'detail-rocks-large',
    rockSmall: 'detail-rocks'
};

const _cache = new Map();      // key -> source THREE.Object3D (material-optimized)
export let ASSETS_READY = false;

function optimizeMaterials(root) {
    root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.receiveShadow = false;
        const src = o.material;
        if (src && src.type === 'MeshStandardMaterial') {
            const lam = new THREE.MeshLambertMaterial({
                map: src.map || null,
                color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
                vertexColors: src.vertexColors || false
            });
            o.material = lam;
        }
    });
}

/** Preload every GLB. Resolves true if all loaded, false if any failed. */
export async function loadAssets(onProgress) {
    const loader = new GLTFLoader();
    const keys = Object.keys(FILES);
    let done = 0, ok = true;
    await Promise.all(keys.map(async key => {
        try {
            const gltf = await loader.loadAsync(BASE + FILES[key] + '.glb');
            optimizeMaterials(gltf.scene);
            _cache.set(key, gltf.scene);
        } catch (e) {
            console.warn('[assets] failed to load', FILES[key], e.message);
            ok = false;
        }
        done++;
        if (onProgress) onProgress(done, keys.length);
    }));
    ASSETS_READY = ok && _cache.size === keys.length;
    return ASSETS_READY;
}

export function hasAsset(key) { return _cache.has(key); }

/**
 * Clone a preloaded model, uniformly scaled. Returns a THREE.Group whose
 * children sit with feet at y=0 (Kenney models already have minY≈0).
 */
export function cloneModel(key, scale = 1) {
    const src = _cache.get(key);
    if (!src) return null;
    const g = new THREE.Group();
    const c = src.clone(true);
    c.scale.setScalar(scale);
    g.add(c);
    return g;
}
