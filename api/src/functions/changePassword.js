const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { validateApiKey } = require('./shared/validateApiKey');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

// Create client outside handler to reuse connection
const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

app.http('changePassword', {
    route: 'changePassword',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
            const { id, newPassword } = body;

            if (!id || !newPassword) {
                return { status: 400, body: "Missing id or newPassword." };
            }

            context.log("changePassword called with id:", id);

            // Read existing user first
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: id }]
            };
            const { resources: items } = await container.items.query(querySpec).fetchAll();
            context.log("Found items length:", items.length);

            if (items.length === 0) {
                return { status: 404, body: "User not found for id: " + id + " and " + JSON.stringify(body) };
            }
            
            const user = items[0];

            // Update fields
            user.password = newPassword;
            user.needsPasswordChange = false;

            // Upsert updated user
            await container.items.upsert(user);

            return {
                status: 200,
                jsonBody: { success: true, message: "Password updated successfully." }
            };
        } catch (error) {
            context.error("Password change failed:", error);
            return { status: 500, body: "Server error while changing password." };
        }
    }
});
