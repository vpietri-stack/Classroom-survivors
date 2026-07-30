# PROJECT HANDOFF — Classroom Survivors

_Last updated: 2026-07-29. Branch: `preview`. Latest commit at write time: `7f091d7`._

This is a detailed handoff for the **Classroom Survivors** ESL educational game — an HTML/JS web app for young Chinese English learners. It documents architecture, the games, the recent work, the HiDPI system, the asset pipeline, testing, known pitfalls, and open items. Read the "Golden Rules" first.

---

## 0. GOLDEN RULES (read before touching anything)

1. **Git: `preview/main` ONLY.** Work/commit/push exclusively to the `preview` branch and push with `git push preview preview:main` (updates the preview site `https://vpietri-stack.github.io/Classroom-survivors-preview/`). **NEVER** push to `origin/main` — that is the LIVE production site used by real students.
2. **Shell is Windows PowerShell.** Use `;` as the statement separator, NOT `&&`. `tail` doesn't exist — use `Select-Object -Last N`. `grep` doesn't exist — use `findstr` or the ripgrep-based Grep tool.
3. **GFW push failures are normal.** `git push` intermittently fails with `Recv failure: Connection was reset` / `Empty reply from server`. Just retry after `Start-Sleep 10-25`.
4. **Verify with headless Chrome + screenshots, not assumptions.** The repo has a large suite of one-off Node + `playwright-core` scripts. Run them; read the screenshots. Object properties ("visible:true") can lie — screenshot the actual render.
5. **HiDPI is driven through the Phaser ScaleManager, never by setting `canvas.style` manually** (see §6). This is the single most bug-prone area.

---

## 1. WHAT THE PROJECT IS

A single-page web app (`index.html`) hosting several mini-games plus an ESL "study/teaching" layer with spaced-repetition (SR). Target users: young Chinese kids learning English. Runs on phones (WeChat browser) and PC. Deployed as a static site on **GitHub Pages** (preview + live). A separate **Azure Static Web Apps + Cosmos DB** backend (`/api`) handles auth, student data, and speech telemetry.

Games (all launched from the game-selection menu):
- **Vampire Survivors (VS)** — the flagship. A top-down survivor/horde game reskinned as "school survival". Phaser 3. Most recent work is here.
- **UNO** — Phaser 3 card game (shares the same Phaser canvas as VS).
- **Gomoku (五子棋 / 5-in-a-row)** — uses its **own 2D `<canvas>`**, NOT Phaser.
- **Tower Defense (TD)** — Phaser, still in development, gated off on live (`config.js` `TD_ENABLED`).
- **School Defense 3D** — a standalone Three.js POC (`three_td.html`), gated (`THREE_TD_ENABLED`).

Every level-up / reward in VS (and turns in UNO/Gomoku speed mode) triggers an **ESL mini-game** (spelling, word-rec, scramble, sentence-match) tied to spaced repetition.

---

## 2. ARCHITECTURE & KEY FILES

### Boot / shared Phaser instance
- **`boot.js`** — loads FIRST. Owns the global Phaser `config` (one shared `Phaser.Game` instance, `game`), the `activeGameMode` flag, `registerScene()` (VS/UNO/TD each register their scene), and the **HiDPI helpers** `vsDpr()` / `enterHiDpi(el?)` / `exitHiDpi()` (see §6).
- Scale config default: `Scale.RESIZE` + `CENTER_BOTH`, `parent` assigned per-game at launch.
- **One canvas is shared** by VS, UNO, TD. Each game's `trigger*()` reparents/resizes it. Gomoku is separate (own 2D canvas).

