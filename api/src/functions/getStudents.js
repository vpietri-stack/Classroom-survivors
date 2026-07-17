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

        const token = auth.verifyToken(request, auth.SESSION_SECRET());

        // Legacy (no-token) mode: the trusted teacher dashboard calls this with
        // ?includeSecure=true to recover student passwords. Kept for backward
        // compat until every client sends a privileged token.
        if (!token) {
            if (auth.enforceAuth()) return auth.unauthorized();
            return await getAllStudents(context, request, /*allowSecure=*/ true);
        }

        try {
            const container = getContainer();
            if (auth.isPrivileged(token)) {
                // Trusted teacher/BM: may request secure fields.
                return await getAllStudents(context, request, /*allowSecure=*/ true);
            }

            // Students: only their own record, no password ever.
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

// Returns all student records. When allowSecure is true AND ?includeSecure=true,
// the stored password is included (teacher/BM recovery view). Otherwise it is
// stripped. Cosmos metadata (_rid/_self/...) is always stripped.
async function getAllStudents(context, request, allowSecure) {
    try {
        const container = getContainer();
        const { resources } = await container.items
            .query("SELECT * FROM c WHERE c.role = 'student' OR NOT IS_DEFINED(c.role)")
            .fetchAll();
        const wantSecure = allowSecure && request.query.get('includeSecure') === 'true';
        const sanitized = resources.map(s => {
            const r = auth.publicUser(s);          // strips password + metadata
            if (wantSecure) r.password = s.password; // re-include for trusted callers
            return r;
        });
        return { status: 200, jsonBody: sanitized };
    } catch (error) {
        context.error('Database connection failed:', error);
        return { status: 500, body: 'Error connecting to the database.' };
    }
}
