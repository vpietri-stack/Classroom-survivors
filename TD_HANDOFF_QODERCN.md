# TOWER DEFENSE OVERHAUL — Handoff for QoderCN

**Generated:** 2026-07-21
**Purpose:** Complete, self-contained context so work can continue seamlessly in QoderCN.
**Scope of this doc:** The "School vs Zombies" Tower Defense overhaul ONLY.
(There is a separate `PROJECT_STATE_HANDOFF.md` covering the **speech/Whisper** system — read that too if touching speech. The two workstreams are independent.)

> **Read this whole file before editing anything.** It contains exact constants, line
> references, the ESL integration contract, the pending animated-sprite plan, known
> issues, and the git rules. Do not re-derive these from scratch.

---

## 0. TL;DR — Where things stand

- The Tower Defense game (`tower_defense.js`) has been **fully rewritten** into a
  vertical Plants-vs-Zombies-style "School vs Zombies" lane defense with ESL integration.
- It is **functional and bug-free at the logic level** (boots, spawns waves, towers fire,
  zombies eat towers, ESL slow works, no JS console errors).
- **Art is the main open item.** Current sprites are static generated PNGs the user called
  "kinda ugly." The user is generating **quality ANIMATED sprites via Nano Banana Pro**
  (external tool). Prompts have been delivered to the user (reproduced in §9). When those
  sprite files arrive, the animation-loading code must be wired in (§10).
- **Most recent feature added:** zombies now attack **EVERY** tower (not just the Desk),
  every tower has HP, towers show HP bars while being eaten, and upgrades boost HP.
- The work is **uncommitted** in the working tree (see §3).

---

## 1. The Original Request (verbatim intent)

The user asked to:

1. Upgrade the Tower Defense game to **resemble Plants vs Zombies**, but with a
   **"school vs zombie" theme**.
2. **Keep the existing ESL game/theme integration intact.**
3. **Optimize for vertical (portrait) display.**
4. Add **more different, fun, interesting towers** — specifically: "look up what kind of
   different towers there are in the original Plants vs Zombies, what they do, and adapt
   it to this game."
5. **Tune difficulty:** the player should **LOSE within the first 2 minutes** if they don't
   answer at least 2 ESL minigames; then **ramp up difficulty after 2 minutes**, but keep
   it fair and balanced.
6. Add a **"slow down" effect** when answering an ESL minigame — specifically **slow zombies
   by 60% (to 40% speed) for the WHOLE DURATION the player is answering**, so long/hard
   exercises don't destroy them.
7. **Iterate and self-check in the browser** until achieving a quality, fun, nice-looking
   game that rewards both game skill and ESL answer speed. "Time isn't the issue but
   quality is."
8. **Graphics polish:** user found generated graphics "kinda ugly" → wants **quality
   ANIMATED sprites** for all zombies and all towers, generated via Nano Banana Pro.
9. **Latest:** "I want the zombies to be able to attack the towers and the school" and
   "I want the zombies to attack EVERY tower, not just the desk or the school." ✅ DONE.

### Clarifying decisions the user made (locked in)

| Topic | Decision |
|---|---|
| Orientation | **Top-to-bottom** — zombies walk DOWN, school at the BOTTOM |
| ESL trigger | **Always-available button** in the HUD (large, pulsing) |
| Visual style | Originally "full pixel-art sprites"; **now upgraded to PvZ-style smooth cartoon animated sprites** (Nano Banana Pro) |
| Slow effect | **60% slow (40% speed) for the entire duration** the minigame is open |
| Tower set | **Adapt real PvZ plants** (9 towers, see §5) |
| Grid size | **5 columns × 7 rows** |
| Resource | **Coins only** (no separate sun resource) |
| Animation frames | **Zombies: 6 frames** (walk×2, attack×2, hit, death). **Towers: 4 frames** (idle×2, fire/action, recoil/used) |
| Sprite layout | **One file per character** |
| Art direction | **PvZ-style smooth cartoon** (bold outlines, cel shading, saturated friendly colors) |