### Core game files
- **`vampire_survivors.js`** (~4000 lines) — the VS `MainScene` + the VS wrapper functions (`triggerVampireSurvivors`, `showVsCharSelect`, `selectVsCharacter`, `startVsFromCharSelect`, `showGameIntro`, `startGameFromIntro`, `showPowerUpSelection`, `applyReward`, `exitVampireSurvivors`, victory menu). Weapons, enemies, bosses, walking puzzles, HUD, anti-flee, VFX all live here.
- **`uno.js`** — `UnoScene` + `triggerUno()` / `exitUnoGame()`.
- **`gomoku.js`** — DOM/2D-canvas gomoku; `triggerGomoku(mode)`.
- **`tower_defense.js`**, **`three_td.html` / `three_td/`** — TD + 3D POC.
- **`game.js`** — shared glue: WebAudio SFX (procedural synths + the sampled-SFX player), `updateDOMHUD`, `showGameSelection`, mini-game orchestration.
- **`bgm.js`** — background music + mute.
- **`config.js`** — API base URL, app key, `TD_ENABLED` / `THREE_TD_ENABLED` runtime gating (keys off URL path so preview↔live merges are safe).
- **`asset_cache.js`** — `AssetCache`: IndexedDB-backed prefetch/cache with mirrors + gh-proxy, keyed by **group version tokens** (see §5). Holds `VS_SPRITES` / `TD_SPRITES` / `MUSIC` manifests.
- **`sw.js`** — service worker; no-cache revalidation (does NOT cache-first).
- **`index.html`** — all overlays/screens (start, game select, VS char-select, intro, level-up menu, UNO/Gomoku screens, game-over).
- **`speech_*.js`, `sr_engine.js`, `study_mode.js`, `teaching_content.js`, `content_*.js`, `translations.js`** — ESL/SR/speech layer.

---

## 3. VAMPIRE SURVIVORS — CURRENT DESIGN

### Character select (before the intro)
Clicking "Vampire Survivors" → `showVsCharSelect()` → pick a hero → `startVsFromCharSelect()` → how-to intro → `triggerVampireSurvivors()`. Selected hero stored on `window.vsSelectedCharacter`, read in `MainScene.create()`.

Two heroes (`VS_CHARACTERS` map at top of `vampire_survivors.js`):
- **班长 Class Monitor** — parts `p_body/p_arm/p_foot_l/p_foot_r`; exclusive weapon = **Ruler** (`id:'ruler'`).
- **Skippy** — parts `sk_body/sk_arm/sk_foot_l/sk_foot_r` (sliced from a user sheet); exclusive weapon = **Jump Rope** (`id:'whip'` — the original lash, renamed).

**Weapon exclusivity:** each hero starts with their special weapon and can NEVER roll the other's. Enforced in BOTH `showPowerUpSelection` (level-up cards) AND `spawnPowerUp` (dropped boxes) via `otherSpecials` exclusion. The 6 shared weapons (wand/orb/axe/cross/water/knife) are available to both.

Portraits for the menu are composited by `vs_make_portraits.js` (`portrait_monitor.png` / `portrait_skippy.png`) — body + weapon arm at the exact in-game mount.

