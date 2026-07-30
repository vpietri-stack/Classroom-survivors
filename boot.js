// ============================================================
// CENTRAL PHASER BOOT CONFIG
// Loaded FIRST (before vampire_survivors.js / uno.js / game.js) in index.html.
// Owns the global Phaser config, the running game instance, and the active-mode
// flag so every game registers its scene via registerScene() instead of poking
// globals scattered across game files.
// ============================================================

// --- PHASER CONFIG ---
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: null, // dynamically assigned by the game's trigger function
    transparent: true,
    backgroundColor: '#2d5016',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [], // scenes register themselves via registerScene()
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: {
        activePointers: 3
    }
};

// --- PHASER STATE ---
// The running Phaser.Game instance (assigned lazily by the first trigger*() call).
let game;

// Which game mode is active: 'VS' | 'Uno' | 'Gomoku' | null (teaching content only)
let activeGameMode = null; // 'VampireSurvivors' or 'Gomoku' or 'Uno'

// --- SCENE REGISTRATION ---
// Uniform way for each game to register its Phaser scene class. Safe to call at
// script-load time (config is guaranteed to exist because boot.js loads first).
function registerScene(sceneClass) {
    if (typeof config === 'undefined') return;
    if (!Array.isArray(config.scene)) config.scene = [];
    config.scene.push(sceneClass);
}

// --- HiDPI (retina) RENDERING (Vampire Survivors only, for now) ---------------
// The shared Phaser canvas defaults to Scale.RESIZE, which sizes the backing
// buffer in CSS pixels and lets the browser upscale it -> blur on high-DPR
// phones. While VS is active we render at HiDPI via Scale.NONE with:
//   gameSize (backing buffer) = CSS x DPR   (capped at 2 for horde perf)
//   ScaleManager zoom         = 1 / DPR     (canvas DISPLAYS at CSS window size)
// Letting the ScaleManager own the display size (via its zoom) is critical:
// it keeps displayScale = DPR so POINTER INPUT maps correctly. An earlier
// version set canvas.style manually, which left displayScale stale at 1 and
// broke the joystick + corrupted the scale state the other games inherit.
// VS also multiplies its CAMERA zoom by DPR so the visible world is unchanged.
// enterHiDpi()/exitHiDpi() are called by the VS trigger/exit so every other
// game (Uno/TD on this same canvas) keeps the exact CSS-px RESIZE behavior.
function vsDpr() {
    return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}
let _hiDpiResizeHandler = null;
function _applyHiDpiSize() {
    if (!game || !game.scale) return;
    const dpr = vsDpr();
    game.scale.setZoom(1 / dpr);                          // display = backing / DPR = CSS px
    game.scale.resize(window.innerWidth * dpr, window.innerHeight * dpr); // backing = CSS x DPR
    game.scale.refresh();                                 // recompute displaySize + displayScale (input)
}
function enterHiDpi() {
    if (!game || !game.scale) return;
    // Scale.NONE: we drive the size; RESIZE would auto-shrink the backing back
    // to CSS px on every window/orientation change, undoing the HiDPI buffer.
    game.scale.scaleMode = Phaser.Scale.NONE;
    game.scale.parentIsWindow = false;
    _applyHiDpiSize();
    if (!_hiDpiResizeHandler) {
        _hiDpiResizeHandler = () => _applyHiDpiSize();
        window.addEventListener('resize', _hiDpiResizeHandler);
    }
}
function exitHiDpi() {
    if (_hiDpiResizeHandler) {
        window.removeEventListener('resize', _hiDpiResizeHandler);
        _hiDpiResizeHandler = null;
    }
    if (!game || !game.scale) return;
    // Restore today's exact behavior for the other games sharing the canvas
    game.scale.setZoom(1);
    game.scale.scaleMode = Phaser.Scale.RESIZE;
    game.scale.parentIsWindow = true;
    game.scale.resize(window.innerWidth, window.innerHeight);
    game.scale.refresh();
}