---

## 2. Files involved

| File | Role | Status |
|---|---|---|
| `tower_defense.js` | **The game.** Full rewrite, ~1157 lines. Self-registers via `registerScene()` (boot.js). | Heavily modified (uncommitted) |
| `index.html` | DOM HUD, tower bar, slow overlay, game-over screen, TD CSS (Press Start 2P font). Lines ~663–770. | Modified (uncommitted) |
| `game.js` | ESL reward routing. Line ~636 routes `towerdefense` rewards to `tdCreditCoins`. | Modified (uncommitted) |
| `sprites/td/enemies.png` | Static enemy spritesheet, **1376×768**, 5 zombies in a row. | Untracked (new) |
| `sprites/td/towers.png` | Static tower spritesheet, **1024×1024**, 9 towers in a 3×3 grid. | Untracked (new) |

**Do NOT modify** the ESL contract in `game.js` beyond the existing routing line. The
contract is: `startMiniGame('spelling','towerdefense')` → on result → `tdCreditCoins(n)`.

---

## 3. Git state & rules (CRITICAL)

### Rules (user-enforced, never violate)
1. **NEVER** commit/push to `origin/main` — it is the **live production** page used by real
   students: https://vpietri-stack.github.io/Classroom-survivors/
2. **ALWAYS** work on the `preview` branch (tracks `preview/main`) → preview page:
   https://vpietri-stack.github.io/Classroom-survivors-preview/
3. **Do NOT create new branches.**
4. Push command: `git push preview HEAD:main`
5. GFW causes frequent push failures — retry with ~20s delays, up to ~8 attempts.

### Current state (as of writing)
- Active branch: **`preview`**, **1 commit ahead of `preview/main`** (commit `85d3c3c`,
  a speech change — **not yet pushed**).
- The **Tower Defense overhaul changes are UNCOMMITTED** in the working tree
  (`tower_defense.js`, `index.html`, `game.js` modified; `sprites/` untracked).
- Many untracked `*.png` screenshots at repo root are **test artifacts — ignore/delete**,
  do not commit them.

### Suggested commit (when the user is ready)
```
feat(td): School vs Zombies overhaul — vertical PvZ-style lane defense, 9 towers,
5 enemies, ESL slow-motion mechanic, portrait HUD, zombies eat all towers.
```
Stage only `tower_defense.js`, `index.html`, `game.js`, and `sprites/td/`. Leave the
root-level test screenshots out.

---

## 4. How to run & test locally

```powershell
# From repo root (PowerShell — use ; not &&):
npx http-server -p 8080 -c-1 --silent
```

**Test URL that bypasses login** (drops straight into the game menu):
```
http://localhost:8080/index.html?td=1&testMode=true&studentName=Test&studentAvatar=🐱
```
Then click **"我想边学边玩"** (learn while playing) → **"🏫 Tower Defense"**.

**Syntax check:** `node --check tower_defense.js` (must exit 0).

**Browser testing:** the `browser-use` MCP server is available (navigate_page,
evaluate_script, list_console_messages, take_screenshot). ⚠️ Known quirk: in the headless
browser the Phaser canvas sometimes reports a 0×0 bounding rect (parent container collapse),
which blocks click-to-place towers and visual confirmation — this is an **automation
viewport artifact, NOT a code bug**. The game renders fine in a normal browser. If the
canvas measures 0×0, try resizing the viewport to a portrait size (e.g. 420×800) before
interacting, or verify via `evaluate_script` reading game state instead of pixels.

**Existing test suite:** `npm test` runs
`test_widgets_regression.js && test_sr_once_per_session.js && test_round_e_dedup.js && test_td_gate.js`
(Playwright-core headless). `test_td_gate.js` covers the TD enable/gate logic.

---

## 5. Game design (as implemented)

