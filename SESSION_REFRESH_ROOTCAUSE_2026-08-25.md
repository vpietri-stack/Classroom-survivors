# ROOT-CAUSE REPORT — Forced page refresh after session completion (Doris / iPad)

**Date:** 2026-08-25
**Reporter:** Teacher Val (student: `doris_zhangyanyi`, iPad 11, iOS 26.6, WeChat in-app browser AND Safari, LIVE URL)
**Status:** FIXED on `preview/main` (pending standard preview→main deployment to reach LIVE)

---

## 1. Symptom (as reported)

- Student completes a session → completion overlay appears → page force-refreshes <1 s later.
- After the refresh she must log in again; the completed session is gone everywhere:
  in-game target meter back to 2/10, and no session row on the teacher dashboard.
- Happens on EVERY completed session, in both WeChat and Safari.

## 2. Evidence gathered

1. **Branch state:** local repo switched to the `preview` branch (= `preview/main` @ `f12a30c`).
   Verified: **preview is a strict ancestor of LIVE (`origin/main` @ `59f8d1c`)**; the only diff is
   textbook-content commits (PU3/Think). The July session-fix work (beacon 401, keepalive, WeChat
   watchdog) is present on BOTH branches — the deployment gap described in
   `HANDOFF_SESSION_FIX_FULL.md` no longer exists.
2. **Server-side (Cosmos DB, read-only query):**
   - Doris's doc: 5548 events, 281 sessions, 1.30 MB (below the 2 MB Cosmos limit), `sessionCount=200`.
   - Last session event that reached the server: **2026-08-21 01:10 UTC**.
   - **2026-08-22:** 23 exercise events arrived (study mode, ending with a `sentenceMatch`) — **0 session events**.
   - **2026-08-24:** device event + 15 exercise events arrived (study mode) — **0 session events**; stream ends abruptly mid-round.
   - Her device events show she runs the CURRENT build (`appVersion: 2026-07-29a`) on both
     WeChat WKWebView (8.0.75) and iPadOS Safari — this is **not** a stale-cache problem.
   - Auth/network are fine: exercise events from the same sessions were delivered.
3. **Cohort check (ALL students since 2026-08-21):** everyone else records sessions normally
   (jojo/lucky/andy/leon/mia etc. all have fresh session events up to 2026-08-25).
   **Doris is the only student losing sessions** → device/environment-specific, not a server or
   app-wide regression.
4. **Code trace:** there is NO `location.reload()`, `location.href=`, `location.replace()`,
   meta-refresh, iframe or window.open anywhere in the student page paths. The only reloads in the
   codebase are teacher-dashboard redirects and the user-tapped "force refresh" button.
   → **The refresh is not triggered by app code.**

## 3. Root cause

Two independent failures combine:

**(A) Environment trigger — WebKit page-process restart (unfixable from the app).**
On iPadOS 26 both Safari and WeChat's in-app browser run the page in a WebKit WebContent process.
That process can be killed/recycled — most plausibly here when Doris switches away from the page
right after the completion screen (the study-mode completion screen literally tells students to
screenshot and send the result to the WeChat group), or on an iOS 26 WebKit recycle. When it
restarts, the page reloads to the login/profile screen. This matches "every completed session,
both browsers, <1 s after completion, iPad-only, student-only".

**(B) App vulnerability — completion data shipped fire-and-forget (fixed).**
When a session completes, `finishStudySession()` (and the game-over paths) queued the session
event + SR state and called `flushAnalyticsOnGameOver()` WITHOUT awaiting it, then immediately
rendered the completion screen. The page restart then killed the in-flight POST before server ack,
and the localStorage queue mirror written milliseconds earlier was not durable yet — so the
next-login queue drain had nothing to re-send. Net effect: the session record never reached the
server (dashboard + target meter loss), exactly as observed.

**Why she had to log in again:** the cached-profile list (`savedUsers`) lives in the same origin
storage that WeChat's WKWebView treats as disposable; after the process restart it was empty
(or the cached-password profile login failed), forcing a full re-login. This is a WeChat WKWebView
storage-disposability trait, not an app bug — but fix (B) makes it harmless for data.

## 4. The fix (additive-only, on preview/main)

1. **`frontend_auth.js` → new `flushAnalyticsWithDeadline(maxMs)`**: awaits the retried game-over
   flush but is hard-capped by a deadline (4 s at call sites), so the UI can never hang.
2. **All four completion paths now AWAIT delivery before showing the end screen:**
   `study_mode.js finishStudySession()`, `vampire_survivors.js populateGameOver()`,
   `uno.js endUno()`, `gomoku.js endGomokuGame()`. The completion overlay appears a few hundred ms
   later on a good network (typically <0.5 s), but by then the server has ACKed the session record
   and SR state — a page restart can no longer lose them. Worst case (dead network): deadline
   expires, overlay shows, events stay in the persisted queue for the next-login drain.
3. **`saveActiveUserToCache()` hardened**: this runs after every queued event and serializes the
   user's whole analytics history; an unguarded `localStorage.setItem` could throw
   `QuotaExceededError` and abort the completion path mid-way. It now never throws and retries
   once with the analytics mirror trimmed to the most recent 500 events (server stays source of
   truth; full history is re-fetched on every login).
4. **Deploy stamps bumped together** (`DEPLOY_VERSION_STAMP.md` discipline):
   `version.json` + `APP_VERSION` → `2026-08-25a`; `index.html` `?v=` stamps updated for
   `frontend_auth.js`, `study_mode.js`, `vampire_survivors.js`, `uno.js`, `gomoku.js`.
5. **Regression test:** `test_session_flush_deadline.js` (17 assertions) — deadline flush drains
   the queue on success, never exceeds the deadline on a stalled network, keeps events persisted
   on failure, and `saveActiveUserToCache` never throws / trims-and-retries on quota errors.
   Registered in the mandatory `npm test` chain.

## 5. Verification

- `npm test` (mandatory suite, 7 scripts): **all green — 81 + 22 + 11 + 17 + 11 + 23 + 154 passed, 0 failed.**
- `node --check` on every modified JS file: syntax OK.
- Server write path (`saveAnalytics`) unchanged; eventId de-dup means retries never double-count.

## 6. Follow-ups (not done here)

1. **Deploy to LIVE via the standard preview→main merge** — Doris plays on the LIVE URL, so she
   keeps losing sessions until this reaches `origin/main`. The merge is the teacher-approved
   deployment process; do NOT push directly to `origin/main`. After the merge, verify stamps match
   on both sites (`version.json` = `APP_VERSION` = `2026-08-25a`).
2. **Recover Doris's lost sessions:** the 2026-08-22 / 2026-08-24 study sessions were lost
   client-side before delivery (no events ever reached the server) and cannot be reconstructed.
   If the teacher wants her weekly target corrected, use the dashboard's `manualOffset`
   (current week target `t_1787531803987_u2jyxb` already carries `manualOffset: 5`).
3. **Watch for recurrence:** if Doris still loses sessions after the LIVE deploy, the WebKit kill
   is happening EARLIER than completion (mid-session). The next escalation would be more frequent
   in-session flushes (the 2 s debounced flush already limits that loss to ≤2 s of events) or
   on-device diagnostics (`?debug=true` overlay).
4. Stale memory corrected: the "LIVE vs PREVIEW deployment gap" (session fixes missing on preview)
   documented in `HANDOFF_SESSION_FIX_FULL.md` is obsolete — branches re-converged on 2026-07-31
   (`edf0577`), and preview is now a strict ancestor of live.

---
*Prepared by the scheduled 2026-08-25 investigation task. Fix committed to `preview/main` only.*
