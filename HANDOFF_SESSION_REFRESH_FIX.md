# HANDOFF — Classroom Survivors: forced page-refresh / session-loss thread (Doris)

**Date:** 2026-08-26
**Author:** Investigation agent (scheduled task + follow-ups)
**Audience:** Next coding agent. Read top-to-bottom. "Current State" is ground truth (verified
against `git log` + live-site fetches on 2026-08-26). Supersedes the deployment-gap sections of
`HANDOFF_SESSION_FIX_FULL.md` (that gap no longer exists — see §2).

---

## 0. TL;DR

Student `doris_zhangyanyi` (iPad 11, iOS 26.6, WeChat in-app browser AND Safari, LIVE URL) lost
EVERY completed session since 2026-08-21 and saw the page "force-refresh" each time. Root cause,
proven by her mum's video on 2026-08-26: **iOS WebKit terminates the page's WebContent process
(Safari shows “此网页已重新载入”) and auto-reloads — MID-SESSION, with no JS running at the kill.**
The app's vulnerability: the completion record was shipped fire-and-forget, so the kill ate it.

**Fixed & deployed (LIVE, stamps `2026-08-25a` → `2026-08-26b`):**
1. Completion flush is now AWAITED (deadline-capped) before every end screen renders.
2. `saveActiveUserToCache` hardened against QuotaExceededError.
3. Restart telemetry: kill-surviving breadcrumb + page-session stamps + restart diagnostic events.
4. Device signature in the breadcrumb (iPhone-vs-iPad experiment support).

**NOT yet solved:** the WebKit kill itself (trigger unknown; telemetry is collecting evidence).
Full report: `SESSION_REFRESH_ROOTCAUSE_2026-08-25.md` (incl. §7 round-2 update).

---

## 1. Repository layout (unchanged — re-read if new)

- ONE local repo, TWO remotes: `origin` = LIVE (`vpietri-stack/Classroom-survivors`),
  `preview` = PREVIEW (`Classroom-survivors-preview`). Both share ONE Azure SWA + Cosmos DB.
- ⚠️ Ambiguous refname: local branch `preview` vs remote `preview/main`. Use full refs:
  `refs/heads/preview`, `refs/remotes/preview/main`.
- Deployment = merge local `preview` INTO local `main`, `git push origin HEAD:refs/heads/main`,
  then keep local `main` and `preview` identical (fast-forward `preview` to `main` or vice versa).
- GFW intermittently resets pushes to port 443 — retry 3–5× with ~1 min gaps; it clears.
- PowerShell only (no `&&`). Keep git commands SHORT — very long PowerShell one-liners crash the
  sandbox terminal's PSReadLine and silently drop later commands in the chain.
- ⚠️ A PARALLEL SPEECH-RECOGNITION SESSION sometimes commits in this same worktree (seen 2026-08-26:
  `db29d74`, `a8ca864`). NEVER `git add -A`/`git add .` — stage explicit paths, and check
  `git status` before committing; expect their uncommitted edits in `speech_*.js`/`index.html`.
  `api/speech_events_dump_full.json` is their untracked working file — leave it alone.

## 2. Branch state (verified 2026-08-26)

- The July session-fix "deployment gap" (LIVE had fixes, PREVIEW didn't) is OBSOLETE: branches
  re-converged 2026-07-31 (`edf0577`); since then preview ⊆ main by ancestry.
- As of this handoff: `main` = `preview` = `origin/main` = `preview/main` should all sit at the
  handoff commit (previous landmark: `fdcb1ee` = device-signature telemetry `2026-08-26b`).
  Verify with `git rev-parse refs/heads/main refs/heads/preview origin/main preview/main`.
- LIVE + PREVIEW both serve the same build stamps; verify with
  `https://vpietri-stack.github.io/Classroom-survivors[-preview]/version.json`.

## 3. What happened (two rounds)

### Round 1 (2026-08-25, scheduled investigation)
- Server evidence (Cosmos, read-only): Doris's exercise events arrived Aug 22/24 but ZERO session
  events; last good session 2026-08-21. Whole-cohort check: she is the ONLY affected student.
  Device events prove she ran the current build — not stale cache. No reload code exists anywhere
  in the student paths → the refresh is environment-level.
- Fix (`7eb219e`, stamp `2026-08-25a`): `flushAnalyticsWithDeadline(maxMs)` in `frontend_auth.js`;
  `finishStudySession`/`populateGameOver`/`endUno`/`endGomokuGame` AWAIT delivery (4 s cap) before
  rendering end screens; `saveActiveUserToCache` never throws (quota → trim analytics mirror to
  last 500). Regression suite `test_session_flush_deadline.js`. Merged to LIVE 2026-08-25 (`aee7c40`).

### Round 2 (2026-08-26, video evidence)
- Mum's video: mid-Round-D drag → Safari banner **“此网页已重新载入”** → profile screen, all <1 s.
  That banner = WebContent process KILLED + auto-restore. Kills happen MID-SESSION, and server data
  showed ZERO events on 2026-08-25/26 — not even the login `device` event — so some kills strike
  at/near page start, before the first ~2 s flush.
- A killed process runs no JS (no pagehide, no flush), so shipped RESTART TELEMETRY
  (`fdcb1ee`, stamp `2026-08-26b`), all additive:
  - `csNewPageSession()` / `csPageHeartbeat(state)` in `frontend_auth.js`: page-session id (`ps`)
    stamped onto every queued event; localStorage breadcrumb `csPageHeartbeat` (mode/round/last
    exercise/time-since-page-load/build stamp/device signature) updated on every queued event and
    every `updateStudyUI` round change.
  - `pagehide` sets `csCleanUnload=1` so only TRUE hard kills report.
  - On next student login, `csDetectRestartAndQueueDiagnostic()` queues ONE dashboard-invisible
    `type:'device', diagnostic:'restart'` event (carries `secondsSinceLastEvent`,
    `secSincePageLoad`, `pageState` incl. `dev` signature, build stamp).
  - Device signature format in `pageState.dev`: `platform|tp<touchpoints>|wx|br`
    (e.g. `iPad|tp5|wx`, `MacIntel|tp5|br` = iPadOS Safari, `iPhone|tp5|wx`).
- Ruled out: speech-engine memory as a Doris-unique factor (~55 students use speech heavily).

## 4. Current state / what is LIVE

- Completion records survive the completion-time race (round-1 fix) — end screens wait for the
  server ACK; worst case 4 s, then the persisted queue drains on next login.
- Telemetry is LIVE and collecting. Doris's mum is now also testing her IPHONE (teacher-initiated
  isolation experiment) — diagnostics self-describe the device via `pageState.dev`.