### Grid & layout (portrait)
- `TD_COLS = 5`, `TD_ROWS = 7` playable cells. Cell size auto-calculated from screen.
- **School zone:** bottom strip (the base) with HP bar. Zombies reaching it damage it.
- **Spawn zone:** top edge. Zombies march **downward** in their column.
- **HUD (top):** coins 🪙, wave 🌊, school HP 🏫, pulsing **📖 ANSWER** button, ✕ exit.
- **Tower bar (bottom):** horizontal scroll of 9 tower icons + costs. Tap to select, tap a
  cell to place. Tap an existing tower to open an upgrade popup.

### Key constants (top of `tower_defense.js`, lines ~10–53)
```js
const TD_COLS = 5;
const TD_ROWS = 7;
const TD_START_COINS = 75;        // starting coins
const TD_START_BASE_HP = 20;      // school HP
const TD_ESL_SLOW_FACTOR = 0.4;   // zombies at 40% speed during ESL (60% reduction)
const TD_ESL_LINGER_MS = 2000;    // slow lingers 2s after a correct answer
```

### 9 Towers (`TD_TOWERS`, lines ~19–29) — adapted from PvZ
| Key | Name | PvZ origin | Cost | Type | Notes |
|---|---|---|---|---|---|
| `pencil` | Pencil ✏️ | Peashooter | 20 | shooter | dmg 12, fireRate 800ms, **hp 40** |
| `star` | Star Student ⭐ | Sunflower | 25 | generator | +5 coins / 8s, **hp 30** |
| `desk` | Desk 🪑 | Wall-nut | 15 | blocker | **hp 200** (the tank) |
| `eraser` | Eraser 🧽 | Snow Pea | 30 | shooter | dmg 8 + 40% slow on hit, **hp 40** |
| `popquiz` | Pop Quiz 💥 | Cherry Bomb | 40 | bomb | one-time 3×3 AOE 150 dmg, arm 2s, **hp 25** |
| `ruler` | Ruler 📏 | Repeater | 45 | shooter | dmg 9, **doubleShot**, **hp 45** |
| `textbook` | Textbook 📚 | Fume-shroom | 50 | shooter | dmg 6, **pierce** (hits whole column), **hp 45** |
| `trap` | Homework Trap 📝 | Potato Mine | 10 | mine | one-time 200 dmg, arms after 5s, **hp 15** |
| `firedrill` | Fire Drill 🔔 | Jalapeño | 60 | lanebomb | one-time, kills ALL in column, arm 1.5s, **hp 25** |

- `TD_TOWER_ORDER = ['pencil','star','desk','eraser','popquiz','ruler','textbook','trap','firedrill']`
- Upgrades: `TD_UPGRADE_DMG = 1.4`, `TD_UPGRADE_RATE = 0.85`, `TD_UPGRADE_HP = 1.4`,
  `TD_MAX_LEVEL = 3`. Upgrading **full-heals** the tower and boosts its max HP.

### 5 Enemies (`TD_ENEMIES`, lines ~37–43)
| Key | Name | PvZ origin | HP | Speed | dmg | Special |
|---|---|---|---|---|---|---|
| `dropout` | Dropout | Basic | 40 | 26 | 1 | none |
| `backpack` | Backpack | Conehead | 80 | 24 | 1 | armor 0.5 until 40 armorHp breaks |
| `nerd` | Nerd | Buckethead | 150 | 18 | 2 | heavy armor 0.3 |
| `bully` | Bully | Pole Vaulter | 50 | 48 | 1 | **vaults the FIRST tower** it meets (`jump`) |
| `librarian` | Librarian | Newspaper | 60 | 22 | 1 | **enrages** (2× speed) below 30% HP |

### Difficulty phases (`TD_PHASES`, lines ~46–53) — tuned so no-ESL ≈ loss ~2 min
```js
{ until: 30000,  interval: 5000, types: ['dropout'],                                   count: 1, hpMult: 1.0 }
{ until: 60000,  interval: 4000, types: ['dropout','backpack'],                        count: 1, hpMult: 1.0 }
{ until: 120000, interval: 3000, types: ['dropout','backpack','nerd'],                 count: 2, hpMult: 1.15 }
{ until: 180000, interval: 2400, types: ['dropout','backpack','nerd','bully'],         count: 2, hpMult: 1.3 }
{ until: 300000, interval: 1800, types: [all 5],                                       count: 3, hpMult: 1.5 }
{ until: Infinity, interval: 1200, types: [all 5],                                     count: 3, hpMult: 2.0 }
```
**Balance rule:** a player answering ESL every ~20–30s should always feel they can recover
(slow + 50 coins). Tower skill determines efficiency. **This still needs a final live
playtest to confirm "lose ~2 min without ESL, survive with regular ESL."**

