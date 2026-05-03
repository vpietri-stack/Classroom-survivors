const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

// Create client outside handler to reuse connection
const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

app.http('updateAvatar', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            // The frontend might pass avatarUrl or avatarId depending on naming, 
            // but we'll accept 'avatar' or 'avatarUrl' or 'avatarId' and map it.
            const { id, avatar, avatarUrl, avatarId } = body;
            
            const avatarValue = avatar || avatarUrl || avatarId;

            if (!id || !avatarValue) {
                return { status: 400, body: "Missing id or avatar data." };
            }

            // Read existing user
            const { resource: user } = await container.item(id, id).read();

            if (!user) {
                return { status: 404, body: "User not found." };
            }

            // Update avatar
            user.avatar = avatarValue;

            // Upsert updated user
            await container.items.upsert(user);

            return {
                status: 200,
                jsonBody: { success: true, message: "Avatar updated successfully.", avatar: avatarValue }
            };
        } catch (error) {
            context.error("Avatar update failed:", error);
            return { status: 500, body: "Server error while updating avatar." };
        }
    }
});
