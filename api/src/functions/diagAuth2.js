const { app } = require('@azure/functions');
const auth = require('./shared/auth');

app.http('diagAuth2', {
    route: 'diagAuth2',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const raw = request.headers.get('Authorization') || '';
        const tok = auth.getBearer(request);
        let partsLen = -1, decodedPayload = null, sigMatch = 'n/a', err = null;
        try {
            const parts = tok ? tok.split('.') : [];
            partsLen = parts.length;
            if (partsLen === 3) {
                const crypto = require('crypto');
                const [h, p, s] = parts;
                const expected = crypto.createHmac('sha256', auth.SESSION_SECRET())
                    .update(`${h}.${p}`).digest('base64')
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                sigMatch = expected === s;
                decodedPayload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
            }
        } catch (e) { err = e.message; }
        return {
            status: 200,
            jsonBody: {
                rawHeaderLen: raw.length,
                rawHeaderPreview: raw.slice(0, 30),
                tokenLen: tok ? tok.length : 0,
                partsLen,
                sigMatch,
                decodedSub: decodedPayload ? decodedPayload.sub : null,
                now: Math.floor(Date.now() / 1000),
                exp: decodedPayload ? decodedPayload.exp : null,
                err,
            },
        };
    },
});
