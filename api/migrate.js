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
    
    const csvPath = path.join(__dirname, '../student list.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    // Split lines and handle both \r\n and \n
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    
    // Skip header line
    const dataLines = lines.slice(1);
    
    let successCount = 0;
    let errorCount = 0;

    for (const line of dataLines) {
        // id,login,password,needsPasswordChange,Class time
        const cols = line.split(',');
        
        if (cols.length < 5) {
            console.log(`Skipping invalid line: ${line}`);
            continue;
        }

        const student = {
            id: cols[0].trim(),
            login: cols[1].trim(),
            password: cols[2].trim(),
            needsPasswordChange: cols[3].trim().toUpperCase() === 'TRUE',
            classTime: cols[4].trim(),
            role: 'student'
        };

        try {
            await container.items.upsert(student);
            console.log(`Upserted: ${student.id}`);
            successCount++;
        } catch (error) {
            console.error(`Failed to upsert ${student.id}:`, error.message);
            errorCount++;
        }
    }
    
    console.log('Migration complete!');
    console.log(`Successfully uploaded: ${successCount}`);
    console.log(`Failed to upload: ${errorCount}`);
}

migrate().catch(err => {
    console.error('Migration failed with error:', err);
});
