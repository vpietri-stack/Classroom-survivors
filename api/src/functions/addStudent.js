const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

const PRIV_ROLES = ['teacher', 'BM', 'admin'];

app.http('addStudent', {
    route: 'addStudent',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            // Only teachers/BMs may create students. Legacy (no-token) mode permits
            // the action (client-supplied id) until the new client ships.
            const authGate = auth.requireAuth(request);
            if (authGate.error) return authGate.error;
            const token = authGate.token;
            if (token && !PRIV_ROLES.includes(token.role)) return auth.forbidden();

            const body = await request.json();
            const { id, login, password, fullName, classTime, book, unit, page, needsPasswordChange, teacher } = body;

            if (!id || !login || !password || !fullName) {
                return { status: 400, body: 'Missing required fields: id, login, password, fullName.' };
            }

            const { resources: existing } = await getContainer().items
                .query({ query: 'SELECT c.id FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
                .fetchAll();
            if (existing.length > 0) return { status: 409, body: 'A student with this ID already exists.' };

            const { resources: loginExisting } = await getContainer().items
                .query({ query: 'SELECT c.id FROM c WHERE c.login = @login', parameters: [{ name: '@login', value: login }] })
                .fetchAll();
            if (loginExisting.length > 0) return { status: 409, body: 'A student with this login already exists.' };

            const newStudent = {
                id,
                login,
                password: password, // stored plaintext so the teacher dashboard can recover it
                fullName,
                role: 'student',
                teacher: teacher || 'Val',
                classTime: classTime || null,
                book: book || null,
                unit: unit || null,
                page: page || null,
                avatar: null,
                needsPasswordChange: needsPasswordChange !== false,
                analytics: [],
                srState: { vocab: {}, sentences: {}, sentencePairs: {} },
                sessionCount: 0,
                targets: []
            };

            await getContainer().items.create(newStudent);

            // Audit: creator is the verified token identity, not client input.
            const logId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const activityLog = {
                id: logId,
                role: 'bmActivity',
                timestamp: new Date().toISOString(),
                bmId: token ? token.sub : 'legacy',
                action: 'create_student',
                details: { studentId: id, studentName: fullName }
            };
            await getContainer().items.create(activityLog).catch(err => {
                context.error('Failed to write activity log:', err);
            });

            return {
                status: 201,
                jsonBody: { success: true, message: 'Student created.', student: auth.publicUser(newStudent) }
            };
        } catch (error) {
            context.error('addStudent failed:', error);
            return { status: 500, body: 'Server error creating student.' };
        }
    }
});
