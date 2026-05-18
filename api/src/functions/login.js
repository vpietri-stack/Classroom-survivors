const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { validateApiKey } = require('./shared/validateApiKey');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

// Create client outside handler to reuse connection
const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

app.http('login', {
    route: 'login',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
            const { login, password, id } = body;

            if (!id && (!login || !password)) {
                return { status: 400, body: "Missing credentials." };
            }

            const querySpec = login ? {
                query: "SELECT * FROM c WHERE c.login = @login",
                parameters: [{ name: "@login", value: login }]
            } : {
                query: "SELECT * FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: id }]
            };

            const { resources: items } = await container.items.query(querySpec).fetchAll();

            if (items.length === 0) {
                return { status: 401, body: "Invalid credentials." };
            }

            const user = items[0];

            // If we authenticated via login, verify password. 
            // If authenticated via id (silent refresh from local cache), bypass password check.
            if (login && user.password !== password) {
                return { status: 401, body: "Invalid credentials." };
            }

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    id: user.id,
                    fullName: user.fullName,
                    avatar: user.avatar || null,
                    needsPasswordChange: user.needsPasswordChange,
                    role: user.role,
                    classTime: user.classTime || null,
                    book: user.book || null,
                    unit: user.unit || null,
                    page: user.page || null,
                    srState: user.srState || null,
                    sessionCount: user.sessionCount || 0,
                    targets: user.targets || [],
                    analytics: user.analytics || []
                }
            };
        } catch (error) {
            context.error("Login failed:", error);
            return { status: 500, body: "Server error connecting to the database." };
        }
    }
});
