# Classroom Survivors — Project State Handoff
**Generated:** 2026-07-21  
**Purpose:** Full context export for continuing work in QoderCN.

---

## 1. Project Overview

**Classroom Survivors: ESL Edition** is a browser-based educational game (Phaser 3 + vanilla JS) for Mainland China students learning English. It runs entirely client-side on GitHub Pages — no backend for gameplay. Students behind the GFW access it via WeChat browser, Safari, and Chrome on mobile devices (Android phones, iPads).

- **Live production:** https://vpietri-stack.github.io/Classroom-survivors/ (origin/main)
- **Preview/testing:** https://vpietri-stack.github.io/Classroom-survivors-preview/ (preview/main)
- **Repo (origin):** https://github.com/vpietri-stack/Classroom-survivors.git
- **Repo (preview):** https://github.com/vpietri-stack/Classroom-survivors-preview.git

---

## 2. CRITICAL: Git Workflow Rules

These rules are **strictly enforced by the user** and must NEVER be violated:

1. **NEVER** work/commit/push on `origin/main` — it updates the LIVE production page used by real students.
2. **ALWAYS** work/commit/push on `preview/main` — it updates the preview page for testing.
3. **Do NOT create new branches** — all development happens directly on `preview/main`.
4. The local branch is called `preview` and tracks `preview/main`.
5. Push command: `git push preview HEAD:main`
6. GFW causes frequent push failures ("Connection was reset", "Empty reply from server"). Use retry loops with 20s delays between attempts (up to 8 attempts).

---

## 3. Current Git State

### Branch
```
* preview  fd1b74d [preview/main]  (active, checked out)
  main     1843eb1 [origin/main]   (DO NOT TOUCH)
```

### Last pushed commit (on preview/main)
```
fd1b74d speech: tap-to-toggle record button (fixes iPad stuck-listening + Android
first-try mic error) with Cancel + 15s auto-stop; guard model compile phase with
90s timeout + auto-retry + diagnostics. Bundles in-progress Tower Defense rework
(tower_defense.js) per user.
```

### UNCOMMITTED CHANGES (ready to commit + push)
Three files modified — these are the **latest fixes from field testing** that have NOT been committed yet:

```
 index.html       |  4 ++--   (version bumps: speech_engine v3→v4, speech_ui v2→v3)
 speech_engine.js |  4 ++--   (compile timeout 90s→180s, retries 1→2)
 speech_ui.js     | 29 ++++-- (large stop button added to recording overlay)
```

**What these changes do:**
- `speech_engine.js`: `COMPILE_TIMEOUT_MS` 90000→180000, `MAX_COMPILE_RETRIES` 1→2 (field test showed mobile compile takes ~170s; first attempt always times out at 90s)
- `speech_ui.js`: Added a large circular blue stop button (80px, white square icon, pulsing concentric rings) to the recording overlay. Previously the overlay covered the screen and users couldn't tap the record button behind it to stop. Now there's a prominent stop button IN the overlay + "Cancel (discard)" below it.
- `index.html`: Cache-busting version bumps.

**ACTION NEEDED:** Commit these 3 files and push to preview/main, then field-test again.

### Untracked files (ignore — test screenshots)
Many `screenshot_*.png`, `td_*.png`, `sprites/` — these are testing artifacts, not part of the app.

---

## 4. Recent Commit History (preview/main)

```
fd1b74d speech: tap-to-toggle record button + compile timeout + TD rework bundle
947808c speech: fix rawRepoBase to detect vpietri-stack.github.io/<repo> host
12ac71b speech: harden model load (timeout + mirror fallback) + debug panel + TD bundle
076800e speech: add score + Continue button + success sound on pass
cb6f7cc speech: move Whisper from single words to full sentences
65b1d4f feat: IndexedDB model caching + audio repeat hack for short words
```

---

## 5. Speech System Architecture

The speech system runs **Whisper tiny.en** entirely in-browser via Transformers.js v3 (WASM backend). No server, no API key. Audio never leaves the device.

### File Roles

| File | Role |
|------|------|
| `speech_engine.js` | Core: model loading (mirror fallback, IndexedDB cache, compile timeout/retry), transcription, WAV decoding |
| `speech_ui.js` | UI: record button (tap-to-toggle), recording overlay (stop button + cancel), sentence gate (say-it-aloud exercise) |
| `speech_recorder.js` | Mic capture via getUserMedia + ScriptProcessor → WAV blob |
| `speech_scorer.js` | Compares transcript to target sentence, returns accuracy/pass |
| `speech_preload.js` | Kicks off model load at page boot; exposes `SpeechStatus` state machine |
| `speech_debug.js` | TEMPORARY: always-visible diagnostic panel (bottom-left), defines `window.__speechLog` |

