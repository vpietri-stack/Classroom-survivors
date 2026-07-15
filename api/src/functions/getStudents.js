const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

app.http('getStudents', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Fetching students from the database...');
        if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

        // Identity from a verified token. Enforced mode rejects a missing token;
        // legacy mode (REQUIRE_AUTH=false) mimics the OLD open endpoint so the
        // currently-deployed, token-less client (teacher_dashboard.js) keeps
        // working unchanged — it fetches the full list and filters client-side.
        const token = auth.verifyToken(request, auth.SESSION_SECRET());
        if (!token) {
            if (auth.enforceAuth()) return auth.unauthorized();
            return await getAllStudents(context, request);
        }

        try {
            const container = getContainer();
            if (auth.isPrivileged(token)) {
                return await getAllStudents(context, request);
            }

            // Students: only their own record.
            const { resources } = await container.items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: token.sub }] })
                .fetchAll();
            const r = resources[0] ? auth.publicUser(resources[0]) : null;
            return { status: 200, jsonBody: r ? [r] : [] };
        } catch (error) {
            context.error('Database connection failed:', error);
            return { status: 500, body: 'Error connecting to the database.' };
        }
    }
});

// Shared by privileged tokens AND legacy (token-less) mode: returns all student
// records with the password stripped (unless ?includeSecure=true). This is the
// exact behaviour of the pre-auth endpoint, so the legacy client is unaffected.
async function getAllStudents(context, request) {
    try {
        const container = getContainer();
        const { resources } = await container.items
            .query("SELECT * FROM c WHERE c.role = 'student' OR NOT IS_DEFINED(c.role)")
            .fetchAll();
        const includeSecure = request.query.get('includeSecure') === 'true';
        const sanitized = resources.map(s => {
            const r = auth.publicUser(s);
            if (!includeSecure) delete r.password;
            return r;
        });
        return { status: 200, jsonBody: sanitized };
    } catch (error) {
        context.error('Database connection failed:', error);
        return { status: 500, body: 'Error connecting to the database.' };
    }
}
