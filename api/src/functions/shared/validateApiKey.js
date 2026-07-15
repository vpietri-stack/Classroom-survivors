/**
 * Validates the X-App-Key header against the APP_API_KEY environment variable.
 * NOTE: the key is shipped to the browser, so it is NOT a real secret — it only
 * deters casual non-app callers. Real protection is per-user login + CORS.
 * Returns true if valid (or if no key is configured, to allow local dev without env var set).
 */
function validateApiKey(request) {
    const expectedKey = process.env.APP_API_KEY;
    const sentKey = request.headers.get('X-App-Key') || '';

    // Correct key from the deployed client config → always allow.
    if (expectedKey && sentKey === expectedKey) return true;

    // Local dev: no app-config.json → client sends ''; allow if the request
    // clearly originates from localhost (so the Azure Function dev server works).
    const origin = request.headers.get('origin') || request.headers.get('referer') || '';
    const isLocal = /^(https?:\/\/localhost|https?:\/\/127\.0\.0\.1)/i.test(origin)
        || (request.url && (request.url.startsWith('http://localhost') || request.url.startsWith('http://127.0.0.1')));
    if (isLocal && !sentKey) return true;

    // No key configured at all → allow (dev fallback).
    if (!expectedKey) return true;

    return false;
}

module.exports = { validateApiKey };
