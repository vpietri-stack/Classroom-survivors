const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const auth = require('./shared/auth');
const policy = require('./shared/speechSamples');

// Tells the signed-in client whether it may record and upload speech samples.
//
// This exists so that audio NEVER leaves a non-consented child's device: the
// client asks once after login and stays completely inert unless the answer is
// yes. Consent could not simply be enforced by rejecting the upload, because by
// then the recording would already have been encoded and sent.
//
// The consent list itself lives in the SPEECH_SAMPLE_CONSENTED_IDS app setting,
// never in this repository (which is public, and student IDs embed children's
// full pinyin names).
app.http('speechSampleConsent', {
    route: 'speechSampleConsent',
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            const authGate = auth.requireAuth(request);
            if (authGate.error) return authGate.error;
            const token = authGate.token;

            const endsAt = policy.captureEndsAt();
            const open = policy.withinCaptureWindow();
            // No token means no identity means no consent — never a bare `false`
            // that a caller might mistake for "checked and declined".
            const consented = open && !!(token && policy.isConsented(token.sub));

            return {
                status: 200,
                jsonBody: { consented, open, endsAt },
            };
        } catch (error) {
            context.error('speechSampleConsent failed:', error);
            // Fail closed: on any error the client must not record.
            return { status: 200, jsonBody: { consented: false, open: false, endsAt: 0, error: true } };
        }
    },
});
