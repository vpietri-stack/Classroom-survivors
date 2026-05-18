/**
 * Validates the X-App-Key header against the APP_API_KEY environment variable.
 * Returns true if valid (or if no key is configured, to allow local dev without env var set).
 */
function validateApiKey(request) {
    const expectedKey = process.env.APP_API_KEY;
    if (!expectedKey) return true; // No key configured → allow (dev fallback)
    const sentKey = request.headers.get('X-App-Key');
    return sentKey === expectedKey;
}

module.exports = { validateApiKey };