### The Ruler (Class Monitor) — slash + electric arc
- **Slash:** a baked 12-frame sprite-sheet crescent VFX (`sprites/vs/fx_slash_sheet.png`, 4×3 × 512px, generated by `vs_make_fx_slash.js`). Shape = thin start → thick belly → tapered end; spans ±117° (~65% of a circle, tips curl slightly behind); tail-first receding dissolve. In-game: two sprites (NORMAL + ADD blend) play the `slashfx` anim (30fps, play-once, destroy on complete), single-instance guarded (`this._slashImgs`), placed in front (flipX for facing). Damage MIRRORS the Jump Rope curve. Hit = frontal cone (`SLASH_HALF = 2.04` rad, reach `len` with +12% margin), reach start 165 (= half the Jump Rope's 330).
- **Electric arc (L2+):** yellow energy crescent projectile (`fx_arc` texture baked in `create()`), fired forward with each slash. Low chip damage; its job is a brief **freeze** (`stunTimer`, ~0.4s + arc tier). Carries a live lightning graphics layer redrawn each frame (`b.elecGfx`). Bosses immune to the freeze; swarm-bat velocity restored after stun.
- **Evolution ladder:** L1 slash; L2 unlock arc; then repeating 3-cycle L3/6/9 slash bigger, L4/7/10 arc bigger/further/longer-stun, L5/8/11 cooldown. Level-up card text in `WEAPON_MILESTONES.ruler`.

### Jump Rope (Skippy) = the old whip
Wide front lash at range 330, `fireWhip`/`performWhipStrike`. L2+ spawns a burning-crescent "fire wake" (the `fireWakes` group) — this is the "jump rope fireball". Damage `(15 + floor((level+1)/3)*15)*might`; cooldown speeds up every 3 levels.

### Enemies
`createEnemyAt(ex,ey,forceType)` — type 0=rat, 1=bat, 2=zombie (dropout). `enemy.enemyType` set for death SFX. Bosses via `spawnBoss(kind, opts)`.
- **Sprite-authoritative Phaser build:** setting `e.y` moves the physics body each frame. The rat "hop" uses a PRE_UPDATE un-hop to avoid body drift (critical — see memory).
- **Hitboxes match the drawn frame** (not a fixed 10px circle): zombie `r=0.42*h` nudged up to cover the head, bat `r=0.38*max`, rat `r=0.36*max`.
- Anim keys per enemy: `animLoop/animWalk/animWindup/animLunge/animHit/animDead`, `texScale`, `hop`, `dmgMult`, `isBoss`, `isFinal`.
- Hit-flash is **single-flash guarded** (`enemy._hitFlash`) + per-frame opacity self-heal — otherwise stacked yoyo alpha tweens ratchet a boss permanently translucent.

### Bosses & win/lose
- Regular boss every 300 kills = **backpack** zombie (`enemy_bp_*`), bucket-sized, 25× enemy HP.
- **Final boss** at 10 min *played (HUD survival) time* = **bucket** (`enemy_boss_*`): ×1.4 size, ×3 HP, ×2 contact damage, `isFinal`.
- Killing the final boss → Chinese **victory menu** (`#vsVictoryMenu`): 继续挑战 (keep playing current build till death) / 结束本局 (end → congrats game-over). `wonGame` flag drives the game-over title/message.
- Boss combat: `attackRange 200`, lunge speed 540 (reaches the range), knockback/stun immune.
- **Session-count rule:** a loss counts as a completed session only if HUD survival time (`accumulatedTime`, excludes minigame/question overlays) ≥ 2 min. Wins always count. (Gomoku/UNO keep their own rule — do NOT change them; their question time IS game time.)

### Walking puzzles (ESL)
Boxes spread in a ring (`205 + (i%2)*100`), tap tracker = UNDO last collected token (repeat to remove more), silent; audio replays only when the dock is empty. Subtle "correct-letter magnet": next-needed token boxes get +15% walk-on radius, wrong −15%, and a correct box always wins when overlapping a wrong one.

### Anti-flee (young learners run away)
Elastic playground fence (arenaRadius 1800), enemy wall ahead when fleeing too long, star magnet, bigger stars, onboarding power-up dropped next to the player at start.

---

## 4. AUDIO (game.js)

Two layers:
1. **Procedural WebAudio synths** (GFW-resilient, no files): `synthWhipCrack`, `synthSwoosh`, `synthPlaneHit`, `synthStab`, `synthRicochet`, `synthSmash`, `synthPageFlutter`, `synthSwordSlash`, `synthArcHum`, `synthZap`, etc. Throttled via `sfxOK(key, ms)`.
2. **Sampled SFX** — real MP3 recordings under **`sfx/`**, decoded once into WebAudio buffers by `loadSfxSample` / `playSfxSample(path, vol, dur?, throttleMs?)`. `dur` trims a clip (scissors = first 2s); `throttleMs` coalesces crowd events (and suppresses the synth fallback when throttled). All preloaded at VS scene create; synth is the fallback while loading / on failure.

Current sampled mappings & volumes: `sword-slash` 0.55 (whiff) / `sword-hit` 0.55 (connect), `paper_plane_travelling` 0.45 (launch) / `paper_plane_hit` 0.5, `book_travelling` 0.3, `scissors_travelling` 0.18 (2s trim), `tornado` 0.5, `jump_rope_fireball_hit` 0.2, `electric_arc_hit` 0.5, `bat_death` 0.3 (rats share it), `zombie_death` 0.5. "travelling" = one-shot on launch (not a sustained loop).

---

## 5. ASSET PIPELINE & CACHING

### Sprites live in `sprites/vs/` (and `sprites/td/`)
Generated from AI "Nano Banana" sheets by Node + `playwright-core` headless-Chrome **slicers**:
- `vs_slice_parts.js` (Class Monitor puppet), `vs_slice_skippy.js` (Skippy puppet + jump-rope menu icon), `vs_slice_items.js` (weapon/power-up icons), `vs_slice_enemies.js` (rat/bat; per-job key mode `magenta` or `checker`), `vs_slice_zombie_boss.js` (dropout zombie + bucket/backpack bosses; `grey`/`greyGlobal` key modes), `vs_reslice_tornado.js`.
- `vs_make_fx_slash.js` (bakes the slash sprite sheet), `vs_make_portraits.js` (char-select portraits).
- `vs_shrink_parts.js` pre-shrinks puppet parts (~0.4×) so the GPU doesn't minify NPOT textures 11:1 (mush on phones).
- Background keying auto-detects magenta / grey-checker flood-fill / greyGlobal / transparent. Frames found via connected components + masked crop (no neighbor bleed).

### AssetCache version tokens (`asset_cache.js` `GROUP_VERSIONS`)
Media is cached in **IndexedDB keyed by `<groupToken>/<path>`**. Current: `sprites/vs/ = vs-sprites-v3`, `sprites/td/ = td-sprites-v1`, `music/ = music-v1`, `sfx/ = sfx-v1`, etc.
- **`test_asset_manifest.js`** asserts every on-disk `sprites/vs/*.png` (excluding `_raw`), `sprites/td/*.png`, `music/*.mp3` and `sfx/*.mp3` is listed in the matching manifest (`VS_SPRITES` / `TD_SPRITES` / `MUSIC` / `SFX`) and vice-versa. Keep them in sync.
- **PITFALL (important):** when you re-generate a sprite **in place (same filename)**, a token bump only busts the IndexedDB layer — **HTTP/gh-proxy/CDN caches keyed by URL are NOT busted**, so devices can show stale bytes inconsistently. **Prefer RENAMING the file** (e.g. `fx_slash.png → fx_slash2.png → fx_slash3.png`), update the preload path + manifest (the in-game texture key can stay the same).

---

## 5b. CHINA HOSTING & CACHING ARCHITECTURE (2026-07-27/28 work — why assets load the way they do)

Students are in mainland China, no VPN, mostly WeChat browser. GitHub Pages is GFW-throttled
(sometimes minutes for a few MB) and WeChat aggressively evicts the HTTP cache. Everything
below exists to work around that. **Full details live in the code comments of the named files.**

### The four load paths (know which one an asset uses)
1. **Whisper speech model (41MB)** — `speech_engine.js` `MODEL_SOURCES`: **ModelScope first**
   (`modelscope.cn/models/Xenova/whisper-tiny.en/resolve/master/`, mainland CDN, CORS:*, ~2.3MB/s
   no-VPN, verified), then `gh-proxy.com`, then same-origin. Weights land in IndexedDB
   (`whisper-model-cache`). huggingface.co is blocked and NEVER contacted; ghproxy.net is dead (removed).
2. **Speech runtime lib (Transformers.js + 23MB ORT wasm)** — IMPORTED (needs real JS/wasm MIME),
   so it can never go through proxies. Served from the separate, NEVER-redeployed repo
   **`Classroom-survivors-lib`** (`vpietri-stack.github.io/Classroom-survivors-lib/tjs-v3/`, same origin).
   WHY: GH Pages ETags are `hex(deploy-mtime)-hex(size)` — every app deploy re-stamps every file,
   which used to invalidate the browser's compiled-wasm cache → **~160s recompile per device per
   deploy**. The stable repo's ETags never change, so the compile cache survives app deploys.
   `pickLibBase()` probes it and falls back to the app's own `lib/` copies (KEEP them).
   **RULES:** never edit files in that repo in place; upgrades = new `tjs-vN/` folder (lib+wasm are a
   version-locked PAIR) + bump `STABLE_LIB_BASE`; don't push to it for any other reason (see its README).
3. **Runtime media** (game sprites, vocab images, hand-recorded `audio_mp3/`, `music/` BGM, `sfx/`
   recordings) — `asset_cache.js` (§5): gh-proxy mirror → same-origin fallback → IndexedDB forever.
   Game manifests + BGM + SFX prefetch 2s after page load; the current teaching page's vocab
   images/MP3s prefetch at login (auto-derived from `TEACHING_CONTENT`, zero maintenance).
   Consumers resolve via `AssetCache.url()` (sync, Phaser preloads / `<img>`) or `getBlobUrl()`
   (async, seeds cache): VS/TD `preload()`, `showVocabImage`, `bgm.js`, `loadSfxSample`, char-select imgs.
4. **Word/phrase audio chain** (`game.js` `playTTS`): **cached local MP3 → Youdao TTS (1s timeout) →
   MP3 via gh-proxy (seeds cache) → Baidu TTS (robotic, last resort) → browser speechSynthesis**.
   The teacher's recordings are preferred because Youdao mangles long phrases/word-pairs.
   MP3 filenames = exact phrase text (sanitized of Windows-illegal chars) + `.mp3`.

### Speech debug panel (`speech_debug.js`)
Always-present 🐞 button bottom-left (state-colored dot: blue loading / purple compiling / green
ready / red error); tap toggles the full panel (mirror, %, rolling `__speechLog`). Round E logs
"Gate skipped: state=…" when the speech gate silently skips — first thing to check when
"speech isn't prompting".

### Speech first-load economics (field-measured, no VPN)
Download via ModelScope ≈ seconds; WASM compile ≈ 160s per device (CPU-bound, unavoidable);
repeat visits ≈ instant while caches hold. WeChat cache eviction can still force a recompile.

### EdgeOne Pages (Tencent) — parked, awaiting custom domain
Project `classroom-survivors-preview` (intl account, region "Global (MLC excluded)") auto-deploys
from the preview repo, but the free `*.edgeone.dev` domain **returns 401 to mainland visitors by
design** — a custom domain (no ICP needed for that region) is required to actually serve students.
Also pending if revived: `.mjs` served as `application/octet-stream` (breaks module imports; needs
an `edgeone.json` header override), missing CI-injected `app-config.json`, and a compile command
that strips the >25MiB model files (`find . -type f -size +25M ! -path "./.git/*" -print -delete`).

### gh-proxy caveats
Free third-party proxy — fine as a mirror, never as a sole source (ghproxy.net died mid-project).
Proxies serve `.js/.mjs` as `text/plain`, so **imported code can never be proxied** — only fetched
bytes (model weights, images, audio).

---

## 6. HiDPI / RETINA RENDERING (the delicate part) — READ CAREFULLY

**Problem:** the Phaser canvas rendered at CSS-pixel resolution (DPR-unaware), so on phones (DPR 2–3) it was upscaled by the browser → blurry. Gomoku's fixed-600 canvas had the same class of issue.

**Solution — all three games now render at up to 2× DPR (capped for horde perf):**

### boot.js (shared Phaser canvas: VS + UNO)
- `vsDpr()` → `min(2, max(1, devicePixelRatio))`.
- `enterHiDpi(targetEl?)` → `Scale.NONE`; `game.scale.setZoom(1/dpr)`; size backing to `target × dpr` (target = window for VS, `uno-phaser-container` for UNO); `refresh()`. A window `resize` listener re-applies. `_hiDpiEl` remembers the current target.
- `exitHiDpi()` → remove listener, `setZoom(1)`, `Scale.RESIZE`, **clear the canvas inline `width/height/margin`**, `resize(window)`, `refresh()`.

**Why this exact shape (hard-won):**
- **Drive display size through the ScaleManager's `zoom` (1/dpr), NEVER set `canvas.style` manually.** Manual styling leaves `game.scale.displayScale` stale at 1 → pointer coords mis-scale → the VS joystick threshold `pointer.y > scale.height*0.5` never fires (can't move) AND the corrupt scale state propagates to other scenes (UNO cards laid out wrong). Diagnose with `game.scale.displayScale.y` (must equal DPR).
- **`exitHiDpi` must clear the inline canvas style** — `Scale.NONE+zoom` leaves an inline px style that `RESIZE` does NOT reset; otherwise a following game keeps the wrong display size (stretched/offset canvas).
- A **static** scene camera (UNO) zooms around its center, so at zoom 2 with default scroll it shows world `[w/4, 3w/4]` and the CSS-space layout's left/top half falls off-screen → **must `camera.centerOn(cssW/2, cssH/2)`**. VS is exempt because its camera follows the player.