---

## 6. ESL integration contract (DO NOT BREAK)

Flow:
```
HUD "📖 ANSWER" button  → onclick tdStartESL()
  → scene.startESL():  eslSlowActive = true; showSlowOverlay(true);
                       startMiniGame('spelling','towerdefense')
  → [player answers minigame; zombies at 40% speed the whole time]
  → game.js claimReward(success)  →  if rewardContext==='towerdefense' || activeGameMode==='TowerDefense':
                                       tdCreditCoins(success ? 50 : 0)   // game.js line ~636
  → tdCreditCoins(n) → scene.onESLComplete(n > 0)
       success: +50 coins, eslAnswered++, slow lingers TD_ESL_LINGER_MS (2s) then overlay hides
       failure: overlay hides immediately, no coins
```

Key methods in `tower_defense.js`:
- `startESL()` (~line 849)
- `onESLComplete(success)` (~line 857)
- `showSlowOverlay(show)` (~line 872) — toggles `#tdSlowOverlay` `.hidden`
- The slow factor is applied in `updateEnemies(dt)`:
  `if (this.eslSlowActive || now < this.eslSlowUntil) speed *= TD_ESL_SLOW_FACTOR;`

Global hooks (bottom of file, ~lines 1056–1156):
- `triggerTowerDefense()` — hides a list of DOM overlays **including `hud`**, starts the scene.
- `tdStartESL()`, `tdCreditCoins(n)`, `tdReturnToMenu()` (restores `#hud` on exit).
- `applyTowerDefenseGate()` — disables the button when `TD_ENABLED` is false.
- Legacy stubs: `tdBuild`, `tdUpgrade`, `tdEarnCoins`, `tdCloseMenu` (no-ops/compat).

---

## 7. Zombies attack EVERY tower (most recent change — DONE)

Implemented this session. Details:
- **Every tower now has HP** (was previously Desk-only). See the `hp` column in §5.
- In `updateEnemies(dt)` (~line 552+), the collision check was generalized from
  "Desk only" to **any tower except `trap`** (the trap is a mine — it triggers via its own
  check lower in the loop, it is not "eaten"):
  ```js
  if (towerHere && towerHere.type !== 'trap' && towerHere.hp > 0 && !e.attacking) {
      if (e.jump && !e.hasJumped) { e.hasJumped = true; e.y += this.cellH; /* vault */ }
      else { e.attacking = towerHere; }
  }
  ```
- While `e.attacking`, the zombie **stops moving** and drains the tower's HP
  (`e.attacking.hp -= e.dmg * (dt/1000) * 3`). On tower death → explosion + `tdBeep('hit')`
  + `removeTower(...)`, and the zombie resumes walking.
- **Bully** vaults the **first** tower of any type (popup text changed "Jump!" → "Vault!").
- **Tower HP bars:** new method `drawTowerHp(tower)` (~line 464) draws a green→orange→red
  bar under a tower that has taken damage; cleared at full HP; destroyed in `removeTower`.
- Upgrades now scale HP for all towers and full-heal (calls `drawTowerHp` to clear the bar).

**Design note for the animated sprites:** the zombie **attack frames (3↔4)** should play
during this `e.attacking` state. That wiring is part of the pending §10 work.

---

## 8. Current sprite/rendering implementation (STATIC — to be replaced)

