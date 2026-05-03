const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

// Create client outside handler to reuse connection
const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

app.http('changePassword', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { id, newPassword } = body;

            if (!id || !newPassword) {
                return { status: 400, body: "Missing id or newPassword." };
            }

            // Read existing user first
            const { resource: user } = await container.item(id, id).read();

            if (!user) {
                return { status: 404, body: "User not found." };
            }

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
