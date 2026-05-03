const { CosmosClient } = require('@azure/cosmos');
const config = require('./local.settings.json');

const endpoint = config.Values.COSMOS_ENDPOINT;
const key = config.Values.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

async function testRead() {
    const id = 'student_max_huangruoxuan';

    try {
        console.log("Reading item directly by ID and Partition Key...");
        const { resource: user } = await container.item(id, id).read();
        if (!user) {
            console.log("User not found!");
        } else {
            console.log("User found:", user.id);
        }
    } catch (e) {
        console.error("Error reading item:", e.message);
    }
}

testRead();