### Per-scene contract (both VS and UNO)
- `this.scale.width/height` become the **backing** size (`CSS × dpr`). Read layout in **CSS space** = `this.scale.width / vsDpr()`.
- Set the **scene camera zoom** so the world stays in CSS-equivalent units: VS uses `fit × dpr`; UNO uses `dpr` (+ `centerOn`).
- VS helpers: `cw()/ch()` (CSS dims), `hudX()/hudY()` (place a `scrollFactor(0)` HUD element at a CSS screen coord, compensating for the camera-zoom pivot — used for the combo counter & BOSS-warning text).

### Gomoku (own 2D canvas)
`drawGomokuBoard()` sizes `gomokuCanvas.width/height = clientWidth × dpr` each draw. Everything is drawn relative to `gomokuCanvas.width` and clicks map via `canvas.width/rect.width`, so it **self-scales with zero coordinate math**.

### Game transitions (must stay correct)
- `triggerVampireSurvivors` → `enterHiDpi()` (window). Restores canvas `display:''`.
- `triggerUno` → re-show canvas (`display:''`), `enterHiDpi(uno-phaser-container)`. (UNO used to leave the canvas `display:none` after the menu → invisible cards; fixed.)
- `triggerGomoku` → `exitHiDpi()` (drops the listener; Gomoku uses its own canvas).
- `showGameSelection` / `exitVampireSurvivors` → `exitHiDpi()` + hide canvas.

