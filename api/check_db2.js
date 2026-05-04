const { CosmosClient } = require('@azure/cosmos');
const config = require('./local.settings.json');

const endpoint = config.Values.COSMOS_ENDPOINT;
const key = config.Values.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

async function main() {
    console.log("Querying for test1...");
    const { resources: items } = await container.items.query({
        query: "SELECT * FROM c WHERE c.login = 'test1'"
    }).fetchAll();
    
    console.log("Found:", JSON.stringify(items[0], null, 2));
}

main().catch(console.error);
