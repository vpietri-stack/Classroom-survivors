const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');

// Read Cosmos DB connection details from local.settings.json
const settingsPath = path.join(__dirname, 'local.settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

const endpoint = settings.Values.COSMOS_ENDPOINT;
const key = settings.Values.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const database = client.database('Val-EslApp');
const container = database.container('Students');

async function addTeacher() {
    console.log('Injecting teacher account...');

    const teacherAccount = {
        "id": "teacher_admin",
        "login": "Valerian_pietri",
        "password": "l1l1l4f0urm!",
        "role": "teacher"
    };

    try {
        await container.items.upsert(teacherAccount);
        console.log(`Successfully upserted: ${teacherAccount.id}`);
    } catch (error) {
        console.error(`Failed to upsert teacher account:`, error.message);
    }
    
    console.log('Operation complete!');
}

addTeacher().catch(err => {
    console.error('Operation failed with error:', err);
});
