/**
 * Both Pages addresses are allowed during the domain cutover.
 * The legacy production and preview project paths share one browser origin.
 */

const LEGACY_ORIGIN = 'https://vpietri-stack.github.io';
const ALLOWED_ORIGINS = new Set([
    LEGACY_ORIGIN,
    'https://banban.quest',
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
    return {
        ...(isAllowedOrigin(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-App-Key, X-Creator-Id, X-Auth-Token, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

function withCors(request, response) {
    if (!response || typeof response !== 'object') return response;
    const cors = getCorsHeaders(request);
    if (request?.method !== 'OPTIONS') {
        // Use a concrete origin even for denied and origin-less responses so
        // Azure's wildcard preflight default cannot be applied to API data.
        cors['Access-Control-Allow-Origin'] ??= LEGACY_ORIGIN;
    }
    return {
        ...response,
        headers: {
            ...cors,
            ...(response.headers || {}),
        },
    };
}

module.exports = { getCorsHeaders, withCors, isAllowedOrigin };
