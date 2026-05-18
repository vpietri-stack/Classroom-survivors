const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { validateApiKey } = require('./shared/validateApiKey');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

app.http('saveAnalytics', {
    route: 'saveAnalytics',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
            const { studentId, events, srState, incrementSession } = body;

            if (!studentId || !events || !Array.isArray(events) || events.length === 0) {
                return { status: 400, body: "Missing studentId or events array." };
            }

            // Read existing user
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: studentId }]
            };
            const { resources: items } = await container.items.query(querySpec).fetchAll();

            if (items.length === 0) {
                return { status: 404, body: "Student not found." };
            }

            const user = items[0];

            // Initialize analytics array if it doesn't exist
            if (!user.analytics) {
                user.analytics = [];
            }

            // Append all events
            events.forEach(event => {
                user.analytics.push(event);
            });

            // Merge SR state if provided (frontend computes it; backend just stores it)
            if (srState && typeof srState === 'object') {
                user.srState = srState;
            }

            // Increment session count when this flush marks a completed session
            if (incrementSession) {
                user.sessionCount = (user.sessionCount || 0) + 1;
            }

            // Upsert
            await container.items.upsert(user);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `${events.length} event(s) saved.`,
                    sessionCount: user.sessionCount || 0
                }
            };
        } catch (error) {
            context.error("saveAnalytics failed:", error);
            return { status: 500, body: "Server error saving analytics." };
        }
    }
});
