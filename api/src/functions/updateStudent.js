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
                'needsPasswordChange', 'fullName', 'login', 'targets'
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

            // Merge only allowed fields
            for (const key of allowedFields) {
                if (fields[key] !== undefined) {
                    user[key] = fields[key];
                }
            }

            await container.items.upsert(user);

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
