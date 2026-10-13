const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');
const calendar = require('./shared/classCalendarCore');

const PRIV_ROLES = ['teacher', 'BM', 'admin'];
// Self-service placement (2026-09-16, "Val PC 403"): the client auto-advance
// calls updateStudent with {book,unit,page} from the STUDENT's own session.
// That call always 403'd (student token not in PRIV_ROLES), so the 43->48
// move could never stick server-side. Allow a login to update ONLY its own
// placement fields; everything else still needs a privileged role.
const SELF_PLACEMENT_FIELDS = ['book', 'unit', 'page'];

app.http('updateStudent', {
    route: 'updateStudent',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };

            // Only teachers/BMs may edit student records. Legacy (no-token) mode
            // permits the action (client-supplied id) until the new client ships.
            // EXCEPTION (2026-09-16): a login may update its OWN placement
            // (book/unit/page only) — the spaced-repetition auto-advance runs
            // on the student device and must stick server-side.
            const authGate = auth.requireAuth(request);
            if (authGate.error) return authGate.error;
            const token = authGate.token;
            const body = await request.json();
            const { studentId, fields } = body;

            if (!studentId || !fields || typeof fields !== 'object') {
                return { status: 400, body: 'Missing studentId or fields object.' };
            }

            const isSelfPlacement = token && token.sub === studentId &&
                Object.keys(fields).every(k => SELF_PLACEMENT_FIELDS.includes(k));
            if (token && !PRIV_ROLES.includes(token.role) && !isSelfPlacement) return auth.forbidden();

            const allowedFields = [
                'book', 'unit', 'page', 'classTime', 'password',
                'needsPasswordChange', 'fullName', 'login', 'targets', 'teacher',
                'vsPromoSeen', 'classGroups'
            ];
            if (fields.classGroups !== undefined) {
                if (!Array.isArray(fields.classGroups) || fields.classGroups.length > 20 || fields.classGroups.some(g => !g || typeof g.teacher !== 'string' || typeof g.classTime !== 'string' || g.teacher.trim().length > 120 || !calendar.parseClassTime(g.classTime))) {
                    return { status: 400, body: 'Choose valid additional class groups (maximum 20).' };
                }
                fields.classGroups = calendar.memberships({classGroups:fields.classGroups}).filter(g => g.classTime);
            }

            const { resources: items } = await getContainer().items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: studentId }] })
                .fetchAll();
            if (items.length === 0) return { status: 404, body: 'Student not found.' };

            const user = items[0];
            if (body.expectedTargets !== undefined && JSON.stringify(body.expectedTargets) !== JSON.stringify(user.targets || [])) {
                return { status: 409, body: 'Targets changed. Refresh the dashboard and retry.' };
            }
            if (fields.targets === undefined && ['teacher','classTime','classGroups'].some(k => fields[k] !== undefined) && user.targets) {
                const next = {...user,...fields};
                const source = calendar.memberships(next).length > calendar.memberships(user).length ? next : user;
                // Bind existing periods before changing memberships; never alter their dates/counts.
                fields.targets = user.targets.map(t => {
                    const key = calendar.targetGroupKey(source,t);
                    return key ? {...t,groupKey:key} : t;
                });
            }
            const changes = {};

            for (const key of allowedFields) {
                if (fields[key] !== undefined) {
                    if (JSON.stringify(user[key]) !== JSON.stringify(fields[key])) {
                        changes[key] = { from: user[key], to: fields[key] };
                    }
                    // Store as-is (plaintext) so the teacher dashboard can display it.
                    user[key] = fields[key];
                }
            }

            // Patch only edited fields so a concurrent analytics/attendance save is preserved.
            // Keep membership and target bindings in the same patch; omit unchanged form fields.
            const patchOrder = ['teacher','classTime','classGroups','targets',...allowedFields.filter(k => !['teacher','classTime','classGroups','targets'].includes(k))];
            const operations = patchOrder.filter(key => changes[key])
                .map(key => ({ op: 'set', path: '/' + key, value: fields[key] }));
            for (let i = 0; i < operations.length; i += 10) {
                const result = await getContainer().item(user.id, user.studentId === undefined ? undefined : user.studentId).patch(operations.slice(i, i + 10),
                    changes.targets || changes.classGroups || changes.teacher || changes.classTime ? {accessCondition:{type:'IfMatch',condition:user._etag}} : undefined);
                if (result.resource) user._etag = result.resource._etag;
            }

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
            if (Number(error.code || error.statusCode) === 412) return { status: 409, body: 'Student changed. Refresh the dashboard and retry.' };
            context.error('updateStudent failed:', error);
            return { status: 500, body: 'Server error updating student.' };
        }
    }
});
