const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const config = require('./local.settings.json');

const endpoint = config.Values.COSMOS_ENDPOINT;
const key = config.Values.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

async function testChangePassword() {
    const id = 'student_max_huangruoxuan';
    const newPassword = 'newPassword123';

    try {
        console.log("Querying for user:", id);
        const querySpec = {
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: id }]
        };
        const { resources: items } = await container.items.query(querySpec).fetchAll();

        if (items.length === 0) {
            console.log("User not found!");
            return;
        }
        
        const user = items[0];
        console.log("User found:", user.id);

        user.password = newPassword;
        user.needsPasswordChange = false;

        console.log("Upserting user...");
        await container.items.upsert(user);
        console.log("Upsert successful!");
    } catch (e) {
        console.error("Error during change password:", e);
    }
}

testChangePassword();
