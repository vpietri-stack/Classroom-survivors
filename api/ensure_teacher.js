const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, 'local.settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

const endpoint = settings.Values.COSMOS_ENDPOINT;
const key = settings.Values.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const database = client.database('Val-EslApp');
const container = database.container('Students');

async function ensureTeacher() {
    console.log('Ensuring teacher account has fullName...');

    const teacherAccount = {
        "id": "teacher_admin",
        "login": "Valerian_pietri",
        "password": "l1l1l4f0urm!",
        "role": "teacher",
        "fullName": "Valerian"
    };

    try {
        await container.items.upsert(teacherAccount);
        console.log(`Successfully upserted teacher: ${teacherAccount.fullName}`);
    } catch (error) {
        console.error(`Failed:`, error.message);
    }
}

ensureTeacher();
