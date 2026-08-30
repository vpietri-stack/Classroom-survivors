# Deploy Version Stamp (READ BEFORE ANY DEPLOY)

This repo has a **mandatory version-stamp discipline**. The two values below
MUST be bumped together on every deploy, or a class of students will silently
stop saving their progress.

## The THREE stamps that must match (was "two" — the index.html cache-buster was missed on 2026-08-30 and broke everyone)

| File | Field | Example |
|------|-------|---------|
| `version.json` | `"version"` | `"2026-08-30a"` |
| `frontend_auth.js` | `const APP_VERSION` (top of file) | `'2026-08-30a'` |
| `index.html` | `<script src="frontend_auth.js?v=...">` | `?v=2026-08-30a` |

All three must be **identical** after every deploy. `index.html`'s `?v=` is the
cache-buster that forces browsers (esp. WeChat's aggressive cache) to fetch the
new `frontend_auth.js` — without it, clients keep the old `APP_VERSION` and the
watchdog nags forever even after you fix the other two.

**ENFORCED:** `test_deploy_stamp_sync.js` runs as the FIRST step of `npm test`
and exits non-zero on any drift between the three stamps, so a mismatch can't be
committed through the normal test gate. Bump all three, then `npm test` must pass.

## Why this matters (root cause)

WeChat's iOS in-app browser is a WKWebView:

- It has **no `navigator.serviceWorker`**, so the service worker self-heal never
  installs there.
- It **aggressively caches `index.html` + JS** and ignores `Cache-Control`.

A student pinned to an old build keeps sending a header that Azure SWA strips →
**401** → their session save is silently dropped. The fix is the **version
watchdog** (`startVersionWatchdog()` in `frontend_auth.js`): it polls
`version.json` with a no-cache request every 60s, and if the live `version` is
newer than the running `APP_VERSION`, it shows the "⚠️ App needs an update to
save progress — tap here to reload" banner. One tap reloads the fresh,
version-stamped build.

**If the two stamps don't match, the watchdog either never fires (stale build
sticks) or permanently nags (live always newer than running).** Treat a mismatch
as a deploy bug.

## How to bump

1. Pick a new stamp. Format is `YYYY-MM-DD` + optional lowercase letter,
   e.g. `2026-07-23c` → `2026-07-23d` or `2026-07-24a`. Comparison is
   year → month → day → letter (`a`=1, `b`=2, …).
2. Update **all three** (the test enforces this):
   - `version.json` → `"version": "NEW_STAMP"`
   - `frontend_auth.js` → `const APP_VERSION = 'NEW_STAMP';`
   - `index.html` → `<script src="frontend_auth.js?v=NEW_STAMP">`
3. Deploy (GitHub Pages takes ~1–2 min to build after push).
4. Verify live: `curl` the served `frontend_auth.js` and grep for
   `startVersionWatchdog` + `keepalive`; confirm `version.json` is served with
   the new stamp.

## How to verify the watchdog without leaving a live banner

1. Canary-bump `version.json` to a stamp HIGHER than `APP_VERSION`, deploy.
2. In a real browser, confirm `registerUpdateBanner('version-watchdog')`
   renders the banner text "⚠️ App needs an update to save progress — tap here
   to reload".
3. **Revert** `version.json` back to match `APP_VERSION` and re-deploy (or
   `git reset --soft HEAD~1` if the push is blocked). NEVER leave `version.json`
   ahead of `APP_VERSION` on a live build.

## Related
- `test_deploy_stamp_sync.js` — **enforcement**: runs first in `npm test`, fails
  the whole suite on any drift between the three stamps. This is the guard rail;
  do not disable it.
- `frontend_auth.js`: `startVersionWatchdog()`, `_versionGreater()`,
  `registerUpdateBanner()`.
- `index.html`: anti-cache `<meta>` tags + the `?v=<APP_VERSION>` cache-buster on
  every `<script>` (including `frontend_auth.js`).
- The `flushAnalytics` `saveAnalytics` POST uses `keepalive: true` so a fast tab
  close (common on WeChat) still delivers the session.

## If you broke it (stamps drifted and deployed)
1. Fix all three stamps to match (don't just revert — pick one consistent value).
2. `npm test` must pass (it will, if all three match).
3. Commit + deploy. If GitHub Pages rejects with `due to in progress deployment`,
   don't push again — `gh run rerun <pages-run-id>` after the wedge clears, or
   wait ~30–90 min for the lock to self-release.
