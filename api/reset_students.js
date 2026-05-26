const { CosmosClient, undefinedPartitionKey } = require('@azure/cosmos');
const config = require('./local.settings.json');
const fs = require('fs');
const path = require('path');

const endpoint = config.Values.COSMOS_ENDPOINT;
const key = config.Values.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });
const database = client.database('Val-EslApp');
const container = database.container('Students');

async function main() {
    console.log('Fetching all existing students to delete...');
    const { resources: existingStudents } = await container.items.query({
        query: "SELECT * FROM c WHERE c.role = 'student'"
    }).fetchAll();

    console.log(`Found ${existingStudents.length} student(s) to delete.`);
    for (const student of existingStudents) {
        try {
            await container.item(student.id, undefinedPartitionKey).delete();
            console.log(`Deleted student: ${student.id}`);
        } catch (err) {
            console.error(`Failed to delete student ${student.id}:`, err.message);
        }
    }

    console.log('Reading student list.csv...');
    const csvPath = path.join(__dirname, '../student list.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    
    if (lines.length === 0) {
        console.error('CSV file is empty.');
        return;
    }

    const header = lines[0].split(',').map(h => h.trim());
    
    let createdCount = 0;
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(col => col.trim());
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
        
        student.role = 'student'; // force role to 'student'
        
        try {
            await container.items.create(student);
            console.log(`Created new student: ${student.id} (${student.fullName})`);
            createdCount++;
        } catch (err) {
            console.error(`Failed to create student ${student.id}:`, err.message);
        }
    }
    
    console.log(`Import completed. Total created: ${createdCount} students.`);
}

main().catch(console.error);
