# Deploy Version Stamp (READ BEFORE ANY DEPLOY)

This repo has a **mandatory version-stamp discipline**. The two values below
MUST be bumped together on every deploy, or a class of students will silently
stop saving their progress.

## The two stamps that must match

| File | Field | Example |
|------|-------|---------|
| `version.json` | `"version"` | `"2026-07-23c"` |
| `frontend_auth.js` | `const APP_VERSION` (top of file) | `'2026-07-23c'` |

They must be **identical** after every deploy.

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
2. Update **both**:
   - `version.json` → `"version": "NEW_STAMP"`
   - `frontend_auth.js` → `const APP_VERSION = 'NEW_STAMP';`
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

- `frontend_auth.js`: `startVersionWatchdog()`, `_versionGreater()`,
  `registerUpdateBanner()`.
- `index.html`: anti-cache `<meta>` tags that help WeChat revalidate on reload.
- The `flushAnalytics` `saveAnalytics` POST uses `keepalive: true` so a fast tab
  close (common on WeChat) still delivers the session.