- Doris's Aug 22/24 sessions are unrecoverable client-side; teacher may adjust her weekly target
  via dashboard `manualOffset` (current target `t_1787531803987_u2jyxb` already carries offset 5).

## 5. Open work (prioritized)

### P0 — Interpret the restart diagnostics (after 1–2 days of data)
Query Doris's doc for `diagnostic:'restart'` events (see `api/check_db2.js` for the Cosmos pattern;
write a READ-ONLY script, print NO secrets, delete it after). Then:
- Kills clustered at a FIXED time-after-load → startup-path crash suspect (Whisper model preload /
  IndexedDB/Cache writes in `speech_preload.js`/`asset_cache.js`). Consider targeted mitigations
  (e.g. lazy preload on her device class) — additive only, preview first.
- Kills spreading with session length → memory pressure suspect → profile asset/WASM footprint.
- Split by `pageState.dev`: iPad vs iPhone vs wx/br. If iPhone is clean → device-specific
  (her iPad's storage/WebKit state); ask family to clear Safari website data / storage as a test.

### P1 — Keep watching the teacher dashboard
Doris's sessions should now record on completion. If losses persist AFTER diagnostics confirm
login-time delivery, escalate to more frequent in-session flushes (the 2 s debounce already caps
mid-session loss to ≤2 s of exercise events).

### P2 — Hygiene
- One-tap update banner may show on stale pinned builds when stamps advance — intended self-heal.
- `DEPLOY_VERSION_STAMP.md` discipline: bump `version.json` + `APP_VERSION` + `index.html ?v=`
  tags TOGETHER (current: `2026-08-26b`).

## 6. Gotchas that bit this thread

- **Long PowerShell one-liners crash the sandbox terminal** (PSReadLine buffer exception) and the
  remaining chained commands silently DON'T RUN — even though earlier ones did. After any chained
  deploy, RE-VERIFY each ref with a fresh short command. (Happened twice on 2026-08-26.)
- `git push` prints progress on stderr → PowerShell shows a scary red "NativeCommandError" even on
  success. Judge by the `oldsha..newsha  HEAD -> main` line, not the exit-code drama.
- `git push preview HEAD:refs/heads/main` (explicit refspec) — NOT `git push preview preview`.
- A concurrent speech session may land commits in the same worktree mid-task; re-check
  `git status`/`git log` right before staging, and run `npm test` on the ACTUAL tree before push.
- Never merge `origin/main` wholesale onto preview (speech/TD divergence rule still applies to
  future feature work even though branches are currently converged).

## 7. Key file references

- `SESSION_REFRESH_ROOTCAUSE_2026-08-25.md` — full root-cause report (§7 = round 2).
- `frontend_auth.js` — `flushAnalyticsWithDeadline` (~line 425), restart-telemetry block after
  `scheduleAnalyticsFlush`, hardened `saveActiveUserToCache`, telemetry wiring in `finishLogin`.
- `study_mode.js` — `finishStudySession` (awaited flush), `updateStudyUI` (round breadcrumb).
- `vampire_survivors.js` / `uno.js` / `gomoku.js` — awaited deadline flush at game over.
- `test_session_flush_deadline.js` — 32 regression tests (deadline flush, quota hardening,
  restart telemetry, device signature); part of the mandatory `npm test` chain.
- `version.json` + `APP_VERSION` — deploy stamp (`2026-08-26b`).

## 8. Definition of DONE for this thread

- [ ] Restart diagnostics from Doris collected AND interpreted (P0 verdict: startup-crash vs memory
      vs device-specific, split by iPad/iPhone/WeChat).
- [ ] Trigger-level fix shipped via standard preview→main deploy (or documented as OS-level
      unfixable with mitigations in place).
- [ ] Teacher confirms Doris's completed sessions record on LIVE for ≥1 week without loss.
- [ ] No regressions in the mandatory suite (currently 81+22+11+32+11+23+154).

---
*Previous handoff in this lineage: `HANDOFF_SESSION_FIX_FULL.md` (July beacon-401 / WeChat fixes —
all still in place and now on BOTH branches).*
