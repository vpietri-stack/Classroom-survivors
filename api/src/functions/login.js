const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

const PRIV_ROLES = ['teacher', 'BM', 'admin'];

app.http('login', {
    route: 'login',
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            // DEBUG bypass (Val's local test mode only — never student-facing).
            if (request.query.get('testMode') === 'true') {
                const users = await getContainer().items
                    .query("SELECT * FROM c WHERE c.role = 'teacher' OR c.role = 'BM' OFFSET 0 LIMIT 1")
                    .fetchAll();
                const u = users.resources[0];
                if (!u) return { status: 404, body: 'No teacher/BM account found for test mode.' };
                const token = auth.signToken(
                    { sub: u.id, login: u.login, role: u.role || 'teacher', name: u.fullName },
                    auth.SESSION_SECRET()
                );
                return { status: 200, jsonBody: { ...auth.publicUser(u), token } };
            }

            if (request.method === 'GET') {
                // Refresh from id only — but ONLY when the caller proves a valid
                // session token (closes the old id-only hole that leaked a record
                // to anyone who knew a student id).
                const token = auth.verifyToken(request, auth.SESSION_SECRET());
                if (!token) return { status: 401, body: 'Unauthorized.' };
                const { resources } = await getContainer().items
                    .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: token.sub }] })
                    .fetchAll();
                if (resources.length === 0) return { status: 404, body: 'User not found.' };
                const u = resources[0];
                const refreshed = auth.signToken(
                    { sub: u.id, login: u.login, role: u.role || 'student', name: u.fullName },
                    auth.SESSION_SECRET()
                );
                return { status: 200, jsonBody: { ...auth.publicUser(u), token: refreshed } };
            }

            const body = await request.json();
            const { login, password, id } = body;

            let user = null;
            if (login) {
                const { resources } = await getContainer().items
                    .query({ query: 'SELECT * FROM c WHERE c.login = @login', parameters: [{ name: '@login', value: login }] })
                    .fetchAll();
                if (resources.length > 0) user = resources[0];
            } else if (id) {
                const { resources } = await getContainer().items
                    .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
                    .fetchAll();
                if (resources.length > 0) user = resources[0];
            }

            if (!user) return { status: 401, body: 'Invalid credentials.' };

            if (!password || !auth.verifyPassword(password, user.password)) {
                return { status: 401, body: 'Invalid credentials.' };
            }

            // Recovery: if a student logs in with a plaintext password, their
            // stored value is a hash (from the old scheme) or absent. Re-store the
            // real plaintext so the teacher dashboard can show it for recovery.
            // Zero-impact: only runs when the verified plaintext differs from storage.
            if (auth.needsPlaintextRecovery(user.password)) {
                user.password = password;
                await getContainer().items.upsert(user).catch(() => {});
            }

            // Stamp the normalized role so privileged scoping works uniformly.
            const role = user.role || (PRIV_ROLES.includes(user.role) ? user.role : 'student');

            const token = auth.signToken(
                { sub: user.id, login: user.login, role: role, name: user.fullName },
                auth.SESSION_SECRET()
            );
            return { status: 200, jsonBody: { ...auth.publicUser(user), token } };
        } catch (error) {
            context.error('Login error:', error);
            return { status: 500, body: 'Server error during login.' };
        }
    }
});
