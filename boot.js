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
// phones. While VS is active we take over sizing: backing buffer = CSS x DPR
// (capped at 2 so a 160-enemy horde stays performant), displayed via CSS at the
// real window size, and VS multiplies its camera zoom by the same DPR so the
// visible world + all gameplay coordinates are unchanged (just sharper).
// enterHiDpi()/exitHiDpi() are called by the VS trigger/exit so every other
// game (Uno/TD on this same canvas) keeps the exact CSS-px RESIZE behavior.
function vsDpr() {
    return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}
let _hiDpiResizeHandler = null;
function _applyHiDpiSize() {
    if (!game || !game.scale) return;
    const dpr = vsDpr();
    const w = window.innerWidth, h = window.innerHeight;
    game.scale.resize(w * dpr, h * dpr);     // backing buffer = CSS x DPR
    if (game.canvas) {                        // ...displayed at CSS window size
        game.canvas.style.width = w + 'px';
        game.canvas.style.height = h + 'px';
        game.canvas.style.margin = '0';       // kill CENTER_BOTH's backing-based negative margin
    }
}
function enterHiDpi() {
    if (!game || !game.scale) return;
    // Scale.NONE + our own resize listener: Scale.RESIZE would auto-shrink the
    // backing back to CSS px on every window/orientation change, undoing this.
    game.scale.scaleMode = Phaser.Scale.NONE;
    // NO_CENTER: CENTER_BOTH centers using the (inflated) backing size vs the
    // parent, which mis-positions our manually CSS-sized canvas off-screen.
    game.scale.autoCenter = Phaser.Scale.NO_CENTER;
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
    game.scale.scaleMode = Phaser.Scale.RESIZE;
    game.scale.autoCenter = Phaser.Scale.CENTER_BOTH;
    game.scale.parentIsWindow = true;
    if (game.canvas) { game.canvas.style.width = ''; game.canvas.style.height = ''; game.canvas.style.margin = ''; }
    game.scale.resize(window.innerWidth, window.innerHeight);
    game.scale.refresh();
}
