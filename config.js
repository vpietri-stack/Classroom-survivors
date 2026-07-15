// ============================================================
// CENTRAL API CONFIG
// Loaded before all other scripts in index.html and teacher_dashboard.html
// ============================================================

const API_BASE_URL = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
)
    ? 'http://localhost:7071/api'
    : 'https://brave-bush-0438ab000.7.azurestaticapps.net/api';

// ============================================================
// APP KEY (client-side)
// NOTE: a browser-shipped key is NOT a secret — anyone can read it via DevTools.
// It only gates casual non-app callers. It is delivered at deploy time via a
// git-ignored, CI-injected /app-config.json (see the GitHub Actions workflow).
// Local dev without that file -> key is '' and the API accepts it (dev fallback).
let _appKeyPromise = null;
function getAppKey() {
    if (_appKeyPromise) return _appKeyPromise;
    _appKeyPromise = fetch('app-config.json')
        .then(r => (r && r.ok) ? r.json() : null)
        .then(j => (j && j.APP_API_KEY) || '')
        .catch(() => '');
    return _appKeyPromise;
}

// ============================================================
// TOWER DEFENSE GATING (merge-safe, runtime-detected)
// ------------------------------------------------------------
// Tower Defense is still in development. It must be:
//   - ENABLED on preview (so we can build/test it)
//   - DISABLED on the live (production) site, shown as "Coming soon"
// We CANNOT use a static per-branch flag for this, because merging
// preview -> main would carry a "disabled" setting into main — or re-enable
// a "disabled" live setting on the next preview merge. Instead we detect the
// DEPLOY TARGET at runtime from the URL. Both sites share the same hostname
// (vpietri-stack.github.io), so we key off the PATH:
//   preview: /Classroom-survivors-preview/  -> enabled
//   live:    /Classroom-survivors/          -> disabled
// Localhost / file:// (local dev, opening index.html directly) -> enabled,
// and ?td=1 forces it on anywhere for quick manual checks.
// ============================================================
const TD_ENABLED = (function () {
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    if (params.has('td')) return params.get('td') !== '0'; // ?td=0 can force off
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return true;
    if (window.location.protocol === 'file:') return true;
    // Preview deploy path -> enabled. Everything else (incl. live) -> disabled.
    return path.indexOf('/classroom-survivors-preview') === 0;
})();
