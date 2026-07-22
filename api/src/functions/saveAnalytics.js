const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

app.http('saveAnalytics', {
    route: 'saveAnalytics',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            // Identity comes from the verified session token, never the body.
            // Legacy (no-token) mode falls back to the client-supplied id.
            const authGate = auth.requireAuth(request);
            if (authGate.error) return authGate.error;
            const token = authGate.token;

            const body = await request.json();
            const studentId = token ? token.sub : body.studentId; // scope to self only
            const { events, srState, incrementSession } = body;

            if (!events || !Array.isArray(events) || events.length === 0) {
                return { status: 400, body: 'Missing events array.' };
            }

            const { resources: items } = await getContainer().items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: studentId }] })
                .fetchAll();
            if (items.length === 0) return { status: 404, body: 'Student not found.' };

            const user = items[0];
            if (!user.analytics) user.analytics = [];
            let added = 0;
            events.forEach(event => {
                // Idempotent de-dup: the client stamps each event with a stable
                // eventId so a retried flush (tab-close re-send + next-launch
                // retry) cannot double-count a session or exercise.
                if (event && event.eventId) {
                    const seen = user.analytics.some(a => a && a.eventId === event.eventId);
                    if (seen) return;
                }
                user.analytics.push(event);
                added++;
            });
            if (srState && typeof srState === 'object') user.srState = srState;
            if (incrementSession) user.sessionCount = (user.sessionCount || 0) + 1;

            await getContainer().items.upsert(user);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `${added} event(s) saved (${events.length - added} duplicate(s) skipped).`,
                    sessionCount: user.sessionCount || 0
                }
            };
        } catch (error) {
            context.error('saveAnalytics failed:', error);
            return { status: 500, body: 'Server error saving analytics.' };
        }
    }
});
