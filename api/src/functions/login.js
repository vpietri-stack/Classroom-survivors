const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

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
            const { login, password } = body;

            if (!login || !password) {
                return { status: 400, body: "Missing login or password." };
            }

            const querySpec = {
                query: "SELECT * FROM c WHERE c.login = @login",
                parameters: [{ name: "@login", value: login }]
            };

            const { resources: items } = await container.items.query(querySpec).fetchAll();

            if (items.length === 0) {
                return { status: 401, body: "Invalid credentials." };
            }

            const user = items[0];

            if (user.password !== password) {
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
                    classTime: user.classTime || null
                }
            };
        } catch (error) {
            context.error("Login failed:", error);
            return { status: 500, body: "Server error connecting to the database." };
        }
    }
});
