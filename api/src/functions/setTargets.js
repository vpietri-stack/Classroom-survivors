const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');
const calendar = require('./shared/classCalendarCore');

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
            if (token && !auth.isPrivileged(token)) {
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

            if (isNaN(targetStart) || isNaN(targetEnd) || targetEnd <= targetStart || !Number.isInteger(target.targetSessions) || target.targetSessions < 1) {
                return { status: 400, body: "Invalid date range: endTime must be after startTime." };
            }

            const results = [];

            for (const studentId of studentIds) {
                for (let attempt = 0; attempt < 4; attempt++) {
                    const querySpec = {
                        query: "SELECT * FROM c WHERE c.id = @id",
                        parameters: [{ name: "@id", value: studentId }]
                    };
                    const { resources: items } = await container.items.query(querySpec).fetchAll();

                    if (items.length === 0) {
                        results.push({ studentId, success: false, error: "Not found" });
                        break;
                    }

                    const user = items[0];
                    if (!user.targets) user.targets = [];
                    const memberships = calendar.memberships(user);
                    let key = target.groupKey;
                    if (!key && target.classTime) {
                        const matches = memberships.filter(g => g.classTime === target.classTime && (!target.teacher || g.teacher === target.teacher));
                        if (matches.length === 1) key = calendar.groupKey(matches[0].teacher, matches[0].classTime);
                    } else if (!key) key = calendar.targetGroupKey(user, target);
                    if (!key || !memberships.some(g => calendar.groupKey(g.teacher,g.classTime) === key)) {
                        results.push({ studentId, success: false, error: 'Select a class group for this target.' });
                        break;
                    }

                    const targetId = `t_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

                    user.targets = user.targets.filter(t => {
                        const existStart = new Date(t.startTime).getTime();
                        const existEnd = new Date(t.endTime).getTime();
                        return !calendar.targetBelongsTo(user,t,key) || !(targetStart <= existStart && targetEnd >= existEnd);
                    });

                    user.targets.push({
                        id: targetId,
                        groupKey: key,
                        startTime: target.startTime,
                        endTime: target.endTime,
                        targetSessions: target.targetSessions
                    });

                    try {
                        await container.item(user.id, user.studentId === undefined ? undefined : user.studentId).patch(
                            [{ op: 'set', path: '/targets', value: user.targets }],
                            { accessCondition: { type: 'IfMatch', condition: user._etag } });
                        results.push({ studentId, success: true, targetId, targets: user.targets });
                        break;
                    } catch (err) {
                        if (Number(err.code || err.statusCode) === 412 && attempt < 3) continue;
                        results.push({ studentId, success: false, error: 'Could not save target. Please retry.' });
                        break;
                    }
                }
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
