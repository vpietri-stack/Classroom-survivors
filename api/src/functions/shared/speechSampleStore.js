const { randomUUID } = require('crypto');
const policy = require('./speechSamples');

// One small coordinator in the EXISTING samples container coordinates every
// Functions instance. An in-memory semaphore would only protect one instance.
const CONTROL_ID = 'speech-capture-control-v2';
const CONTROL_PK = '__speech_capture_control__';
const QUOTA_ID = 'speech-capture-quota-v2';

function requestCharge(r) {
    if (!r) return 0;
    // Transactional batches return a plain Response, not ItemResponse; the
    // installed SDK exposes charge in headers/operation results, not a getter.
    const direct = Number(r.requestCharge || r.headers && r.headers['x-ms-request-charge']);
    if (Number.isFinite(direct) && direct > 0) return direct;
    return Array.isArray(r.result) ? r.result.reduce((sum, x) => sum + (Number(x.requestCharge) || 0), 0) : 0;
}
function meter() {
    return { ru: 0, add(r) { this.ru += requestCharge(r); return r; } };
}

async function readItem(container, id, pk, usage) {
    try { return usage.add(await container.item(id, pk).read()).resource; }
    catch (e) {
        usage.add(e);
        if (e.code === 404) return null;
        throw e;
    }
}

function validSampleId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{12,80}$/.test(id);
}

async function quota(container, studentId, usage) {
    const existing = await readItem(container, QUOTA_ID, studentId, usage);
    if (existing) return existing;
    // Legacy recordings count toward the same lifetime limit. Control/quota
    // records do not. Explicit PK keeps this initialization query scoped.
    const result = usage.add(await container.items.query({
        query: "SELECT VALUE COUNT(1) FROM c WHERE c.studentId = @sid AND (NOT IS_DEFINED(c.type) OR c.type = 'speech_sample')",
        parameters: [{ name: '@sid', value: studentId }],
    }, { partitionKey: studentId }).fetchAll());
    const doc = { id: QUOTA_ID, studentId, type: 'speech_sample_quota', count: Number(result.resources[0]) || 0 };
    try { return usage.add(await container.items.create(doc)).resource; }
    catch (e) {
        usage.add(e);
        if (e.code !== 409) throw e;
        return readItem(container, QUOTA_ID, studentId, usage);
    }
}

async function reserve(container, studentId, sampleId, now = Date.now(), usage = meter()) {
    const previous = await readItem(container, CONTROL_ID, CONTROL_PK, usage);
    const readyAt = Math.max(Number(previous && previous.leaseUntil) || 0, Number(previous && previous.nextAllowedAt) || 0);
    if (now < readyAt) return { skipped: 'busy', retryAfterMs: readyAt - now };
    const next = {
        id: CONTROL_ID, studentId: CONTROL_PK, type: 'speech_sample_control',
        nonce: randomUUID(), ownerId: studentId, sampleId,
        leaseUntil: now + policy.LEASE_MS, nextAllowedAt: now + policy.MIN_UPLOAD_GAP_MS,
        stats: previous && previous.stats || {},
    };
    let saved;
    try {
        saved = usage.add(previous
            ? await container.item(CONTROL_ID, CONTROL_PK).replace(next, { accessCondition: { type: 'IfMatch', condition: previous._etag } })
            : await container.items.create(next));
    } catch (e) {
        usage.add(e);
        if (e.code === 409 || e.code === 412 || e.code === 429) return { skipped: 'busy', retryAfterMs: policy.LEASE_MS };
        throw e;
    }
    const lease = saved.resource;
    try {
        const q = await quota(container, studentId, usage);
        if (q.count >= policy.maxSamples()) {
            await finish(container, lease, usage, { skipped: 'cap_reached' });
            return { skipped: 'cap_reached', stored: q.count };
        }
        return { lease, stored: q.count };
    } catch (e) {
        await finish(container, lease, usage, { skipped: 'storage_busy' });
        throw e;
    }
}

async function finish(container, lease, usage, result = {}, now = Date.now()) {
    if (!lease) return;
    const ru = Math.round((usage.ru || 0) * 100) / 100;
    // Charge-aware cooldown targets 10% of the current 1000 RU/s production
    // pool on average. This is pacing, NOT a hard throughput isolation SLA.
    const cooldown = Math.max(policy.MIN_UPLOAD_GAP_MS,
        Math.ceil((ru + policy.RESERVATION_OVERHEAD_RU) / policy.TARGET_RU_PER_SECOND * 1000));
    const old = lease.stats || {};
    const next = {
        id: CONTROL_ID, studentId: CONTROL_PK, type: 'speech_sample_control',
        nonce: '', ownerId: '', sampleId: '', leaseUntil: 0,
        nextAllowedAt: now + (result.skipped === 'storage_busy' ? 30_000 : cooldown),
        stats: {
            accepted: (Number(old.accepted) || 0) + (result.stored ? 1 : 0),
            bytes: (Number(old.bytes) || 0) + (Number(result.bytes) || 0),
            lastAt: now, lastRu: ru, lastWriteRu: Number(result.writeRu) || 0,
            lastWriteMs: Number(result.writeMs) || 0,
            lastOutcome: result.stored ? 'stored' : result.skipped || 'dropped',
        },
    };
    try {
        usage.add(await container.item(CONTROL_ID, CONTROL_PK).replace(next, { accessCondition: { type: 'IfMatch', condition: lease._etag } }));
    } catch (_) { /* bounded lease expires even if cleanup fails; never retry */ }
}

async function save(container, lease, doc, usage = meter()) {
    const prior = await readItem(container, doc.id, doc.studentId, usage);
    if (prior) return { duplicate: true };
    const q = await quota(container, doc.studentId, usage);
    if (q.count >= policy.maxSamples()) return { skipped: 'cap_reached', stored: q.count };
    const updated = { id: QUOTA_ID, studentId: doc.studentId, type: 'speech_sample_quota', count: q.count + 1 };
    const started = Date.now();
    const response = usage.add(await container.items.batch([
        { operationType: 'Replace', id: QUOTA_ID, ifMatch: q._etag, resourceBody: updated },
        { operationType: 'Create', resourceBody: doc },
    ], doc.studentId, { contentResponseOnWriteEnabled: false }));
    const failed = (response.result || []).find(r => r.statusCode >= 400);
    if (response.code >= 400 || failed) {
        // A replay or racing request can conflict, but the atomic batch cannot
        // consume a quota slot without storing its audio or exceed the cap.
        if (await readItem(container, doc.id, doc.studentId, usage)) return { duplicate: true };
        return { skipped: 'storage_busy' };
    }
    return { stored: q.count + 1, writeRu: requestCharge(response), writeMs: Date.now() - started };
}

module.exports = { CONTROL_ID, CONTROL_PK, QUOTA_ID, requestCharge, meter, readItem, validSampleId, quota, reserve, finish, save };
