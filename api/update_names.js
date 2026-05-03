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

async function updateNames() {
    console.log('Starting full name update...');
    
    const csvPath = path.join(__dirname, '../student list.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    // Split lines and handle both \r\n and \n
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    
    // Skip header line
    const dataLines = lines.slice(1);
    
    let successCount = 0;
    let errorCount = 0;

    for (const line of dataLines) {
        // id,login,password,needsPasswordChange,Class time,fullName
        const cols = line.split(',');
        
        if (cols.length < 6) {
            console.log(`Skipping invalid line: ${line}`);
            continue;
        }

        const studentId = cols[0].trim();
        const newFullName = cols[5].trim();

        try {
            // Read the existing student to preserve any other properties we might not know about
            // (Even though the CSV has all main properties, fetching first is safest)
            const { resource: existingStudent } = await container.item(studentId, studentId).read().catch(() => ({ resource: null }));
            
            let studentToUpsert;

            if (existingStudent) {
                // Merge the new fullName into the existing student data
                studentToUpsert = {
                    ...existingStudent,
                    fullName: newFullName
                };
            } else {
                // Fallback: recreate entirely from CSV if it somehow doesn't exist
                studentToUpsert = {
                    id: studentId,
                    login: cols[1].trim(),
                    password: cols[2].trim(),
                    needsPasswordChange: cols[3].trim().toUpperCase() === 'TRUE',
                    classTime: cols[4].trim(),
                    fullName: newFullName,
                    role: 'student'
                };
            }

            await container.items.upsert(studentToUpsert);
            console.log(`Updated fullName for: ${studentId}`);
            successCount++;
        } catch (error) {
            console.error(`Failed to update ${studentId}:`, error.message);
            errorCount++;
        }
    }
    
    console.log('Update complete!');
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed to update: ${errorCount}`);
}

updateNames().catch(err => {
    console.error('Update failed with error:', err);
});
