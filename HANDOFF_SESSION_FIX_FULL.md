# HANDOFF — Classroom Survivors: session-recording data-loss thread (Lucas → WeChat)

**Date:** 2026-07-23
**Author:** Hermes Agent (this thread)
**Audience:** Overnight coding agent. Read top-to-bottom. The "Current State" + "Commit Timeline" sections are ground truth (verified against `git log`); the "What happened" narrative is reconstructed from commit history + the verified WeChat diagnosis. Do not assume — verify against the repo before changing anything.

---

## 0. TL;DR (the verdict for the teacher)

Over ~2 days we chased a chain of "student sessions not being recorded" bugs, each caused by a *different* silent data-loss path. All are now **fixed and deployed on LIVE** (`origin/main` = `d834e12`). The only remaining work is **porting the fix to PREVIEW** (`preview/main` = `7e05aa7`, stale) and one un-fixed gap (startup queue drain). See §7.

Root causes, in order found:
1. **Lucas** — student greeting/target meter didn't match the teacher dashboard (display, not data-loss).
2. **Beacon 401** — the unload `sendBeacon` flush sent the auth token in a header Azure SWA strips → 401 → queued events dropped.
3. **Stale cache** — GitHub Pages served cached JS; students on old builds 401'd.
4. **WeChat** — iPhone in-app browser is a WKWebView: **no Service Worker + aggressive caching** → pinned to a pre-fix build → silent 401 drops. The SW fix couldn't reach it. Fixed with a `version.json` watchdog (SW-independent) + `keepalive` save + anti-cache meta.

---

## 1. Repository layout (CRITICAL — read first)

- **Repo root:** `D:\coding\html games\Classroom-survivors`
- **ONE local git repo, TWO remotes:**
  - `origin` → LIVE repo (`vpietri-stack/Classroom-survivors`). `origin/main` = LIVE `https://vpietri-stack.github.io/Classroom-survivors/`
  - `preview` → PREVIEW repo (`Classroom-survivors-preview`). `preview/main` = PREVIEW `https://vpietri-stack.github.io/Classroom-survivors-preview/`
- **No separate working copy for preview.** Preview is a *remote* in this same repo. Inspect with `git show preview:frontend_auth.js`, NOT a folder.
- ⚠️ **Ambiguous refname:** a local branch `preview` AND remote `preview/main` both exist. Bare `preview` triggers `warning: refname 'preview' is ambiguous`. Disambiguate: `refs/heads/preview` (local), `refs/remotes/preview/main` (remote). The local `preview` branch head = `7e05aa7` (matches `preview/main`).
- ⚠️ **Deploy is NOT isolated.** Both remotes share ONE Azure Static Web App (`Val-ESL`) + ONE Cosmos DB (`Val-EslApp`/`Students`). A "preview" push hits the SAME live URL and writes REAL student PII. Confirmed via `az`. Treat preview as live-for-data.
- **Shell:** bash (git-bash/MSYS), NOT PowerShell. Use Windows-style absolute paths (`D:\coding\...`); POSIX `/d/coding/...` mis-resolves. Single-quoted strings.

---

## 2. Commit timeline (authoritative — `git log`)

| Date | SHA | What |
|------|-----|------|
| 2026-07-22 | `2d20ece` | **fix(target-meter):** align student greeting meter with teacher dashboard (Lucas report) |
| 2026-07-22 | `f0188b3` | **fix(beacon):** ship auth token in body so unload flush authenticates on Azure SWA |
| 2026-07-23 | `ce2ccc3` | **fix(cache):** self-healing update — Service Worker + `?v=` version-bust + 401 reload banner |
| 2026-07-23 | `b8eaeb2` | **fix(wechat):** SW-independent self-heal — `version.json` watchdog + `keepalive` save + anti-cache meta |
| 2026-07-23 | `d834e12` | **docs(deploy):** `DEPLOY_VERSION_STAMP.md` + inline warnings (the stamp discipline) |

