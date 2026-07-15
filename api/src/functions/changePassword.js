const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

app.http('changePassword', {
    route: 'changePassword',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            // Identity from token; a user may only change their own password.
            // Legacy (no-token) mode allows self-scope by the client id.
            const authGate = auth.requireAuth(request);
            if (authGate.error) return authGate.error;
            const token = authGate.token;

            const body = await request.json();
            const { id, newPassword } = body;
            if (!auth.requireSelfOrRole(token, id)) return auth.forbidden();
            if (!newPassword) return { status: 400, body: 'Missing newPassword.' };

            const { resources: items } = await getContainer().items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
                .fetchAll();
            if (items.length === 0) return { status: 404, body: 'User not found.' };

            const user = items[0];
            user.password = auth.hashPassword(newPassword);
            user.needsPasswordChange = false;
            await getContainer().items.upsert(user);

            return { status: 200, jsonBody: { success: true, message: 'Password updated successfully.' } };
        } catch (error) {
            context.error('Password change failed:', error);
            return { status: 500, body: 'Server error while changing password.' };
        }
    }
});