- `preload()` (~line 201) loads two spritesheets:
  ```js
  this.load.spritesheet('td_enemies', 'sprites/td/enemies.png', { frameWidth: 275, frameHeight: 768 }); // 1376/5
  this.load.spritesheet('td_towers',  'sprites/td/towers.png',  { frameWidth: 341, frameHeight: 341 }); // 1024/3
  ```
  ⚠️ **frameWidth/frameHeight MUST match the real image dimensions** or Phaser extracts zero
  frames and renders broken strips. (This bug happened earlier with enemies — was 358×1024,
  fixed to 275×768.)
- Frame index maps (~line 192):
  ```js
  const TD_ENEMY_FRAMES = { dropout:0, backpack:1, nerd:2, bully:3, librarian:4 };
  const TD_TOWER_FRAMES = { pencil:0, star:1, desk:2, eraser:3, popquiz:4, ruler:5, textbook:6, trap:7, firedrill:8 };
  ```
- Towers placed via `this.add.image(c.x, c.y, 'td_towers', TD_TOWER_FRAMES[type])`
  (~line 417), display size `cellW * 0.75`.
- Enemies spawned via `this.add.image(x, y, 'td_enemies', TD_ENEMY_FRAMES[typeKey])`
  (~line 524), height `cellH * 0.85`, width keeps the 275:768 aspect ratio.
- **DEAD CODE:** the old procedural drawing functions `tdDrawPixelRect`, `tdDrawTowerSprite`
  (~line 63), and `tdDrawEnemySprite` (~line 140) are **no longer called** after the
  image-sprite refactor. Safe to delete when convenient (the user wanted polished art, not
  procedural pixels). The enemy `frame`/`frameTimer`/`lastDrawnFrame` fields and the
  300ms frame-swap in `updateEnemies` are leftover from the 2-frame procedural walk and are
  effectively unused with single-frame static sprites — repurpose them for real animation in §10.

---

## 9. Animated sprite prompts ALREADY given to the user (Nano Banana Pro)

The user is generating these externally. **14 files total**, one per character, transparent
background. When they arrive, ask the user for the **exact pixel dimensions** of each file
before wiring §10 (do not assume).

### Shared spec — ZOMBIES (6 frames, 3072×512, six 512×512 cells in one row)
> Horizontal sprite sheet, 6 frames in a single row, FULLY TRANSPARENT background (alpha —
> no white/checkerboard/fill). 3072×512 total, six equal 512×512 cells. Same character in
> every frame (identical proportions/colors/outfit; only pose changes). Centered, feet near
> bottom, same scale. No shadow bleeding outside the cell, no borders/grid/text/labels.
> Style: Plants-vs-Zombies-inspired smooth cartoon — bold clean outlines, soft cel shading,
> saturated friendly colors, slightly exaggerated/cute. Character faces the viewer /
> down-toward-camera (top-down-marching game).
> **Frame order is ALWAYS: 1=Walk A, 2=Walk B, 3=Attack wind-up, 4=Attack strike, 5=Hit/recoil, 6=Defeated.**

Per-zombie subjects/frames:
- **`dropout.png`** — goofy dropout boy, green skin, messy brown hair, torn gray hoodie,
  ripped jeans, one untied sneaker. Frames: walk A/B (arms swaying); attack wind-up (mouth
  opening, arms rearing); attack strike (CHOMP lunge, biting, arms swiping down); hit
  (head snapped back, eyes crossed, sweat); defeated (collapsing, head tilting off, dizzy stars).
- **`backpack.png`** — green zombie, bulky RED backpack + orange jacket armor. Frames: trudging
  walk A/B (backpack swaying); wind-up (leaning back, jaws parting); strike (heavy CHOMP lunge);
  hit (jolting, strap flying); defeated (backpack bursting, papers flying, crumpling).
- **`nerd.png`** — green zombie, shiny SILVER METAL BUCKET helmet, blue knitted sweater.
  Frames: heavy lumbering walk A/B (bucket wobbling); wind-up (head tilting under bucket);
  strike (headbutt/CHOMP, bucket clanking); hit (bucket clanging, dent, sparks); defeated
  (bucket flying off, dizzy head, collapsing).
