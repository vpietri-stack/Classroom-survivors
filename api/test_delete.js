const { CosmosClient, undefinedPartitionKey } = require('@azure/cosmos');
const config = require('./local.settings.json');

const endpoint = config.Values.COSMOS_ENDPOINT;
const key = config.Values.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

async function main() {
    const id = 'student_test2';
    
    // Try to read using undefinedPartitionKey
    try {
        console.log("Trying to read with undefinedPartitionKey...");
        const { resource } = await container.item(id, undefinedPartitionKey).read();
        console.log("Success reading!", resource ? resource.id : 'null');
    } catch (err) {
        console.error("Failed reading with undefinedPartitionKey:", err.message);
    }

    // Try to read with undefined
    try {
        console.log("Trying to read with undefined...");
        const { resource } = await container.item(id, undefined).read();
        console.log("Success reading with undefined!", resource ? resource.id : 'null');
    } catch (err) {
        console.error("Failed reading with undefined:", err.message);
    }
}

main().catch(console.error);
