const { app } = require('@azure/functions');

app.http('diagAuth4', {
    route: 'diagAuth4',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const raw = request.headers.get('Authorization') || '';
        const tok = raw.replace(/^Bearer\s+/i, '');
        return {
            status: 200,
            jsonBody: {
                rawLen: raw.length,
                tokLen: tok.length,
                tokPreview: tok.slice(0, 60),
                tokTail: tok.slice(-60),
                // is it our 221 token + appended junk, or fully different?
            },
        };
    },
});