(Plus earlier commits in history: `7553ca5` silent-loss fix, `9139c7f` X-Auth-Token header fix, `0745bdb`/`c787318` admin-role gates, `2aa2e8d` testMode bypass gated behind `TEST_MODE` — all context, not this thread's core.)

**LIVE = `d834e12` (fully deployed + verified). PREVIEW = `7e05aa7` (HAS `ce2ccc3` SW/cache-bust; MISSING `b8eaeb2` + `d834e12`).**

---

## 3. What happened, step by step

### 3.1 Lucas — target-meter mismatch (display bug, `2d20ece`)
A student ("Lucas") reported his greeting/target-progress meter on the student screen didn't match what the teacher saw on the dashboard. **This was a display/consistency bug, not data loss.** Fixed by aligning the meter computation with the dashboard's. **Verify:** `npm run test` includes target-meter consistency tests (the suite checks greeting meter vs dashboard). No data was lost for Lucas.

### 3.2 Beacon 401 — silent drop on unload (`f0188b3`)
The unload/`pagehide` flush (`flushAnalyticsViaBeacon`) used `sendBeacon` / `fetch` with the session token in the `Authorization` (or `X-Auth-Token`) **header**. Azure SWA's managed-functions proxy **overwrites/strips** that header, so the server saw no token → **401** → the queued analytics events were dropped (or re-queued forever). **Fix:** ship the auth token **in the request body** (`body` includes the credential the server expects) so the unload flush authenticates. (This is the same "SWA strips `Authorization`" class of bug as `9139c7f` — the client token must travel as `X-Auth-Token`/`?authToken=` for normal calls, and in the body for the beacon.)
- ⚠️ **iOS WebView beacon caveat:** `sendBeacon`/`visibilitychange` fetches are killed on fast tab close in iOS WebViews. The live `keepalive` POST (§3.4) is now the primary path; the beacon is a backstop only.

### 3.3 Stale GitHub Pages cache (`ce2ccc3`)
Even after fixes shipped, students on **old cached JS** still 401'd because GitHub Pages serves scripts with **no `?v=` cache-bust** — a reload reused stale `.js`. **Fix:**
- Added a **Service Worker** (`sw.js`) that intercepts fetches and serves fresh assets.
- Added `?v=APP_VERSION` stamps to non-speech `<script>` tags in `index.html` (bump on each frontend change).
- Added a **401 reload banner**: when a save returns 401 (stale/expired build), show "⚠️ App needs an update to save progress — tap here to reload" → tap reloads fresh build.
- Verified live via real browser (SW registered/activated/controlling; banner renders).

### 3.4 WeChat — the root cause that 401'd Doris (`b8eaeb2`)
A student ("Doris") did 3 sessions ~10 min before the report but they never reached the teacher dashboard (last recorded session was 10 Jul; report was 23 Jul). Screenshots confirmed she was on the win screen, presumably via WeChat's iPhone in-app browser.

**Root cause (verified via web research + browser inspection):**
1. **WeChat iOS = WKWebView → `navigator.serviceWorker` is UNDEFINED.** The SW from §3.3 never installs → the self-heal does nothing for her.
2. **WeChat aggressively caches `index.html` + JS and ignores `Cache-Control`.** She was pinned to a pre-`ce2ccc3` build that sent a header Azure strips → **401** → save silently dropped. The 401 banner lives in the *new* build she never loaded.
3. **Unload beacon killed** on fast close (win screen → switch to chat → close <2s).

**Fix (all additive, SW-independent):**
- **`version.json` watchdog** (`startVersionWatchdog()` ~`frontend_auth.js:456`): polls `version.json` with `fetch('version.json?v='+Date.now(), {cache:'no-store'})` every 60s (first tick 5s after load). `_versionGreater(live, running)` compares `YYYY-MM-DD[letter]` stamps. If live > running → `registerUpdateBanner('version-watchdog')` → same reload banner. Tap reloads `index.html`; every `<script>` is `?v=APP_VERSION`-stamped → fresh JS pulled. **This is the only self-heal that reaches WeChat.**
- **`keepalive: true`** on the live `flushAnalytics` → `saveAnalytics` POST (~`frontend_auth.js:305`): survives a fast tab close.
- **Anti-cache `<meta>`** in `index.html` `<head>` (`no-cache, no-store, must-revalidate` / `Pragma: no-cache` / `Expires: 0`): nudges WeChat to revalidate on reload.

**Verification done:** 118 tests pass; Node unit-test of `_versionGreater` 7/7 PASS; real-browser confirms `registerUpdateBanner('version-watchdog')` renders the banner (visible); `curl` live `frontend_auth.js` shows watchdog + `keepalive`; live `version.json` serves `2026-07-23c`. Canary test (bump `version.json` higher → banner appears → reverted) confirmed the path without leaving a permanent banner.

### 3.5 Docs (`d834e12`)
Added `DEPLOY_VERSION_STAMP.md` + inline warnings at `APP_VERSION` and `version.json` so future agents bump both stamps together.

---

## 4. The deploy-stamp discipline (mandatory — also in `DEPLOY_VERSION_STAMP.md`)

**On EVERY deploy, `version.json` `"version"` AND `frontend_auth.js` `const APP_VERSION` MUST be bumped to the SAME new value.**
- Format: `YYYY-MM-DD` + optional lowercase letter, e.g. `2026-07-23c` → `2026-07-23d` or `2026-07-24a`.
- Mismatch = deploy bug: watchdog never fires (stale build sticks) OR permanently nags (live always newer).
- Verify after push: `curl` served `frontend_auth.js` grep `startVersionWatchdog`/`keepalive`; GitHub Pages needs ~1–2 min to build.
- Test the banner without leaving it live: canary-bump `version.json` higher, deploy, confirm in browser, then **revert both + redeploy** (or `git reset --soft HEAD~1` if push is GFW-blocked).

---

## 5. Current state (verified 2026-07-23)

**LIVE (`origin/main` = `d834e12`)** — deployed + verified:
- `2d20ece` target-meter ✓ · `f0188b3` beacon ✓ · `ce2ccc3` SW/cache-bust/401-banner ✓ · `b8eaeb2` WeChat watchdog ✓ · `d834e12` docs ✓
- Live `frontend_auth.js` serves `startVersionWatchdog` + `keepalive`. `version.json` serves `2026-07-23c`.

**PREVIEW (`preview/main` = `7e05aa7`)** — **STALE, missing the WeChat fix:**
- Has: `ce2ccc3` equivalent (SW + version-bust + 401 banner).
- **Missing:** `version.json` file entirely; `startVersionWatchdog`/`_versionGreater`/`_parseVersion`; the `keepalive:true` on `flushAnalytics` POST; anti-cache `<meta>` in `index.html`; `DEPLOY_VERSION_STAMP.md`.
- Preview `frontend_auth.js` `const APP_VERSION = '2026-07-23c'` (same stamp, but no watchdog code).

**Working tree:** clean. No uncommitted edits. (Note: `HANDOFF_WECHAT_SESSION_FIX.md` from an earlier draft is untracked — superseded by this file; you may delete it.)

**Tests:** `npm run test` → **118 passed, 0 failed** (81 + 15 + 11 + 11).

---

## 6. Architecture facts you MUST know before touching auth/API
(Condensed from the project skill `classroom-survivors-dev`; full detail there.)

- **Login is real & server-verified** (`api/src/functions/login.js`, `password === password` against Cosmos). Students already have login+password — reuse it; never invent a class code.
- **Session token** minted on login (HMAC with `SESSION_SECRET`), sent as **`X-Auth-Token`** (NOT `Authorization` — Azure SWA's proxy overwrites `Authorization`). CORS allow-headers must include `X-Auth-Token`.
- **`REQUIRE_AUTH`** is an Azure SWA app setting. Do NOT flip it true unless following the full "flip-the-lock" procedure (ship server+dashboard token fix first, verify locally, then `az staticwebapp appsettings set`). Currently leave as-is.
- **Teacher password view is REQUIRED** — store passwords in **plaintext** (teacher-only recovery path; no "forgot password"). Do NOT hash them.
- **`admin` role** must be in EVERY privileged-role gate (`PRIV_ROLES` / `isPrivileged`) — the live Val account is `admin`; a half-fixed gate silently 403s the real admin. `search_files` for `PRIV_ROLES|isPrivileged` across `api/src/functions` after any change.
- **`login?testMode=true`** is an OPEN privileged-token bypass (anyone from the GitHub Pages origin mints a teacher token, no password). **Gated behind `TEST_MODE` env flag (`2aa2e8d`) — off in prod.** Do not re-enable it.
- **Secrets:** `SESSION_SECRET` / `APP_API_KEY` / `REQUIRE_AUTH` live in Azure SWA app settings (set via `az staticwebapp appsettings set` or Portal). Never echo `COSMOS_KEY`/`SESSION_SECRET` values into chat. The `az` CLI is at `D:\azure-cli\venv\Scripts\az.bat`.
- **GitHub Pages shares the SAME backend** as the SWA — setting a secret in SWA fixes both frontends.
- **Never `git add -A` / `git add .`** — the tree accumulates stray untracked files. Stage explicit paths.

---

## 7. Overnight TODO (prioritized)

### P0 — Port the WeChat fix to PREVIEW (`preview/main`)
Preview is missing `b8eaeb2` + `d834e12`. Steps:
1. `git checkout -B preview remotes/preview/main` (full remote ref, avoids ambiguity).
2. **Do NOT `git merge origin/main` wholesale** — preview also has **speech-recognition + Tower Defense** features that LIVE does NOT (`index.html`/`frontend_auth.js` on preview include them; live gates them off). A wholesale merge would DELETE speech/TD from preview. **Cherry-pick only the WeChat-fix hunks**, or manually apply:
   - add `version.json` (stamp `2026-07-23c`, matching preview's `APP_VERSION`),
   - add `startVersionWatchdog()` + `_versionGreater()` + `_parseVersion()` and wire the `DOMContentLoaded` call,
   - add `keepalive: true` to the `flushAnalytics` `saveAnalytics` POST,
   - add the anti-cache `<meta>` block to `index.html` `<head>`,
   - add `DEPLOY_VERSION_STAMP.md`.
3. Keep `APP_VERSION` in sync with `version.json`.
4. `npm run test` (preview's own `node_modules`; use `NODE_PATH` trick if missing).
5. Push: `git push preview HEAD:refs/heads/main` (explicit refspec — NOT `git push preview preview`).
6. Verify preview live via `curl`/`browser`: watchdog + `keepalive` served, `version.json` exists, stamps match.

### P1 — Persisted-queue startup drain (gap, NOT fixed anywhere)
`flushAnalytics()` (~`frontend_auth.js:281`) early-returns if `analyticsQueue.length === 0`. The queue is persisted to `localStorage` but only re-sent when a NEW event is queued. A returning student with ONLY old unsent events (e.g. Doris's backlog from before the fix) never flushes them unless they play again. **Fix:** on `loginWithProfile` success → `finishLogin()` (~line 618), if `analyticsQueue.length > 0`, call `flushAnalytics()`. Add a regression test (simulate non-empty persisted queue + login → assert `saveAnalytics` fires). Keep KISS — don't restructure `flushAnalytics`.
- Caveat: Doris's 3 missing sessions may already be lost client-side (old build dropped them before persisting). This recovers *future* stuck students, not necessarily her backlog.

### P2 — Confirm Doris recovers
After P0 lands, ask the teacher to have Doris open the link. First load should show the update banner (stale build detected) → tap → reload → fresh build → sessions record. Teacher confirms on dashboard Sessions tab.

### P3 (optional) — Beacon belt-and-suspenders
`keepalive` covers the primary path. If desired, add a `visibilitychange` "hidden" handler calling `flushAnalytics()` (not beacon) when backgrounded. Only after P0/P1 green.

---

## 8. Gotchas that bit us this thread
- **GFW push failures:** `git push origin main` intermittently fails ("Recv failure: Connection was reset" / port-443 reset). Retry 3–5x; if persistent, ask the user to push manually (they did for `d834e12`).
- **Browser console eval blocked:** Hermes browser tool blocks JS eval unless `hermes config set browser.allow_unsafe_evaluate true`. Re-disable after (`false`). Use to verify only; never leave on. Prefer DOM-injection diagnostics over `browser_console(expression=...)`.
- **`version.json` CRLF warning:** git warns "LF will be replaced by CRLF" — harmless.
- **Preview divergence:** preview has speech/TD that live lacks — never merge live wholesale onto preview.
- **SW guard is correct:** `registerAppUpdateServiceWorker()` early-returns if `!('serviceWorker' in navigator)` — correct (WeChat has none). The watchdog is the WeChat path; don't "fix" the guard.
- **Don't trust the unload beacon on iOS** — it's a backstop; `keepalive` is primary.

---

## 9. Key file references (live = `origin/main`)
- `frontend_auth.js:13` — `APP_VERSION` (stamp) + inline warning.
- `frontend_auth.js:212,252` — `flushAnalyticsViaBeacon` (backstop).
- `frontend_auth.js:281` — `flushAnalytics()` (live `keepalive:true` @305; startup-drain gap @282).
- `frontend_auth.js:326` — `registerUpdateBanner('save-401')` (stale-build 401 path).
- `frontend_auth.js:377,393` — `registerUpdateBanner()` renderer.
- `frontend_auth.js:382` — `DOMContentLoaded` wires `startVersionWatchdog()`.
- `frontend_auth.js:456` — `startVersionWatchdog()` + `_versionGreater`/`_parseVersion`.
- `frontend_auth.js:524–618` — `loginWithProfile` → `finishLogin` (P1 insertion point).
- `index.html` `<head>` — anti-cache `<meta>` (added `ce2ccc3`/`b8eaeb2`).
- `sw.js` — the Service Worker (does NOT help WeChat).
- `version.json` — deploy stamp (`"version"` must equal `APP_VERSION`).
- `DEPLOY_VERSION_STAMP.md` — the discipline doc.
- `api/src/functions/shared/auth.js` — `REQUIRE_AUTH`, privileged-role gates, token verify.
- `api/src/functions/login.js` — `testMode` bypass (gated by `TEST_MODE`).
- `api/src/functions/saveAnalytics.js` — trusts `body.studentId` (identity scoping gap, out of scope this thread).

## 10. Definition of DONE for overnight
- [ ] Preview carries the WeChat fix (watchdog + keepalive + anti-cache + version.json + doc), speech/TD intact, `APP_VERSION` matched.
- [ ] `npm run test` green on preview (118+ if preview has extra suites).
- [ ] Startup queue-drain implemented + regression-tested (P1).
- [ ] Live + preview both verified via `curl`/`browser`: watchdog/keepalive served, `version.json` exists, stamps matched.
- [ ] No permanent "update" banner left on either site.
- [ ] Plain-language summary for the teacher (yes/no, fixed/broken).

---
*End of handoff. LIVE is complete and verified (`d834e12`). Remaining: port to preview + startup-drain gap. Do not regress the 118-test suite.*
