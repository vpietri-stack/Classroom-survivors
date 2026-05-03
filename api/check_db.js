const { CosmosClient } = require('@azure/cosmos');
const config = require('./local.settings.json');

const endpoint = config.Values.COSMOS_ENDPOINT;
const key = config.Values.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

async function main() {
    console.log("Querying for Max...");
    const { resources: byLogin } = await container.items.query({
        query: "SELECT * FROM c WHERE c.fullName = 'Max'"
    }).fetchAll();
    
    console.log("Found by name:", byLogin);

    if (byLogin.length > 0) {
        const id = byLogin[0].id;
        console.log("User ID is:", id);
        console.log("Querying by ID...");
        
        const { resources: byId } = await container.items.query({
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: id }]
        }).fetchAll();
        
        console.log("Found by ID length:", byId.length);
    }
}

main().catch(console.error);