### Model Loading Pipeline
1. `pickSource()` probes `config.json` on each mirror (6s timeout) → picks fastest
2. `patchFetchForModel()` intercepts fetch for model files:
   - Serves from IndexedDB cache if available (avoids 41MB re-download on WeChat)
   - Otherwise downloads with per-file timeout + automatic mirror fallback
3. `pipeline('automatic-speech-recognition', ...)` compiles ONNX/WASM sessions
   - **Guarded by `COMPILE_TIMEOUT_MS` (now 180s) + `MAX_COMPILE_RETRIES` (now 2)**
   - On timeout: logs, retries; after all attempts fail → throws → error state + Retry button
4. On success: `transcriber` cached, state → `ready`

### Mirror Sources (MODEL_SOURCES)
```js
[
  { name: 'gh-proxy',    base: 'https://gh-proxy.com/https://raw.githubusercontent.com/vpietri-stack/<repo>/main/' },
  { name: 'ghproxy.net', base: 'https://ghproxy.net/https://raw.githubusercontent.com/vpietri-stack/<repo>/main/' },
  { name: 'same-origin', base: '<current page URL>/' }  // GitHub Pages fallback
]
```
- `rawRepoBase()` derives owner+repo from `location.hostname` (vpietri-stack.github.io) + `location.pathname` (/Classroom-survivors-preview/)
- raw.githubusercontent.com is hard-blocked in China; the CN proxies wrap it
- Model files (~41MB total): encoder_model_quantized.onnx (10.1MB), decoder_model_merged_quantized.onnx (30.7MB), config.json

### SpeechStatus State Machine
```
idle → loading (downloading, shows %) → preparing (100%, compiling) → ready
                                                                    → error (Retry button)
```
- `SpeechStatus.isReady()` gates the speech exercise
- `SpeechStatus.retry()` calls `LocalEngine.resetLoad()` then `start()`

### Record Button (Tap-to-Toggle)
State machine: `idle → recording → busy → idle`
- **idle:** "🎙️ Tap to speak" (red button)
- **recording:** overlay shows (mic icon + bars + **large blue stop button** + "Cancel (discard)")
- **busy:** "⏳ …" (disabled, transcribing)
- Safety: 15s max-duration auto-stop timer
- Why tap-to-toggle: the OS mic-permission prompt steals the pointer gesture; hold-to-talk lost the pointerup → iPad stuck forever

### Sentence Gate (makeSentenceGate)
After a correct unscramble, student must say the sentence aloud:
- Shows target sentence + record button
- On pass: success sound + score + Continue button
- On fail: "try again" feedback; Skip button appears after 3 fails

---

## 6. Field Test Results (2026-07-21, no VPN)

### Speech Loading (model compile)
| Device | Browser | Result |
|--------|---------|--------|
| Android | WeChat | First compile times out, auto-retry succeeds (total ~170s) |
| Android | Chrome | First compile times out, **auto-retry ALSO times out** → needs manual Retry |
| iPad | WeChat | First compile times out, **auto-retry ALSO times out** → needs manual Retry |
| iPad | Safari | First compile times out, auto-retry succeeds (total ~170s) |

**Fix applied (uncommitted):** timeout 90s→180s, retries 1→2. This should let the auto-retry succeed within 180s on all devices.

### Record Button
| Device | Browser | Old behavior | Fix |
|--------|---------|-------------|-----|
| iPad | WeChat/Safari | Stuck "listening" forever (overlay blocks button) | Large stop button IN overlay |
| Android | Chrome/WeChat | First-try error (permission race) | Tap-to-toggle (no gesture to lose) |

**Fix applied (uncommitted):** Large blue circular stop button (80px, white square, pulsing rings) added to the recording overlay. "Cancel (discard)" button below it.

---

## 7. Key Technical Constraints (GFW)

- `raw.githubusercontent.com` — hard-blocked in China
- `huggingface.co` — blocked (Transformers.js default CDN unusable)
- `gitee.com/pages` — discontinued
- `hf-mirror.com` — redirects big files back to blocked huggingface.co
- `jsdelivr.net/gh/` — caps at 20MB → 403 on our 30MB decoder
- `gh-proxy.com`, `ghproxy.net` — CN proxies that wrap raw.githubusercontent.com, serve full 30MB with CORS:*, no size cap
- WeChat browser aggressively evicts HTTP cache → IndexedDB model cache is critical
- GitHub Pages deploy takes ~15-60s after push; use `?v=N` query strings for cache-busting
- MIME: proxies serve .js/.mjs as text/plain → browser refuses `import()`. So the ESM lib (`lib/transformers.min.js`) + WASM glue stay same-origin; only model WEIGHTS (fetched, not imported) go through proxies.

