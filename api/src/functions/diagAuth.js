const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const auth = require('./shared/auth');

// TEMPORARY diagnostic — reports which gate rejects, to localize the 403.
// DELETE after debugging.
app.http('diagAuth', {
    route: 'diagAuth',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const apiKeyOk = validateApiKey(request);
        const gate = auth.requireAuth(request);
        const bearer = auth.getBearer(request) ? 'present' : 'missing';
        const sub = gate.token ? gate.token.sub : null;
        let selfOk = null;
        if (gate.token) {
            const body = await request.json().catch(() => ({}));
            selfOk = auth.requireSelfOrRole(gate.token, body.id);
        }
        return {
            status: 200,
            jsonBody: {
                apiKeyOk,
                bearer,
                tokenPresent: !!gate.token,
                tokenSub: sub,
                gateError: gate.error ? '401' : null,
                selfOk,
                enforceAuth: auth.enforceAuth(),
                secretLen: auth.SESSION_SECRET().length,
            },
        };
    },
});
