const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { validateApiKey } = require('./shared/validateApiKey');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

app.http('manageBms', {
    route: 'manageBms',
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
            
            const method = request.method;

            if (method === 'GET') {
                const action = request.query.get('action') || 'list';

                if (action === 'list') {
                    const { resources: bms } = await container.items
                        .query("SELECT * FROM c WHERE c.role = 'BM'")
                        .fetchAll();
                    return { status: 200, jsonBody: bms };
                } else if (action === 'logs') {
                    const { resources: logs } = await container.items
                        .query("SELECT * FROM c WHERE c.role = 'bmActivity' ORDER BY c.timestamp DESC")
                        .fetchAll();
                    return { status: 200, jsonBody: logs };
                } else {
                    return { status: 400, body: 'Invalid action.' };
                }
            }

            if (method === 'POST') {
                const body = await request.json();
                const { action } = body;

                if (action === 'add') {
                    const { id, login, password, fullName } = body;
                    if (!id || !login || !password || !fullName) {
                        return { status: 400, body: 'Missing fields.' };
                    }

                    // Check duplicate
                    const { resources: existing } = await container.items
                        .query({
                            query: "SELECT c.id FROM c WHERE c.id = @id OR c.login = @login",
                            parameters: [{ name: '@id', value: id }, { name: '@login', value: login }]
                        }).fetchAll();

                    if (existing.length > 0) {
                        return { status: 409, body: 'BM ID or login already exists.' };
                    }

                    const newBm = {
                        id,
                        login,
                        password,
                        fullName,
                        role: 'BM'
                    };

                    await container.items.create(newBm);
                    return { status: 201, jsonBody: { success: true, bm: newBm } };
                } 
                
                if (action === 'changePassword') {
                    const { bmId, password } = body;
                    if (!bmId || !password) {
                        return { status: 400, body: 'Missing BM ID or password.' };
                    }

                    const { resources: items } = await container.items
                        .query({
                            query: "SELECT * FROM c WHERE c.id = @id AND c.role = 'BM'",
                            parameters: [{ name: '@id', value: bmId }]
                        }).fetchAll();

                    if (items.length === 0) {
                        return { status: 404, body: 'BM not found.' };
                    }

                    const bm = items[0];
                    bm.password = password;
                    await container.items.upsert(bm);
                    return { status: 200, jsonBody: { success: true } };
                }

                if (action === 'delete') {
                    const { bmId } = body;
                    if (!bmId) {
                        return { status: 400, body: 'Missing BM ID.' };
                    }

                    const { resources: items } = await container.items
                        .query({
                            query: "SELECT * FROM c WHERE c.id = @id AND c.role = 'BM'",
                            parameters: [{ name: '@id', value: bmId }]
                        }).fetchAll();

                    if (items.length === 0) {
                        return { status: 404, body: 'BM not found.' };
                    }

                    await container.item(bmId, bmId).delete();
                    return { status: 200, jsonBody: { success: true } };
                }

                return { status: 400, body: 'Invalid POST action.' };
            }

            return { status: 405, body: 'Method not allowed.' };
        } catch (error) {
            context.error("manageBms failed:", error);
            return { status: 500, body: "Server error managing BMs." };
        }
    }
});
