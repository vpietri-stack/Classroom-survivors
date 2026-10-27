// Operator setup. No student profile/progress changes. Explicit target required.
// node setup_client_diagnostics.js --database Val-EslApp --student-id <id>
// --container client_diagnostics_test can isolate a short-lived backend test.
const { CosmosClient } = require('@azure/cosmos');
const cfg = require('./local.settings.json').Values;
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : ''; }
(async () => {
    const name = arg('--database'), studentId = arg('--student-id'), id = arg('--container') || 'client_diagnostics';
    if (!name || !/^[A-Za-z0-9_-]+$/.test(studentId) || !/^client_diagnostics(?:_test)?$/.test(id)) throw new Error('Explicit database/student and a diagnostics container are required');
    const client = new CosmosClient({ endpoint: cfg.COSMOS_ENDPOINT, key: cfg.COSMOS_KEY });
    const db = client.database(name);
    const offer = await db.readOffer();
    if (!offer.resource) throw new Error('Use a database with existing shared throughput; no new throughput will be provisioned');
    const { container } = await db.containers.createIfNotExists({ id, partitionKey: { paths: ['/studentId'] }, defaultTtl: 14 * 86400,
        indexingPolicy: { indexingMode: 'consistent', automatic: true, includedPaths: [{ path: '/type/?' }, { path: '/updatedAt/?' }], excludedPaths: [{ path: '/*' }] } });
    const { resource: metadata } = await container.read();
    if (metadata.defaultTtl !== 14 * 86400 || metadata.partitionKey.paths[0] !== '/studentId') throw new Error('Unexpected diagnostics container schema');
    const endsAt = new Date(Date.now() + 7 * 86400000).toISOString();
    await container.items.upsert({ id: 'config', studentId, type: 'client_diagnostics_config', enabled: true,
        endsAt, updatedAt: new Date().toISOString(), ttl: -1 });
    console.log(JSON.stringify({ database: name, container: id, enabled: true, endsAt, retentionDays: 14 }));
})().catch(e => { console.error('Diagnostics setup failed:', e.code || e.message); process.exitCode = 1; });
