const { app } = require('@azure/functions');
const { getCorsHeaders } = require('./shared/cors');

const API_ROUTES = [
    'login',
    'changePassword',
    'updateAvatar',
    'getStudents',
    'saveAnalytics',
    'addStudent',
    'updateStudent',
    'setTargets',
    'manageBms',
    // Temporary speech-sample research collection (see docs/wiki/08-speech.md
    // §11.1). Both are called cross-origin from GitHub Pages with X-App-Key /
    // X-Auth-Token, so they need preflight or the browser blocks them.
    'speechSampleConsent',
    'saveSpeechSample',
];

for (const route of API_ROUTES) {
    app.http(`options_${route}`, {
        route,
        methods: ['OPTIONS'],
        authLevel: 'anonymous',
        handler: async (request) => ({
            status: 200,
            body: '',
            headers: getCorsHeaders(request),
        }),
    });
}
