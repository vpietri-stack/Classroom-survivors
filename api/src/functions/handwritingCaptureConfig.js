const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const auth = require('./shared/auth');
const policy = require('./shared/handwritingSamples');
const { MAX_WORDS_PER_STUDENT_PER_DAY } = require('./saveHandwritingSample');

// Tells the signed-in client whether it may record and upload handwriting
// traces, and until when.
//
// This exists so a student who is NOT being recorded never sends anything at
// all: the client asks once per session and stays inert unless the answer is
// yes. Traces are only a few kilobytes, but the classroom is on a Chinese
// mobile network where every avoidable request competes with the game's own
// assets, and the server's authority over the window means the client constant
// can stay a fallback instead of a second source of truth.
//
// The enable list lives in the HANDWRITING_SAMPLE_IDS app setting, never in this
// repository (which is public, and student IDs embed children's full pinyin
// names). `*` enables every signed-in student.
app.http('handwritingCaptureConfig', {
    route: 'handwritingCaptureConfig',
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            const authGate = auth.requireAuth(request);
            if (authGate.error) return authGate.error;
            const token = authGate.token;

            const open = policy.withinCaptureWindow();
            const enabled = open && !!(token && policy.isCaptureEnabled(token.sub));

            return {
                status: 200,
                jsonBody: {
                    enabled,
                    open,
                    endsAt: policy.captureEndsAt(),
                    maxPerDay: MAX_WORDS_PER_STUDENT_PER_DAY,
                },
            };
        } catch (error) {
            context.error('handwritingCaptureConfig failed:', error);
            // Fail closed: on any error the client must not record.
            return { status: 200, jsonBody: { enabled: false, open: false, endsAt: 0, maxPerDay: 0, error: true } };
        }
    },
});
