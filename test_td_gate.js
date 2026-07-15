// Network-independent verification of the Tower-Defense deploy gating.
// Loads the REAL config.js + tower_defense.js into jsdom (no CDN, no Phaser
// network), then asserts:
//   * live   path (/Classroom-survivors/)        -> TD_ENABLED=false, button greyed + "Coming soon", trigger is a no-op
//   * preview path (/Classroom-survivors-preview/) -> TD_ENABLED=true,  gate is a no-op (stays selectable)
//   * ?td=1 override on live -> enabled;  file:// -> enabled
// This is the merge-safe guarantee: the flag is derived from the URL at runtime,
// so it survives preview->main merges without re-toggling.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const root = __dirname;

const cfg = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const td = fs.readFileSync(path.join(root, 'tower_defense.js'), 'utf8');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS: ' + m); } else { fail++; console.error('FAIL: ' + m); } }

// Build a window for a given URL; load config + tower_defense; return the window.
function loadFor(url) {
  const html = `<!DOCTYPE html><body>
    <button id="towerDefenseBtn" class="game-btn bg-green-600 hover:bg-green-500 w-full py-4">🏫 Tower Defense (Defend the Base)</button>
    <div id="gameSelectionOverlay" class="hidden"></div>
  </body>`;
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  // Minimal stubs so the real scripts load without a full app boot.
  window.showGameSelection = function () {};
  window.activeGameMode = null;
  window.Phaser = { Game: function () {}, Scene: function () {} };
  window.config = { scene: [], parent: null };
  window.registerScene = function () {}; // declared in boot.js (not needed for gating test)
  window.game = null; // declared in boot.js; triggerTowerDefense checks `if (!game)`
  window.initAudio = function () {};
  // Combine + expose what we need to inspect. Must eval BOTH files in ONE scope
  // so tower_defense.js can see the lexical TD_ENABLED const (mirrors real
  // browser where config.js and tower_defense.js share global scope).
  window.eval(cfg + '\n' + td + '\nwindow.__TD = TD_ENABLED; window.__gate = applyTowerDefenseGate; window.__trigger = triggerTowerDefense;');
  return window;
}

// ---- LIVE (must be gated off) ----
const live = loadFor('https://vpietri-stack.github.io/Classroom-survivors/');
ok(live.__TD === false, 'live: TD_ENABLED is FALSE');
live.__gate();
const liveBtn = live.document.getElementById('towerDefenseBtn');
ok(liveBtn.disabled === true, 'live: button is disabled');
ok(liveBtn.classList.contains('bg-gray-600') && liveBtn.classList.contains('opacity-60'),
   'live: button is greyed (bg-gray-600 + opacity-60)');
ok((liveBtn.textContent || '').indexOf('Coming soon') !== -1, 'live: button shows "Coming soon"');
live.__trigger(); // must NOT launch
ok(live.activeGameMode !== 'TowerDefense', 'live: triggerTowerDefense() is a no-op (no launch)');

// ---- PREVIEW (must stay enabled) ----
const prev = loadFor('https://vpietri-stack.github.io/Classroom-survivors-preview/index.html');
ok(prev.__TD === true, 'preview: TD_ENABLED is TRUE');
prev.__gate(); // must be a no-op (no greying)
const prevBtn = prev.document.getElementById('towerDefenseBtn');
ok(prevBtn.disabled !== true, 'preview: button stays enabled after gate()');
ok(prevBtn.classList.contains('bg-gray-600') === false, 'preview: button is NOT greyed');
ok((prevBtn.textContent || '').indexOf('Coming soon') === -1, 'preview: button has no "Coming soon" text');

// ---- OVERRIDES ----
const override = loadFor('https://vpietri-stack.github.io/Classroom-survivors/?td=1');
ok(override.__TD === true, '?td=1 on live forces TD ENABLED');
const file = loadFor('file:///D:/coding/html%20games/Classroom-survivors/index.html');
ok(file.__TD === true, 'file:// (local open) keeps TD ENABLED');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
