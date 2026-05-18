const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { validateApiKey } = require('./shared/validateApiKey');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

app.http('addStudent', {
    route: 'addStudent',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
            const { id, login, password, fullName, classTime, book, unit, page, needsPasswordChange } = body;

            if (!id || !login || !password || !fullName) {
                return { status: 400, body: "Missing required fields: id, login, password, fullName." };
            }

            // Check if id already exists
            const checkSpec = {
                query: "SELECT c.id FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: id }]
            };
            const { resources: existing } = await container.items.query(checkSpec).fetchAll();
            if (existing.length > 0) {
                return { status: 409, body: "A student with this ID already exists." };
            }

            // Check if login already exists
            const loginCheckSpec = {
                query: "SELECT c.id FROM c WHERE c.login = @login",
                parameters: [{ name: "@login", value: login }]
            };
            const { resources: loginExisting } = await container.items.query(loginCheckSpec).fetchAll();
            if (loginExisting.length > 0) {
                return { status: 409, body: "A student with this login already exists." };
            }

            const newStudent = {
                id: id,
                login: login,
                password: password,
                fullName: fullName,
                role: 'student',
                classTime: classTime || null,
                book: book || null,
                unit: unit || null,
                page: page || null,
                avatar: null,
                needsPasswordChange: needsPasswordChange !== false, // default true
                analytics: [],
                srState: { vocab: {}, sentences: {}, sentencePairs: {} },
                sessionCount: 0,
                targets: []
            };

            await container.items.create(newStudent);

            return {
                status: 201,
                jsonBody: { success: true, message: "Student created.", student: newStudent }
            };
        } catch (error) {
            context.error("addStudent failed:", error);
            return { status: 500, body: "Server error creating student." };
        }
    }
});
