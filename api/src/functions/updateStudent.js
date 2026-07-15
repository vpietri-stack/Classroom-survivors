const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

const PRIV_ROLES = ['teacher', 'BM'];

app.http('updateStudent', {
    route: 'updateStudent',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            // Only teachers/BMs may edit student records. Legacy (no-token) mode
            // permits the action (client-supplied id) until the new client ships.
            const authGate = auth.requireAuth(request);
            if (authGate.error) return authGate.error;
            const token = authGate.token;
            if (token && !PRIV_ROLES.includes(token.role)) return auth.forbidden();

            const body = await request.json();
            const { studentId, fields } = body;

            if (!studentId || !fields || typeof fields !== 'object') {
                return { status: 400, body: 'Missing studentId or fields object.' };
            }

            const allowedFields = [
                'book', 'unit', 'page', 'classTime', 'password',
                'needsPasswordChange', 'fullName', 'login', 'targets', 'teacher'
            ];

            const { resources: items } = await getContainer().items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: studentId }] })
                .fetchAll();
            if (items.length === 0) return { status: 404, body: 'Student not found.' };

            const user = items[0];
            const changes = {};

            for (const key of allowedFields) {
                if (fields[key] !== undefined) {
                    if (user[key] !== fields[key]) {
                        changes[key] = { from: user[key], to: fields[key] };
                    }
                    // Hash if a password field is being set.
                    user[key] = key === 'password' ? auth.hashPassword(fields[key]) : fields[key];
                }
            }

            await getContainer().items.upsert(user);

            // Audit trail uses the verified token identity (ignore client creatorId).
            if (Object.keys(changes).length > 0) {
                const logId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const activityLog = {
                    id: logId,
                    role: 'bmActivity',
                    timestamp: new Date().toISOString(),
                    bmId: token ? token.sub : 'legacy',
                    action: 'update_student',
                    details: { studentId, studentName: user.fullName || user.login, changes }
                };
                await getContainer().items.create(activityLog).catch(err => {
                    context.error('Failed to write activity log:', err);
                });
            }

            return {
                status: 200,
                jsonBody: { success: true, message: 'Student updated.', student: auth.publicUser(user) }
            };
        } catch (error) {
            context.error('updateStudent failed:', error);
            return { status: 500, body: 'Server error updating student.' };
        }
    }
});
