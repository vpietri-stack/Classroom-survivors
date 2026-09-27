const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

// Geo v2 (2026-09-26): teacher/BM/admin clears a student's captured location
// (trip contamination, moved family). Removes /geo + /geoSamples only. The
// client captures on every login, so the student's next login re-seeds the
// data — this endpoint IS the "request recapture" mechanism.
app.http('clearGeo', {
    route: 'clearGeo',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
            let body = {};
            try { body = await request.json(); } catch { /* allow query-param studentId */ }
            const studentId = body.studentId || request.query.get('studentId');
            if (!studentId) return { status: 400, jsonBody: { error: 'studentId required' } };

            const { token, error } = auth.requireAuth(request);
            if (error) return error;
            if (!auth.isPrivileged(token)) return auth.forbidden();

            const container = getContainer();
            const { resources } = await container.items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: studentId }] })
                .fetchAll();
            if (!resources.length) return { status: 404, jsonBody: { error: 'student not found' } };
            const doc = resources[0];
            const pk = doc.studentId !== undefined ? doc.studentId : undefined;

            const operations = [];
            if (doc.geo !== undefined) operations.push({ op: 'remove', path: '/geo' });
            if (doc.geoSamples !== undefined) operations.push({ op: 'remove', path: '/geoSamples' });
            if (operations.length) {
                await container.item(doc.id, pk).patch({ operations });
            }
            context.log(`clearGeo by ${token.role} for ${studentId}: removed ${operations.length} field(s)`);
            return { status: 200, jsonBody: { success: true, cleared: operations.length } };
        } catch (e) {
            context.error('clearGeo failed:', e);
            return { status: 500, body: 'Server error clearing geo.' };
        }
    }
});
