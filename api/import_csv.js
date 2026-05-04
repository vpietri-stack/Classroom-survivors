const { CosmosClient } = require('@azure/cosmos');
const config = require('./local.settings.json');
const fs = require('fs');

const endpoint = config.Values.COSMOS_ENDPOINT;
const key = config.Values.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

async function main() {
    const csvContent = fs.readFileSync('./student list.csv', 'utf-8');
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l);
    
    const header = lines[0].split(',');
    
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length !== header.length) continue;
        
        const student = {};
        for (let j = 0; j < header.length; j++) {
            let key = header[j];
            let val = row[j];
            
            if (key === 'needsPasswordChange') {
                val = val.toUpperCase() === 'TRUE';
            }
            if (key === 'Class time') {
                key = 'classTime';
            }
            student[key] = val;
        }
        
        student.role = 'student'; // make sure role is set
        
        // Fetch existing
        const { resources: existingDocs } = await container.items.query({
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: student.id }]
        }).fetchAll();
        
        if (existingDocs.length > 0) {
            const existing = existingDocs[0];
            // Update fields from CSV
            for (const key of Object.keys(student)) {
                existing[key] = student[key];
            }
            await container.items.upsert(existing);
            console.log(`Updated existing student: ${student.id} (${student.fullName})`);
        } else {
            // Create new
            await container.items.create(student);
            console.log(`Created new student: ${student.id} (${student.fullName})`);
        }
    }
    
    console.log('Import completed.');
}

main().catch(console.error);
