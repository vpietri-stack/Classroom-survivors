const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

app.http('updateAvatar', {
    route: 'updateAvatar',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            // Identity from token; a user may only update their own avatar.
            // Legacy (no-token) mode allows self-scope by the client id.
            const authGate = auth.requireAuth(request);
            if (authGate.error) return authGate.error;
            const token = authGate.token;

            const body = await request.json();
            const { id, avatar, avatarUrl, avatarId } = body;
            if (!auth.requireSelfOrRole(token, id)) return auth.forbidden();

            const avatarValue = avatar || avatarUrl || avatarId;
            if (!avatarValue) return { status: 400, body: 'Missing avatar data.' };

            const { resources: items } = await getContainer().items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
                .fetchAll();
            if (items.length === 0) return { status: 404, body: 'User not found.' };

            const user = items[0];
            user.avatar = avatarValue;
            await getContainer().items.upsert(user);

            return {
                status: 200,
                jsonBody: { success: true, message: 'Avatar updated successfully.', avatar: avatarValue }
            };
        } catch (error) {
            context.error('Avatar update failed:', error);
            return { status: 500, body: 'Server error while updating avatar.' };
        }
    }
});
