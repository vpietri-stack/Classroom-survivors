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

const APP_API_KEY = 'cs-app-9kXmR7pL2wQz8vNb4tYj6cEd3hFs5mKr';

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
