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

async function migrate() {
    console.log('Starting migration...');

    // Step 1: Change role 'teacher' to 'BM'
    console.log('Step 1: Changing role "teacher" to "BM"...');
    const { resources: teachers } = await container.items
        .query("SELECT * FROM c WHERE c.role = 'teacher'")
        .fetchAll();

    let teacherUpdateCount = 0;
    for (const doc of teachers) {
        doc.role = 'BM';
        await container.items.upsert(doc);
        console.log(`Updated role to BM: ${doc.id}`);
        teacherUpdateCount++;
    }
    console.log(`Step 1 complete. Updated ${teacherUpdateCount} document(s) from teacher to BM.`);

    // Step 2: Add teacher field to students missing it
    console.log('Step 2: Adding teacher field to students without one...');
    const { resources: students } = await container.items
        .query("SELECT * FROM c WHERE c.role = 'student' AND (NOT IS_DEFINED(c.teacher) OR c.teacher = null)")
        .fetchAll();

    let studentUpdateCount = 0;
    for (const doc of students) {
        doc.teacher = 'Val';
        await container.items.upsert(doc);
        console.log(`Set teacher to Val: ${doc.id}`);
        studentUpdateCount++;
    }
    console.log(`Step 2 complete. Updated ${studentUpdateCount} document(s) with teacher = "Val".`);

    console.log('Migration complete!');
    console.log(`Total documents updated: ${teacherUpdateCount + studentUpdateCount}`);
}

migrate().catch(err => {
    console.error('Migration failed with error:', err);
});
