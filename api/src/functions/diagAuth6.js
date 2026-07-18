const { app } = require('@azure/functions');

app.http('diagAuth6', {
    route: 'diagAuth6',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const authz = request.headers.get('Authorization') || '(none)';
        const xAuth = request.headers.get('X-Auth-Token') || '(none)';
        return {
            status: 200,
            jsonBody: {
                authorizationHeaderLen: authz.length,
                xAuthTokenLen: xAuth.length,
                xAuthTokenPreview: xAuth.slice(0, 40),
                // if our JWT arrives intact in X-Auth-Token, the fix works
                ourJwtIntact: xAuth.startsWith('eyJ') && xAuth.split('.').length === 3,
            },
        };
    },
});
