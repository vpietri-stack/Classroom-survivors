const assert = require('assert');
const { HttpRequest } = require('./api/node_modules/@azure/functions');
const auth = require('./api/src/functions/shared/auth');
const { makeHandler, sanitizeEvent, redact, mergeEvents } = require('./api/src/functions/clientDiagnostics');
process.env.SESSION_SECRET = 'local-diagnostics-unit-test-only';
process.env.REQUIRE_AUTH = 'false';
delete process.env.APP_API_KEY;
let checks = 0;
function check(value, name) { assert.ok(value, name); checks++; console.log('PASS: ' + name); }
const docs = new Map(); let writes = 0, conflict = false;
const db = {
    item(id, pk) { return {
        async read() { const d = docs.get(pk + '/' + id); if (!d) throw { code: 404 }; return { resource: structuredClone(d) }; },
        async replace(doc, options) {
            if (conflict) { conflict = false; throw { code: 412 }; }
            const old = docs.get(pk + '/' + id);
            assert.equal(options.accessCondition.condition, old._etag);
            writes++; docs.set(pk + '/' + id, { ...structuredClone(doc), _etag: String(writes) });
        }
    }; },
    items: {
        async create(d) { writes++; docs.set(d.studentId + '/' + d.id, { ...structuredClone(d), _etag: String(writes) }); },
        async upsert(d) { writes++; docs.set(d.studentId + '/' + d.id, { ...structuredClone(d), _etag: String(writes) }); },
        query(_, opts) { return { fetchAll: async () => ({ resources: [...docs.values()].filter(d => d.studentId === opts.partitionKey && d.type === 'client_diagnostics_day') }) }; }
    }
};
const handler = makeHandler(() => db);
function token(sub, role = 'student') { return auth.signToken({ sub, role }, process.env.SESSION_SECRET); }
async function call(method, who, body, query = '') {
    const headers = { Origin: 'http://localhost:8888' }; if (who) headers['X-Auth-Token'] = who;
    if (body) headers['Content-Type'] = 'application/json';
    return handler(new HttpRequest({ method, url: 'http://localhost/api/clientDiagnostics' + query, headers,
        body: body ? { string: JSON.stringify(body) } : undefined }), { warn() {} });
}
const event = (seq = 1) => ({ boot: 'test_boot', seq, ts: new Date().toISOString(), type: 'error',
    context: { word: 'want', password: 'never-store' }, detail: 'password=secret authToken=hidden https://example.test/a?token=private' });
(async () => {
    check((await call('GET')).status === 401, 'signed token required even with legacy auth disabled');
    const amy = token('student_test_diag'), other = token('student_other_diag'), teacher = token('teacher_test_diag', 'BM');
    check((await call('GET', amy, null, '?studentId=student_other_diag')).status === 403, 'students cannot read another account');
    check((await call('GET', amy, null, '?view=events')).status === 403, 'students cannot read raw incident logs');
    check((await call('POST', amy, { action: 'configure', enabled: true })).status === 403, 'students cannot enable recording');
    check(!(await call('GET', amy)).jsonBody.enabled, 'unconfigured accounts default off');
    check((await call('POST', teacher, { action: 'configure', enabled: true, days: 7 }, '?studentId=student_test_diag')).jsonBody.enabled, 'teacher can enable a scoped trial');
    const payload = { browserId: 'browser_test', device: { ua: 'test', token: 'never-store' }, events: [event()] };
    check((await call('POST', other, payload)).jsonBody.enabled === false, 'other accounts remain off');
    const first = await call('POST', amy, payload);
    check(first.jsonBody.ack[0] === 'test_boot:1', 'ack names the event stored');
    const day = [...docs.values()].find(d => d.type === 'client_diagnostics_day');
    check(day.studentId === 'student_test_diag' && !day.device.token, 'identity derives from token and device fields are restricted');
    check(!JSON.stringify(day).includes('secret') && !JSON.stringify(day).includes('hidden') && !JSON.stringify(day).includes('never-store'), 'credentials and arbitrary context excluded server-side');
    await call('POST', amy, payload);
    check([...docs.values()].find(d => d.type === 'client_diagnostics_day').events.length === 1, 'retry is idempotent');
    conflict = true; payload.events = [event(2)]; await call('POST', amy, payload);
    check([...docs.values()].find(d => d.type === 'client_diagnostics_day').events.length === 2, 'etag conflict retries preserve earlier events');
    const before = writes;
    check((await call('POST', amy, { ...payload, events: [event(3), { ...event(4), type: 'session' }] })).status === 400 && writes === before, 'invalid batches write nothing and cannot create session records');
    check((await call('POST', amy, { ...payload, noise: 'x'.repeat(25000) })).status === 413, 'oversized requests refused');
    check((await call('GET', teacher, null, '?studentId=student_test_diag&view=events')).jsonBody.days.length === 1, 'privileged incident query is partition scoped');
    await call('POST', teacher, { action: 'configure', enabled: false }, '?studentId=student_test_diag');
    const stoppedAt = writes;
    check(!(await call('POST', amy, payload)).jsonBody.enabled && writes === stoppedAt, 'remote stop prevents further log writes');
    const expiredConfig = docs.get('student_test_diag/config'); expiredConfig.enabled = true; expiredConfig.endsAt = new Date(Date.now() - 1000).toISOString();
    check(!(await call('GET', amy)).jsonBody.enabled && !(await call('POST', amy, payload)).jsonBody.enabled && writes === stoppedAt, 'expired trials fail closed on read and ingestion');
    check(sanitizeEvent({ ...event(), seq: -1 }) === null && sanitizeEvent({ ...event(), ts: 'nonsense' }) === null, 'invalid identity/time rejected');
    check(!redact('https://a.test/p?q=private').includes('private'), 'URL queries removed');
    const many = Array.from({ length: 1600 }, (_, i) => ({ ...sanitizeEvent(event(i + 1)), detail: 'x'.repeat(1100) }));
    const bounded = mergeEvents([], many);
    check(bounded.length <= 1000 && Buffer.byteLength(JSON.stringify(bounded)) <= 480000, 'daily records bounded by count and bytes');
    console.log('Remote diagnostics API: ' + checks + ' checks passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