---

## 8. Other Game Systems (context)

| File | Role |
|------|------|
| `game.js` | Main Phaser game config, scene management, global helpers |
| `study_mode.js` | Study rounds (A-E): vocabulary presentation, unscramble, speech gate |
| `tower_defense.js` | Tower Defense minigame (recently reworked by user — 1223 lines changed in fd1b74d) |
| `vampire_survivors.js` | Vampire Survivors minigame |
| `gomoku.js` | Gomoku minigame |
| `uno.js` | Uno card game |
| `boot.js` | Boot/preload scene |
| `config.js` | Game configuration constants |
| `class_config.js` | Class/student configuration |
| `teaching_content.js` | Teaching content registry (imports content_pu1/2/3, content_think0/1/2) |
| `translations.js` | i18n strings |
| `frontend_auth.js` | Student login (calls Azure Functions API) |
| `admin_dashboard.js` / `teacher_dashboard.js` | Teacher-facing dashboards |

### API (Azure Functions)
Located in `api/` — Node.js Azure Functions for student auth, progress tracking. Not needed for speech work.

---

## 9. Testing

```json
{ "test": "node test_widgets_regression.js && node test_sr_once_per_session.js && node test_round_e_dedup.js && node test_td_gate.js" }
```
- Uses Playwright-core for headless browser testing
- `npm test` runs the full suite
- Local dev server: `npx http-server -p 8099 -c-1` (no cache)
- Browser MCP (browser-use) available for runtime testing: navigate_page, evaluate_script, list_console_messages, take_screenshot

---

## 10. Deployment

- Push to `preview/main` → GitHub Pages auto-deploys to https://vpietri-stack.github.io/Classroom-survivors-preview/
- Deploy takes ~15-60s; verify with cache-busted fetch (`?v=deploychkN`)
- Promotion to production = user manually merges preview→origin (NEVER do this automatically)
- `staticwebapp.config.json` exists but the site is on GitHub Pages, not Azure Static Web Apps

---

## 11. Immediate Next Steps

1. **Commit + push the 3 uncommitted files** (speech_engine.js, speech_ui.js, index.html) to preview/main
2. **Field-test again** on real devices:
   - Verify compile now succeeds within 180s auto-retry (no manual Retry needed)
   - Verify the large blue stop button in the overlay clearly stops recording
   - Test on: Android (WeChat + Chrome), iPad (WeChat + Safari)
3. **If compile still fails:** may need to increase timeout further or add a "warming up" progress indicator
4. **Eventually:** remove `speech_debug.js` diagnostic panel once loading is reliable

---

## 12. The Uncommitted Diff (exact)

```diff
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -655,8 +655,8 @@
-    <script src="speech_engine.js?v=3"></script>
-    <script src="speech_ui.js?v=2"></script>
+    <script src="speech_engine.js?v=4"></script>
+    <script src="speech_ui.js?v=3"></script>

diff --git a/speech_engine.js b/speech_engine.js
--- a/speech_engine.js
+++ b/speech_engine.js
@@ -88,8 +88,8 @@
-  const COMPILE_TIMEOUT_MS = 90000; // tunable; first-load compile can be slow on low-end devices
-  const MAX_COMPILE_RETRIES = 1;    // one auto-retry after a compile timeout
+  const COMPILE_TIMEOUT_MS = 180000; // field-tested: mobile compile takes ~170s; 180s per attempt
+  const MAX_COMPILE_RETRIES = 2;    // up to 3 total attempts (some devices need 2 warmup rounds)

diff --git a/speech_ui.js b/speech_ui.js
--- a/speech_ui.js
+++ b/speech_ui.js
(Adds .rec-stop-wrap, .rec-stop-ring, .rec-stop-btn CSS;
 adds stop button HTML to overlay;
 wires _onOverlayStop handler;
 clears _onOverlayStop in toIdle() and finishRecording())
```

---

## 13. Suggested Commit Message (for the uncommitted changes)

```
speech: increase compile timeout to 180s + 2 retries (field-tested: mobile needs ~170s);
add large stop button to recording overlay (blue circle + white square + pulsing rings)
so users can clearly end recording without waiting for the 15s auto-stop.
```

---

## 14. User Preferences & Communication

- User is a teacher building this for their students in China
- User tests on real devices (Android phone + iPad) without VPN, in WeChat/Chrome/Safari
- User sends screenshots from devices as field-test evidence
- User prefers concise communication
- User bundles their own Tower Defense WIP with speech commits (approved explicitly)
- The diagnostic panel (speech_debug.js) should stay ALWAYS VISIBLE during this debugging phase
