const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

// Returns the analytics-archive documents for one student. The live student
// doc only keeps the most recent ~500 events; older sessions live in these
// archive docs (created by saveAnalytics auto-archiving). The dashboard merges
// them back into the student's profile view so history stays complete while the
// live doc stays small.
//
// Auth: privileged caller (teacher/BM/admin) OR the student themselves.
// Mirrors getStudents.js legacy fallback (no-token mode is allowed when
// REQUIRE_AUTH is off, so the trusted teacher dashboard keeps working).
app.http('getStudentArchive', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'getStudentArchive',
    handler: async (request, context) => {
        context.log('Fetching analytics archive for a student...');
        if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

        const studentId = request.query.get('studentId');
        if (!studentId) return { status: 400, jsonBody: { error: 'studentId required' } };

        const { token } = auth.requireAuth(request);
        if (!token) {
            if (auth.enforceAuth()) return auth.unauthorized();
            // legacy no-token mode: trusted teacher dashboard view
        } else if (!auth.isPrivileged(token) && token.sub !== studentId) {
            return auth.unauthorized();
        }

        try {
            const container = getContainer();
            const { resources } = await container.items
                .query({
                    query: 'SELECT * FROM c WHERE c.type = @type AND c.studentId = @id ORDER BY c.archivedAt DESC',
                    parameters: [
                        { name: '@type', value: 'student_analytics_archive' },
                        { name: '@id', value: studentId },
                    ],
                })
                .fetchAll();

            // Strip Cosmos metadata; keep the useful payload (events, counts, dates).
            const sanitized = resources.map(a => {
                const { _rid, _self, _etag, _attachments, _ts, ...rest } = a;
                return rest;
            });
            return { status: 200, jsonBody: sanitized };
        } catch (err) {
            context.error('Archive fetch failed:', err);
            return { status: 500, body: 'Error connecting to the database.' };
        }
    },
});
