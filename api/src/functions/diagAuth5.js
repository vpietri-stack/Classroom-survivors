const { app } = require('@azure/functions');

app.http('diagAuth5', {
    route: 'diagAuth5',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const raw = request.headers.get('Authorization') || '';
        const tok = raw.replace(/^Bearer\s+/i, '');
        let payload = null, header = null;
        try {
            const parts = tok.split('.');
            if (parts.length === 3) {
                const b64 = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
                header = JSON.parse(b64(parts[0]));
                payload = JSON.parse(b64(parts[1]));
            }
        } catch (e) {}
        return {
            status: 200,
            jsonBody: {
                tokLen: tok.length,
                jwtHeader: header,
                jwtPayload: payload,
            },
        };
    },
});