---

## 7. TESTING (headless Chrome via playwright-core)

Chrome path in scripts: `C:/Program Files/Google/Chrome/Application/chrome.exe`. Server: `npx http-server -p 8080 -c-1 --silent` (background). Pattern: goto `http://localhost:8080/index.html`, wait, `page.evaluate(() => triggerVampireSurvivors())`, inspect via `evaluate`, screenshot. To see the game in a screenshot, hide the login/DOM overlays: `document.querySelectorAll('body > div').forEach(d => { if(!d.querySelector('canvas')) d.style.display='none'; })`.

Key scripts (run with `node <file>`):
- `test_asset_manifest.js` — sprite/audio/music manifest ↔ disk (expect `RESULT: PASS`, 130).
- `vs_dpr_test.js` — HiDPI at deviceScaleFactor 1/2/3 (backing, style, zoom, world-point).
- `vs_input_uno_test.js` — VS joystick (real mouse drag) + UNO cards visible after VS.
- `vs_uno_transition_test.js` — VS→UNO canvas state.
- `vs_charselect_test.js`, `vs_boss_test.js`, `vs_hitbox_test.js`, `vs_puzzle_test.js`, `vs_bosscombat_test.js`, `vs_sfx_samples_test.js`, `vs_bat_check.js`.
- `tmp_gif_frames.js <in.gif> <out.png>` — decode a GIF into a frame contact-sheet (reusable for reference art).
- **All should report `ERRORS []` / `RESULT PASS`.** Also `node --check <file>.js` for syntax before committing.

