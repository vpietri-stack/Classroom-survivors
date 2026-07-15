const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

app.http('setTargets', {
    route: 'setTargets',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
            const authGate = auth.requireAuth(request);
            if (authGate.error) return authGate.error;
            const token = authGate.token;
            if (token && !auth.isPrivileged(token, ['teacher', 'BM'])) {
                return auth.forbidden();
            }
            const container = getContainer();
            const body = await request.json();
            const { studentIds, target } = body;

            if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
                return { status: 400, body: "Missing or empty studentIds array." };
            }
            if (!target || !target.startTime || !target.endTime || !target.targetSessions) {
                return { status: 400, body: "Missing target fields: startTime, endTime, targetSessions." };
            }

            const targetStart = new Date(target.startTime).getTime();
            const targetEnd = new Date(target.endTime).getTime();

            if (isNaN(targetStart) || isNaN(targetEnd) || targetEnd <= targetStart) {
                return { status: 400, body: "Invalid date range: endTime must be after startTime." };
            }

            const results = [];

            for (const studentId of studentIds) {
                const querySpec = {
                    query: "SELECT * FROM c WHERE c.id = @id",
                    parameters: [{ name: "@id", value: studentId }]
                };
                const { resources: items } = await container.items.query(querySpec).fetchAll();

                if (items.length === 0) {
                    results.push({ studentId, success: false, error: "Not found" });
                    continue;
                }

                const user = items[0];
                if (!user.targets) user.targets = [];

                const targetId = `t_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

                user.targets = user.targets.filter(t => {
                    const existStart = new Date(t.startTime).getTime();
                    const existEnd = new Date(t.endTime).getTime();
                    return !(targetStart <= existStart && targetEnd >= existEnd);
                });

                user.targets.push({
                    id: targetId,
                    startTime: target.startTime,
                    endTime: target.endTime,
                    targetSessions: target.targetSessions
                });

                await container.items.upsert(user);
                results.push({ studentId, success: true, targetId });
            }

            return {
                status: 200,
                jsonBody: { success: true, results }
            };
        } catch (error) {
            context.error("setTargets failed:", error);
            return { status: 500, body: "Server error setting targets." };
        }
    }
});
