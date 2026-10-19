const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');
const {dashboardData} = require('./shared/dashboardData');

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
        if (request.query.get('studentId')) {
            const {resources} = await container.items.query({query:"SELECT * FROM c WHERE c.id = @id AND (c.role = 'student' OR NOT IS_DEFINED(c.role)) AND NOT IS_DEFINED(c.type)",parameters:[{name:'@id',value:request.query.get('studentId')}]}).fetchAll();
            const secure = allowSecure && request.query.get('includeSecure') === 'true';
            if (resources[0] && request.query.get('since') && request.query.get('since') === resources[0]._etag) return {status:304,headers:{'Cache-Control':'private, no-store'}};
            return {status:200,headers:{'Cache-Control':'private, no-store'},jsonBody:resources.map(s => ({...auth.publicUser(s),detailRevision:s._etag,...(secure ? {password:s.password} : {})}))};
        }
        if (request.query.get('view') === 'dashboard') return await dashboardData(container, {secure:allowSecure && request.query.get('includeSecure') === 'true',since:request.query.get('since') || ''});
        // Exclude analytics-archive docs: they have no `role` (so the
        // NOT IS_DEFINED(c.role) clause would otherwise pull them in as
        // phantom students on the dashboard). Keep them out of the list;
        // they are fetched on demand via /getStudentArchive.
        const { resources } = await container.items
            .query("SELECT * FROM c WHERE (c.role = 'student' OR NOT IS_DEFINED(c.role)) AND (NOT IS_DEFINED(c.type) OR c.type <> 'student_analytics_archive')")
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