**Note:** the `browser-use` MCP is currently unusable in this environment (0×0 viewport → hangs). Use `playwright-core` for browser verification instead.

---

## 8. KNOWN PITFALLS (learned the hard way)

1. **HiDPI via ScaleManager `setZoom`, never manual `canvas.style`** (stale `displayScale` breaks input + shared scenes). §6.
2. **`exitHiDpi` must clear inline canvas style** (RESIZE won't reset a NONE+zoom style).
3. **Static camera + zoom needs `centerOn`** or half the layout goes off-screen.
4. **Re-baked in-place assets get served STALE by HTTP/CDN caches** — rename the file, don't just bump the IndexedDB token.
5. **Phaser build is sprite-authoritative** — mutating `e.y` drifts the physics body; use a PRE_UPDATE un-offset for effects like hop.
6. **Repeating yoyo alpha tweens stack** and ratchet opacity down (boss goes translucent) — single-flash guard + restore.
7. **PowerShell**: `;` not `&&`; no `tail`/`grep`.

---

## 9. OPEN ITEMS / NEXT STEPS

- **User is testing tomorrow (2026-07-30) on phone + PC.** Expected to verify: VS movement (joystick), UNO cards visible in all paths, and crispness of VS / UNO / Gomoku at real device DPR. Await feedback.
- Possible tuning after playtest: HiDPI 2× cap could be raised if a device still looks soft (one number in `vsDpr()`); slash/arc feel; SFX volume balance; final-boss ×2 damage.
- TD (Tower Defense) is still in development (gated off live).
- If any HiDPI transition misbehaves on a real device, first log `game.scale.displayScale.y` (must == DPR) and the canvas `getBoundingClientRect` vs its container.

---

## 10. QUICK START FOR THE NEXT SESSION

```
cd "d:\coding\html games\Classroom-survivors"
npx http-server -p 8080 -c-1 --silent   # background; serves the app
# edit files, then:
node --check vampire_survivors.js        # syntax
node test_asset_manifest.js              # asset manifest
node vs_input_uno_test.js                # VS input + UNO cards
git add <files>; git commit -m "..."; git push preview preview:main
```

Always confirm a change with a headless screenshot before claiming it works. Keep `preview/main` the only target.