- **`bully.png`** — muscular green bully teen, spiky YELLOW hair, black sleeveless shirt,
  torn jeans, angry grin, clenched fists. Frames: run A/B (dynamic sprint, fist pumping);
  wind-up (cocking fist back, snarling); strike (powerful PUNCH, motion lines); hit (snarling,
  arm up to block); defeated (dramatic backward fall, arms flailing).
- **`librarian.png`** — elderly green librarian woman, gray bun, round glasses, brown
  cardigan, long skirt, clutching a thick book. Frames: calm shuffle walk A/B; wind-up (raising
  book overhead, angry); strike (SLAMMING book down); enraged/hit (furious, glasses cracked);
  defeated (glasses flying, pages scattering, fainting backward).

### Shared spec — TOWERS (4 frames)
> Same transparency/style rules. 4 frames in one row. **Frame order: 1=Idle A, 2=Idle B,
> 3=Fire/Action, 4=Recoil/Used.** (Towers don't move to attack; they fire from their spot.)

Per-tower subjects (school-themed analogues of the PvZ plants in §5): Pencil, Star Student,
Desk, Eraser, Pop Quiz, Ruler, Textbook, Homework Trap, Fire Drill — each with idle A/B
(subtle bob), a fire/action frame, and a recoil/used frame. (One-time towers' frame 4 = the
"used/consumed" state.)

---

## 10. PENDING WORK — wiring the animated sprites (the big remaining task)

When the user delivers the 14 sprite files:

1. **Get exact pixel dimensions** of each file from the user (do not guess).
2. Place files (suggest `sprites/td/anim/<name>.png`, one per character).
3. In `preload()`, load each as a spritesheet with the correct `frameWidth`/`frameHeight`
   (zombies: 6 frames; towers: 4 frames).
4. Define Phaser animations in `create()`:
   - **Zombies:** `walk` = frames [0,1] loop (~6–8 fps); `attack` = frames [2,3] loop while
     `e.attacking`; `hit` = frame [4] (flash briefly on `damageEnemy`); `death` = frame [5]
     (play once on death, then destroy after the frame).
   - **Towers:** `idle` = frames [0,1] loop; `fire` = frame [2] (play on shoot, then back to
     idle); `used`/recoil = frame [3] for one-time towers / on taking a hit.
5. Replace the single-frame `this.add.image(...)` calls with `this.add.sprite(...)` and play
   the right animation based on state (walking vs `e.attacking` vs hit vs death).
6. Drive the **attack animation from the existing `e.attacking` state** (§7) so zombies
   visibly chomp towers/the school.
7. **Build defensively:** if a sprite file is missing, fall back to the current static
   sheet (or a colored rectangle) so the game never crashes on a missing asset.
8. Consider making the **school also get chomped** with the attack animation when a zombie
   reaches the bottom (currently `enemyReachSchool` deals instant damage and removes the
   zombie — the user's "attack the school" intent suggests a brief chomp-at-the-wall instead;
   confirm with the user whether they want that behavior change, as it affects balance).
9. Remove the dead procedural-draw code (§8) once animation is in.
10. Re-verify in browser: walk/attack/hit/death all play, no console errors, portrait layout intact.

---

## 11. Known issues / open verification items

1. **Animated sprites not yet integrated** (§10) — the headline remaining work.
2. **Balance not final-verified live:** need a real playtest confirming "lose within ~2 min
   without ESL, survivable with regular ESL." The phases in §5 are tuned but unproven in a
   full human playthrough.
3. **Runtime baseline VERIFIED (2026-07-21):** a headless Playwright-core + system-Chrome
   run (viewport 430×860, `--use-gl=swiftshader`) confirmed the committed game boots and
   runs: scene active; start coins=75 / baseHp=20; `placeTower('pencil'/'desk',…)` works and
   deducts correct cost (200→145 for pencil+desk+pencil); tower HP correct (pencil:40,
   desk:200); 5 enemies spawned by ~25s; **no failed requests, no JS errors** (the lone 404
   is just the favicon). NOTE: `window.game` is `undefined` by design — `game` is a bare
   top-level `let` in `boot.js` (script scope). To probe scene state from the console you
   must add a temporary hook inside `triggerTowerDefense()` (e.g.
   `window.__tdScene = () => game.scene.getScene('TowerDefenseScene')`), then remove it.
4. **Headless browser canvas 0×0 rect quirk** (§4) — confirmed an automation artifact, NOT a
   code bug: the canvas renders (WebGL `ReadPixels` activity observed) even though
   `getBoundingClientRect()` reports 0×0 in headless. Ignore it; verify visuals in a normal browser.
5. **Enemy sprite visual** still worth a quick eyeball in a normal browser (frames load and
   the game runs, but pixel-level correctness of the 275×768 enemy frames wasn't visually confirmed).
6. **Dead procedural-draw code** (§8) — clean up when convenient.
7. Root-level `*.png` test screenshots are clutter — delete or gitignore; don't commit.

---

## 12. DOM structure (index.html, ~lines 663–770)

```html
<!-- Top HUD -->
<div id="tdHUD" class="hidden fixed top-0 left-0 right-0 z-40 ... td-hud-bar">
  <div class="td-hud-item">🪙 <span id="tdCoins">0</span></div>
  <div class="td-hud-item">🌊 <span id="tdWave">0</span></div>
  <div class="td-hud-item">🏫 <span id="tdBaseHp">0</span></div>
  <button id="tdESLBtn" class="td-esl-btn" onclick="tdStartESL()">📖 ANSWER</button>
  <button class="td-exit-btn" onclick="tdReturnToMenu()">✕</button>
</div>
<!-- Bottom tower selection bar -->
<div id="tdTowerBar" class="hidden fixed bottom-0 left-0 right-0 z-40 td-tower-bar">
  <div id="tdTowerBarItems" class="td-tower-bar-items"></div>
</div>
<!-- ESL slow-motion overlay -->
<div id="tdSlowOverlay" class="hidden fixed inset-0 z-30 td-slow-overlay pointer-events-none">
  <div class="td-slow-text">⏳ SLOW MOTION ⏳</div>
</div>
<!-- Game over -->
<div id="tdGameOverScreen" class="hidden fixed inset-0 z-50 ...">
  <div class="td-gameover-box">
    <h2 id="tdGameOverText" class="td-gameover-title">School Overrun!</h2>
    ...stats: waves survived, zombies killed, ESL answered...
  </div>
</div>
```
CSS uses **Press Start 2P** (Google Fonts @import), a pulsing ANSWER button, and
`.td-tower-btn` with `.selected` / `.unaffordable` states.

> Note: the user is also actively editing `index.html` for the **speech** system
> (`speech_engine.js?v=4`, `speech_ui.js?v=3`, a temporary `speech_debug.js`,
> `speech_preload.js?v=2`). Those edits are unrelated to TD — **don't revert them**.

---

## 13. Suggested first actions for QoderCN

1. Read this file + `PROJECT_STATE_HANDOFF.md` (speech) fully.
2. Run the game locally (§4) and **visually confirm** the current static sprites render and
   that zombies eat towers (§7) — close out open item #3 in §11.
3. Ask the user whether the **animated sprite files are ready** and get their exact
   dimensions. If ready → execute §10. If not → do a **live balance playtest** (§11 #2) and
   tune `TD_PHASES` / tower damage / coin economy as needed.
4. When committing, follow §3 strictly (preview branch only; exclude root screenshots).

---

## 14. User preferences (communication & workflow)

- User is a **teacher** building this for students in Mainland China; tests on real devices
  (Android phone + iPad) in WeChat/Chrome/Safari, no VPN.
- Prefers **concise** communication; values **quality over speed** ("time isn't the issue").
- Wants the agent to **iterate and self-check in the browser** repeatedly until polished.
- Bundles their own WIP into commits and edits files directly (e.g., speech changes) —
  respect their in-progress edits, don't overwrite them.
- **Git: preview branch only, never origin/main** (see §3).
