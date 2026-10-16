#!/usr/bin/env node
// Explicit operator commands. `status` and `prepare-index` are read-only by
// default. Nothing here provisions throughput or enables collection.
const fs = require('fs');
const path = require('path');
const { randomUUID, randomBytes } = require('crypto');
const { CosmosClient } = require('@azure/cosmos');
const store = require('./src/functions/shared/speechSampleStore');
const policy = require('./src/functions/shared/speechSamples');

function arg(name, fallback) {
    const i = process.argv.indexOf('--' + name);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function settings() {
    const file = path.resolve(arg('settings', path.join(__dirname, 'local.settings.json')));
    const v = JSON.parse(fs.readFileSync(file, 'utf8')).Values || {};
    if (!v.COSMOS_ENDPOINT || !v.COSMOS_KEY) throw new Error('Settings lack Cosmos credentials.');
    return v;
}
function indexPlan(definition) {
    const indexingPolicy = JSON.parse(JSON.stringify(definition.indexingPolicy));
    indexingPolicy.excludedPaths = indexingPolicy.excludedPaths || [];
    if (!indexingPolicy.excludedPaths.some(x => x.path === '/wavBase64/?')) indexingPolicy.excludedPaths.push({ path: '/wavBase64/?' });
    return indexingPolicy;
}
function percentile(values, fraction) {
    const v = [...values].sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * fraction))] : null;
}
async function status(client, database, containerName) {
    const db = client.database(database), container = db.container(containerName);
    const [definition, offer, rows, control, progress] = await Promise.all([
        container.read({ populateQuotaInfo: true }), db.readOffer(),
        container.items.query("SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.type) OR c.type = 'speech_sample'").fetchAll(),
        store.readItem(container, store.CONTROL_ID, store.CONTROL_PK, store.meter()),
        db.container('Students').items.query("SELECT c.recent FROM c WHERE c.id = 'delivery_diag_saveAnalytics'").fetchAll(),
    ]);
    return {
        database, container: containerName, samples: rows.resources[0],
        maxSharedRu: offer.resource && offer.resource.content.offerAutopilotSettings && offer.resource.content.offerAutopilotSettings.maxThroughput,
        audioExcludedFromIndex: definition.resource.indexingPolicy.excludedPaths.some(x => x.path === '/wavBase64/?'),
        resourceUsage: definition.headers['x-ms-resource-usage'],
        research: control && control.stats || null,
        latestProgressSave: (progress.resources[0] && progress.resources[0].recent || []).map(x => ({ ts: x.ts, serverSaveMs: x.serverSaveMs, progressWriteRu: x.progressWriteRu })),
    };
}

