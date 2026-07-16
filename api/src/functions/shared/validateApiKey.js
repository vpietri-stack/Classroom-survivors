/**
 * Validates the X-App-Key header against the APP_API_KEY environment variable.
 * NOTE: the key is shipped to the browser, so it is NOT a real secret — it only
 * deters casual non-app callers (scripts hitting the API directly). Real
 * protection is per-user login + CORS.
 *
 * A request is accepted when ANY of:
 *   1. the sent key matches the configured key, OR
 *   2. it comes from one of our own frontend origins (GitHub Pages / SWA). Those
 *      are the legitimate client; if app-config.json is missing/unreachable the
 *      call must still succeed, OR
 *   3. it is a localhost dev request with no key, OR
 *   4. no key is configured at all (dev fallback).
 */
const OWN_ORIGINS = [
    /vpietri-stack\.github\.io$/i,
    /azurestaticapps\.net$/i,
];

function originOf(request) {
    return request.headers.get('origin') || request.headers.get('referer') || '';
}

function isLocalhost(request) {
    // NOTE: only inspect the Origin/Referer header. In the Azure Functions host
    // request.url is always the INTERNAL http://localhost:<port> URL, so using it
    // would wrongly whitelist every production request as "localhost". The browser
    // always sets Origin (or Referer) for cross-origin/same-origin fetches.
    const o = originOf(request);
    return /^(https?:\/\/localhost|https?:\/\/127\.0\.0\.1)/i.test(o);
}

function isOwnOrigin(request) {
    return OWN_ORIGINS.some(re => re.test(originOf(request)));
}

function validateApiKey(request) {
    const expectedKey = process.env.APP_API_KEY;
    const sentKey = request.headers.get('X-App-Key') || '';

    // Correct key from the deployed client config → always allow.
    if (expectedKey && sentKey === expectedKey) return true;

    // Our own frontend origins are legitimate clients even without the key
    // (e.g. when app-config.json failed to load). Accept them.
    if (isOwnOrigin(request)) return true;

    // Local dev: no app-config.json → client sends ''; allow localhost.
    if (isLocalhost(request) && !sentKey) return true;

    // No key configured at all → allow (dev fallback).
    if (!expectedKey) return true;

    return false;
}

module.exports = { validateApiKey };
