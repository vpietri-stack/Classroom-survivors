const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { validateApiKey } = require('./shared/validateApiKey');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

app.http('updateStudent', {
    route: 'updateStudent',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
            const { studentId, fields } = body;

            if (!studentId || !fields || typeof fields !== 'object') {
                return { status: 400, body: "Missing studentId or fields object." };
            }

            // Allowed fields that admin can update
            const allowedFields = [
                'book', 'unit', 'page', 'classTime', 'password',
                'needsPasswordChange', 'fullName', 'login', 'targets', 'teacher'
            ];

            // Read existing student
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: studentId }]
            };
            const { resources: items } = await container.items.query(querySpec).fetchAll();

            if (items.length === 0) {
                return { status: 404, body: "Student not found." };
            }

            const user = items[0];
            const changes = {};

            // Merge only allowed fields
            for (const key of allowedFields) {
                if (fields[key] !== undefined) {
                    if (user[key] !== fields[key]) {
                        changes[key] = { from: user[key], to: fields[key] };
                    }
                    user[key] = fields[key];
                }
            }

            await container.items.upsert(user);

            // Log activity if updated by a teacher/BM or admin
            const creatorId = request.query.get('creatorId') || 'unknown';
            if (creatorId !== 'unknown' && Object.keys(changes).length > 0) {
                const logId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const activityLog = {
                    id: logId,
                    role: 'bmActivity',
                    timestamp: new Date().toISOString(),
                    bmId: creatorId,
                    action: 'update_student',
                    details: {
                        studentId: studentId,
                        studentName: user.fullName || user.login,
                        changes: changes
                    }
                };
                await container.items.create(activityLog).catch(err => {
                    context.error("Failed to write activity log:", err);
                });
            }

            return {
                status: 200,
                jsonBody: { success: true, message: "Student updated.", student: user }
            };
        } catch (error) {
            context.error("updateStudent failed:", error);
            return { status: 500, body: "Server error updating student." };
        }
    }
});
