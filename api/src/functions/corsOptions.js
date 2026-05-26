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
];

for (const route of API_ROUTES) {
    app.http(`options_${route}`, {
        route,
        methods: ['OPTIONS'],
        authLevel: 'anonymous',
        handler: async (request) => ({
            status: 204,
            headers: getCorsHeaders(request),
        }),
    });
}
