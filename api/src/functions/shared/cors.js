/**
 * CORS helpers for browser clients (GitHub Pages, local dev servers).
 * GitHub Pages origin has no path — both production and preview repos share
 * https://vpietri-stack.github.io
 */

const ALLOWED_ORIGINS = new Set([
    'https://vpietri-stack.github.io',
]);

const ALLOWED_ORIGIN_PREFIXES = [
    'http://localhost:',
    'http://127.0.0.1:',
];

function isAllowedOrigin(origin) {
    if (!origin) return false;
    if (ALLOWED_ORIGINS.has(origin)) return true;
    return ALLOWED_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix));
}

function getCorsHeaders(request) {
    const origin = request?.headers?.get?.('Origin') || '';
    const allowOrigin = isAllowedOrigin(origin)
        ? origin
        : 'https://vpietri-stack.github.io';

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
        'Access-Control-Max-Age': '86400',
    };
}

function withCors(request, response) {
    if (!response || typeof response !== 'object') return response;
    return {
        ...response,
        headers: {
            ...getCorsHeaders(request),
            ...(response.headers || {}),
        },
    };
}

module.exports = { getCorsHeaders, withCors, isAllowedOrigin };
