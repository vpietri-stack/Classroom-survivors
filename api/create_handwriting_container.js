#!/usr/bin/env node
/* create_handwriting_container.js — one-time provisioning for the handwriting
 * trace collection.
 *
 * Run from api/ (needs api/local.settings.json with COSMOS_ENDPOINT / COSMOS_KEY):
 *   node create_handwriting_container.js
 *
 * Idempotent: createIfNotExists, so re-running is a no-op that prints what is
 * there. Cosmos does NOT create a container on first write — without this the
 * upload endpoint would 500 on every trace and the client would silently drop
 * them all (it is designed never to bother the student with a research failure).
 *
 * The container must live in the SAME database as Students so it shares that
 * database's autoscale pool; a second database would need its own 1000 RU/s
 * minimum. The partition key must stay /studentId: the upload endpoint's daily
 * cap query and the download script's per-student filter both rely on it.
 */
const fs = require('fs');
const path = require('path');
const { CosmosClient } = require('@azure/cosmos');

const CONTAINER = process.env.COSMOS_HANDWRITING_SAMPLES_CONTAINER || 'handwriting_samples';
const PARTITION_KEY = '/studentId';

function loadSettings() {
    const p = path.join(__dirname, 'local.settings.json');
    if (!fs.existsSync(p)) {
        console.error('api/local.settings.json not found — cannot reach Cosmos.');
        process.exit(1);
    }
    const v = require(p).Values || {};
    if (!v.COSMOS_ENDPOINT || !v.COSMOS_KEY) {
        console.error('COSMOS_ENDPOINT / COSMOS_KEY missing from local.settings.json');
        process.exit(1);
    }
    return v;
}

(async () => {
    const v = loadSettings();
    const client = new CosmosClient({ endpoint: v.COSMOS_ENDPOINT, key: v.COSMOS_KEY });
    const dbName = process.env.COSMOS_DB_NAME_OVERRIDE || 'Val-EslApp';
    const database = client.database(dbName);

    const before = (await database.containers.readAll().fetchAll()).resources.map(c => c.id);
    console.log('Database ' + dbName + ' containers: ' + (before.join(', ') || '(none)'));

    const { resource, statusCode } = await database.containers.createIfNotExists({
        id: CONTAINER,
        partitionKey: { paths: [PARTITION_KEY], kind: 'Hash' },
        // No throughput offered deliberately: the container inherits the
        // database's shared autoscale pool, which is what keeps it inside the
        // free-tier allowance.
    });

    const after = (await database.containers.readAll().fetchAll()).resources.map(c => c.id);
    console.log(statusCode === 201
        ? `CREATED ${dbName}/${CONTAINER} (partition key ${PARTITION_KEY})`
        : `ALREADY EXISTS ${dbName}/${CONTAINER} (status ${statusCode}) — nothing changed`);
    console.log('Now: ' + (after.join(', ') || '(none)'));
    console.log('\nCapture stays OFF until the Function App setting HANDWRITING_SAMPLE_IDS is set');
    console.log('(`*` = every signed-in student, or a comma-separated list of student ids).');
})().catch(e => { console.error('Provisioning failed:', e.message); process.exit(1); });
