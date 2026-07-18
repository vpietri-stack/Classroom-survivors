const { app } = require('@azure/functions');
const crypto = require('crypto');
const auth = require('./shared/auth');

app.http('diagAuth3', {
    route: 'diagAuth3',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async () => {
        const sec = auth.SESSION_SECRET();
        const fp = crypto.createHash('sha256').update(sec).digest('hex').slice(0, 16);
        return {
            status: 200,
            jsonBody: {
                secretLen: sec.length,
                secretFingerprint: fp, // sha256 prefix — safe to expose
                secretFirst4: sec.slice(0, 4),
                secretLast4: sec.slice(-4),
            },
        };
    },
});