// This probe is permitted ONLY in the already provisioned test database. Every
// written ID and PK is unique to this invocation; finally deletes only those
// exact items. No production audio, accounts, or settings are changed.
async function probe(client, database, containerName) {
    if (database !== 'Val-EslApp-Test' || containerName !== 'Students') throw new Error('Probe requires --database Val-EslApp-Test --container Students.');
    const raw = client.database(database).container(containerName);
    const run = 'speech-probe-' + randomUUID();
    const pk = run, controlPk = run + '-control';
    const cleanup = new Map(), samples = [], progress = [], baseline = [];
    let originalPolicy, appliedPolicy;
    function track(doc) { cleanup.set(JSON.stringify([doc.id, doc.studentId]), [doc.id, doc.studentId]); return doc; }
    function mappedDoc(doc) { return doc.studentId === store.CONTROL_PK ? { ...doc, studentId: controlPk } : doc; }
    const container = {
        item: (id, p) => raw.item(id, p === store.CONTROL_PK ? controlPk : p),
        items: {
            create: doc => raw.items.create(track(mappedDoc(doc))),
            query: (...args) => raw.items.query(...args),
            batch: (ops, p, options) => raw.items.batch(ops.map(op => op.resourceBody ? { ...op, resourceBody: track(mappedDoc(op.resourceBody)) } : op), p, options),
        },
    };
    // Item.replace gets its PK from the bound item; copy the control body too.
    container.item = (id, p) => {
        const item = raw.item(id, p === store.CONTROL_PK ? controlPk : p);
        return { read: (...args) => item.read(...args), replace: (doc, options) => item.replace(track(mappedDoc(doc)), options) };
    };
    try {
        // Verify the intended audio-index policy in the isolated container,
        // and restore the original policy in finally. Never change production.
        const initial = await raw.read();
        originalPolicy = JSON.parse(JSON.stringify(initial.resource.indexingPolicy));
        appliedPolicy = indexPlan(initial.resource);
        const backupDir = path.resolve(__dirname, '..', 'speech_samples', 'ops');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(path.join(backupDir, run + '-index-backup.json'), JSON.stringify({ database, container: containerName, indexingPolicy: originalPolicy }, null, 2), { flag: 'wx' });
        const initialBody = { ...initial.resource, indexingPolicy: appliedPolicy };
        for (const key of Object.keys(initialBody)) if (key.startsWith('_')) delete initialBody[key];
        if (JSON.stringify(originalPolicy) !== JSON.stringify(appliedPolicy)) {
            await raw.replace(initialBody, { accessCondition: { type: 'IfMatch', condition: initial.resource._etag } });
        }
        const progressDoc = track({ id: run + '-progress', studentId: pk, type: 'speech_probe_progress', value: 'p'.repeat(32768) });
        await raw.items.create(progressDoc);
        async function saveProgress(output = progress) {
            const started = Date.now();
            const r = await raw.item(progressDoc.id, pk).replace(progressDoc);
            output.push({ ms: Date.now() - started, ru: r.requestCharge });
        }
        for (let i = 0; i < 3; i++) await saveProgress(baseline);
        for (const bytes of [200000, policy.MAX_WAV_BASE64_CHARS, 200000]) {
            console.error('Synthetic test probe: ' + bytes + ' base64 bytes');
            const usage = store.meter();
            let reservation = await store.reserve(container, pk, randomUUID(), Date.now(), usage);
            if (!reservation.lease) {
                await new Promise(r => setTimeout(r, Math.min(16000, reservation.retryAfterMs + 100)));
                reservation = await store.reserve(container, pk, randomUUID(), Date.now(), usage);
            }
            if (!reservation.lease) throw new Error('Test reservation unavailable.');
            const doc = { id: run + '-' + bytes + '-' + samples.length, studentId: pk, type: 'speech_sample',
                capturedAt: Date.now(), wavBase64: randomBytes(bytes * 3 / 4).toString('base64') };
            const started = Date.now();
            const [result] = await Promise.all([store.save(container, reservation.lease, doc, usage), saveProgress()]);
            samples.push({ bytes, ...result, totalRu: usage.ru, elapsedMs: Date.now() - started });
            console.error(JSON.stringify(samples[samples.length - 1]));
            await store.finish(container, reservation.lease, usage, { ...result, bytes });
        }
        return { environment: 'isolated test container, not production peak-load certification', samples,
            baselineProgressWrites: baseline, baselineProgressP50Ms: percentile(baseline.map(x => x.ms), .5),
            progressWrites: progress, progressP50Ms: percentile(progress.map(x => x.ms), .5),
            progressP95Ms: percentile(progress.map(x => x.ms), .95), targetResearchRuPerSecond: policy.TARGET_RU_PER_SECOND };
    } finally {
        let failures = 0;
        for (const [id, p] of cleanup.values()) {
            try { await raw.item(id, p).delete(); } catch (e) { if (e.code !== 404) failures++; }
        }
        if (originalPolicy && JSON.stringify(originalPolicy) !== JSON.stringify(appliedPolicy)) {
            const current = await raw.read();
            if (JSON.stringify(current.resource.indexingPolicy) !== JSON.stringify(appliedPolicy)) throw new Error('Test index changed externally; refusing to overwrite it.');
            const body = { ...current.resource, indexingPolicy: originalPolicy };
            for (const key of Object.keys(body)) if (key.startsWith('_')) delete body[key];
            await raw.replace(body, { accessCondition: { type: 'IfMatch', condition: current.resource._etag } });
        }
        if (failures) throw new Error('Probe cleanup incomplete: ' + failures + ' uniquely named test records remain.');
    }
}

async function main() {
    const command = process.argv[2] || 'status';
    if (!['status', 'prepare-index', 'probe'].includes(command)) throw new Error('Commands: status, prepare-index [--apply], probe.');
    const v = settings();
    const client = new CosmosClient({ endpoint: v.COSMOS_ENDPOINT, key: v.COSMOS_KEY,
        // Operator probes run over the teacher's connection, not Azure's local
        // datacenter network. Production intake keeps its separate 4s timeout.
        connectionPolicy: { requestTimeout: 60000, retryOptions: { maxRetryAttemptCount: 0, maxWaitTimeInSeconds: 0 } } });
    const database = arg('database', 'Val-EslApp'), containerName = arg('container', 'speech_samples');
    if (command === 'status') return status(client, database, containerName);
    if (command === 'probe') return probe(client, database, containerName);
    if (containerName !== 'speech_samples') throw new Error('Index preparation is restricted to speech_samples.');
    const container = client.database(database).container(containerName);
    const read = await container.read(), desired = indexPlan(read.resource);
    const changed = JSON.stringify(desired) !== JSON.stringify(read.resource.indexingPolicy);
    if (!process.argv.includes('--apply')) return { dryRun: true, changed, database, container: containerName, desiredIndexingPolicy: desired };
    if (!changed) return { changed: false, verified: true };
    const backupDir = path.resolve(__dirname, '..', 'speech_samples', 'ops');
    fs.mkdirSync(backupDir, { recursive: true });
    const backup = path.join(backupDir, 'index-backup-' + Date.now() + '.json');
    fs.writeFileSync(backup, JSON.stringify({ database, container: containerName, indexingPolicy: read.resource.indexingPolicy }, null, 2), { flag: 'wx' });
    const body = { ...read.resource, indexingPolicy: desired };
    for (const key of Object.keys(body)) if (key.startsWith('_')) delete body[key];
    await container.replace(body, { accessCondition: { type: 'IfMatch', condition: read.resource._etag } });
    const verify = await container.read();
    if (!verify.resource.indexingPolicy.excludedPaths.some(x => x.path === '/wavBase64/?')) throw new Error('Index exclusion verification failed.');
    return { changed: true, verified: true, backup };
}
if (require.main === module) main().then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error('Speech collection operation failed:', e.message); process.exitCode = 1; });
module.exports = { indexPlan, percentile, probe };
