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
