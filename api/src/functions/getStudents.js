const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

app.http('getStudents', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Fetching students from the database...');

        try {
            // 1. Connect to Cosmos DB using your hidden keys from local.settings.json
            const client = new CosmosClient({
                endpoint: process.env.COSMOS_ENDPOINT,
                key: process.env.COSMOS_KEY
            });

            // 2. Select the specific database and container you made earlier
            const database = client.database('Val-EslApp');
            const container = database.container('Students');

            // 3. Fetch all items in the container
            const { resources } = await container.items.readAll().fetchAll();

            // 4. Return the data to your game!
            return {
                status: 200,
                jsonBody: resources
            };
        } catch (error) {
            context.error("Database connection failed:", error);
            return {
                status: 500,
                body: "Error connecting to the database."
            };
        }
    }
});
