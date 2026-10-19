const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const Module = require('module');
const policy = require('./api/src/functions/shared/speechSamples');
const store = require('./api/src/functions/shared/speechSampleStore');
const NOW = Date.parse('2026-10-19T08:00:00+08:00');
const originalNow = Date.now;
Date.now = () => NOW;
let checks = 0;
function check(condition, name) { assert.ok(condition, name); checks++; console.log('PASS ' + name); }
function clone(x) { return JSON.parse(JSON.stringify(x)); }

class MemoryCosmos {
  constructor() {
    this.docs = new Map(); this.etag = 0; this.batchCalls = 0;
    this.items = {
      create: async doc => {
        if (this.docs.has(this.key(doc.id, doc.studentId))) throw { code: 409 };
        return this.put(doc, 6);
      },
      query: spec => ({ fetchAll: async () => ({ requestCharge: 3, resources: [[...this.docs.values()]
        .filter(x => x.studentId === spec.parameters[0].value && (!x.type || x.type === 'speech_sample')).length] }) }),
      batch: async (ops, pk) => {
        this.batchCalls++;
        for (const op of ops) {
          const d = this.docs.get(this.key(op.id || op.resourceBody.id, pk));
          if (op.operationType === 'Replace' && (!d || d._etag !== op.ifMatch)) return { code: 412, result: [{ statusCode: 412 }], requestCharge: 1 };
          if (op.operationType === 'Create' && d) return { code: 409, result: [{ statusCode: 409 }], requestCharge: 1 };
        }
        for (const op of ops) this.put(op.resourceBody, 0);
        return { code: 200, result: ops.map(() => ({ statusCode: 201 })), requestCharge: 25 };
      },
    };
  }
  key(id, pk) { return JSON.stringify([id, pk]); }
  put(doc, requestCharge) {
    const resource = { ...clone(doc), _etag: String(++this.etag) };
    this.docs.set(this.key(doc.id, doc.studentId), resource);
    return { resource: clone(resource), requestCharge };
  }
  item(id, pk) {
    return {
      read: async () => { const r = this.docs.get(this.key(id, pk)); if (!r) throw { code: 404, requestCharge: 1 }; return { resource: clone(r), requestCharge: 1 }; },
      replace: async (doc, options) => {
        const old = this.docs.get(this.key(id, pk));
        if (!old || old._etag !== options.accessCondition.condition) throw { code: 412 };
        return this.put(doc, 6);
      },
    };
  }
}

function browser(options = {}) {
  let now = NOW, timerId = 0, encodes = 0, aborted = 0;
  const timers = new Map(), calls = [], storage = new Map(), serverCounts = new Map();
  const config = { enabled: true, ...options };
  class Clock extends Date { static now() { return now; } }
  const w = {
    document: { hidden: false, addEventListener() {} }, addEventListener() {},
    AbortController, crypto: { randomUUID: () => 'sample_' + String(++timerId).padStart(12, '0') },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    FileReader: class {
      readAsDataURL() { encodes++; this.result = 'data:audio/wav;base64,' + 'A'.repeat(200); this.onload(); }
      abort() { aborted++; }
    },
    fetch: async (url, req) => {
      const body = req.body ? JSON.parse(req.body) : null;
      calls.push({ url, req, body });
      if (config.hang && url.endsWith(config.hang)) return new Promise(() => {});
      if (url.endsWith('/speechSampleConsent')) return { status: 200, json: async () => ({
        consented: config.enabled && req.headers['X-Auth-Token'] !== 'token-b', open: config.enabled,
        endsAt: Date.parse('2026-10-26T00:00:00+08:00'), maxSamples: 30, maxWavBytes: 300000,
      }) };
      if (url.endsWith('/reserveSpeechSample')) return { status: 200, json: async () => config.busy
        ? { skipped: 'busy', retryAfterMs: 15000 }
        : { reservation: 'reservation-token', expiresAt: now + 15000, stored: serverCounts.get(body.studentId) || 0 } };
      if (config.skipUpload) return { status: 200, json: async () => ({ skipped: 'storage_busy' }) };
      serverCounts.set(body.studentId, (serverCounts.get(body.studentId) || 0) + 1);
      return { status: 201, json: async () => ({ success: true, stored: serverCounts.get(body.studentId) }) };
    },
  };
  const sandbox = { window: w, Date: Clock, console, Math: { ...Math, random: () => 0, min: Math.min, max: Math.max, floor: Math.floor },
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout: id => timers.delete(id),
    authActiveUser: { id: 'student-test-a', name: 'Test A' },
    getSessionToken: () => sandbox.authActiveUser.id === 'student-test-b' ? 'token-b' : 'token-a',
    getAppKey: () => 'test-key',
  };
  vm.createContext(sandbox); vm.runInContext(fs.readFileSync('speech_sample_capture.js', 'utf8'), sandbox);
  async function flush() { for (let i = 0; i < 5; i++) await new Promise(setImmediate); }
  async function advance(ms) {
    const end = now + ms; let turns = 0;
    while (true) {
      const t = [...timers].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!t) break;
      assert.ok(++turns < 1000, 'timer loop bounded'); now = t[1].at; timers.delete(t[0]); t[1].fn(); await flush();
    }
    now = end; await flush();
  }
  return { cap: w.SpeechSampleCapture, config, calls, storage, sandbox, window: w, flush, advance,
    sample: () => ({ ownerId: sandbox.authActiveUser.id, blob: { size: 150 }, target: 'A short sentence.', capturedAt: now }),
    encoded: () => encodes, aborted: () => aborted };
}

async function main() {
  process.env.SPEECH_SAMPLE_CAPTURE_ENABLED = 'true';
  process.env.SPEECH_SAMPLE_CONSENTED_IDS = 'student-test-a';
  const c = new MemoryCosmos();
  check(store.requestCharge({ headers: { 'x-ms-request-charge': '42.5' }, result: [] }) === 42.5 && store.requestCharge({ result: [{ requestCharge: 7 }, { requestCharge: 3 }] }) === 10, 'batch charge is measured from actual SDK response shapes');
  const contenders = await Promise.all(Array.from({ length: 100 }, (_, i) => store.reserve(c, 'student-test-a', 'sample_' + String(i).padStart(12, '0'), NOW)));
  check(contenders.filter(x => x.lease).length === 1, '100 parallel Functions instances obtain one global reservation');
  const winner = contenders.find(x => x.lease);
  const usage = store.meter(); usage.ru = 400;
  await store.finish(c, winner.lease, usage, {}, NOW);
  check(c.docs.get(c.key(store.CONTROL_ID, store.CONTROL_PK)).nextAllowedAt === NOW + 4200, 'cooldown includes measured request-unit charge and reservation overhead');
  const later = await store.reserve(c, 'student-test-a', 'sample_later_test_1234', NOW + 20000);
  await store.finish(c, winner.lease, store.meter(), {}, NOW + 20001);
  check(c.docs.get(c.key(store.CONTROL_ID, store.CONTROL_PK)).nonce === later.lease.nonce, 'stale completion cannot release a newer reservation');

  const q = new MemoryCosmos();
  q.put({ id: store.QUOTA_ID, studentId: 'student-test-a', type: 'speech_sample_quota', count: 29 }, 0);
  const saves = await Promise.all(Array.from({ length: 50 }, (_, i) => store.save(q, {}, {
    id: 'sample-' + i, studentId: 'student-test-a', type: 'speech_sample', wavBase64: 'audio',
  })));
  check(saves.filter(x => x.stored).length === 1 && q.docs.get(q.key(store.QUOTA_ID, 'student-test-a')).count === 30, 'atomic quota allows exactly one of 50 racing final uploads');
  const duplicate = await store.save(q, {}, { id: 'sample-0', studentId: 'student-test-a', type: 'speech_sample' });
  check(duplicate.duplicate && q.docs.get(q.key(store.QUOTA_ID, 'student-test-a')).count === 30, 'duplicate upload does not consume another quota slot');
  const legacy = new MemoryCosmos();
  legacy.put({ id: 'legacy', studentId: 'student-test-a', wavBase64: 'audio' }, 0);
  check((await store.quota(legacy, 'student-test-a', store.meter())).count === 1, 'legacy recordings count toward the new cap');

  // Actual HTTP handlers, with only the network/auth boundary replaced.
  const routes = {}, originalLoad = Module._load;
  Module._load = function (name, ...args) {
    if (name === '@azure/functions') return { app: { http: (route, value) => { routes[route] = value.handler; } } };
    if (name === './shared/db') return { getSamplesContainer: () => legacy };
    if (name === './shared/validateApiKey') return { validateApiKey: () => true };
    if (name === './shared/auth') return { requireAuth: req => ({ token: { sub: req.studentId } }), unauthorized: () => ({ status: 401 }) };
    return originalLoad.call(this, name, ...args);
  };
  try { require('./api/src/functions/reserveSpeechSample'); require('./api/src/functions/saveSpeechSample'); require('./api/src/functions/speechSampleConsent'); }
  finally { Module._load = originalLoad; }
  const request = (studentId, body) => ({ studentId, headers: new Headers(), json: async () => body });
  const context = { log() {}, warn() {}, error() {} };
  delete process.env.SPEECH_SAMPLE_CAPTURE_ENABLED;
  const closed = await routes.reserveSpeechSample(request('student-test-a', {}), context);
  check(closed.jsonBody.skipped === 'closed', 'launch switch defaults closed before any reservation');
  process.env.SPEECH_SAMPLE_CAPTURE_ENABLED = 'true';
  const denied = await routes.reserveSpeechSample(request('student-test-b', {}), context);
  check(denied.jsonBody.skipped === 'not_consented', 'unlisted student cannot reserve an upload');
  const mismatch = await routes.saveSpeechSample(request('student-test-a', { studentId: 'student-test-b' }), context);
  check(mismatch.status === 403, 'server rejects audio whose owner differs from authenticated identity');
  const approved = await routes.reserveSpeechSample(request('student-test-a', {
    studentId: 'student-test-a', sampleId: 'sample_http_test_1234', blobBytes: 200,
  }), context);
  const wav = Buffer.concat([Buffer.from('RIFF....WAVEfmt ', 'latin1'), Buffer.alloc(150)]).toString('base64');
  const uploadBody = { studentId: 'student-test-a', sampleId: 'sample_http_test_1234',
    reservation: approved.jsonBody.reservation, wavBase64: wav, outcome: 'too_quiet', pass: null };
  const stored = await routes.saveSpeechSample(request('student-test-a', uploadBody), context);
  check(stored.status === 201 && stored.jsonBody.stored === 2, 'actual handlers reserve and atomically store a consented clip');
  const audioDoc = legacy.docs.get(legacy.key(stored.jsonBody.id, 'student-test-a'));
  check(audioDoc.pass === null && audioDoc.accuracy === null && audioDoc.outcome === 'too_quiet', 'ungraded metadata remains null rather than inventing a failure');
  const replay = await routes.saveSpeechSample(request('student-test-a', uploadBody), context);
  check(replay.status === 200 && legacy.batchCalls === 1, 'consumed reservation cannot trigger another batch');

  const ops = require('./api/speech_collection_ops');
  const definition = { indexingPolicy: { includedPaths: [{ path: '/*' }], excludedPaths: [] } };
  const planned = ops.indexPlan(definition);
  check(planned.excludedPaths[0].path === '/wavBase64/?' && definition.indexingPolicy.excludedPaths.length === 0, 'index preparation preserves the input and excludes only audio');
  await assert.rejects(ops.probe(null, 'Val-EslApp', 'speech_samples'), /Probe requires/); checks++;
  check(JSON.stringify(ops.indexPlan({ indexingPolicy: planned })) === JSON.stringify(planned), 'index preparation is idempotent');

  const exported = new Map(); let pagesRead = 0;
  const wavBytes = Buffer.alloc(64); wavBytes.write('RIFF', 0); wavBytes.write('WAVE', 8);
  const downloadSandbox = {
    __dirname: require('path').join(__dirname, 'api'), Buffer, console: { log() {}, error() {} },
    process: { argv: ['node', 'download_speech_samples.js', '--limit', '1'], env: {}, cwd: () => __dirname, exit: () => { throw new Error('unexpected exit'); } },
    require: name => {
      if (name === 'fs') return { existsSync: () => true, mkdirSync() {}, writeFileSync: (file, data) => exported.set(file, data) };
      if (name === 'path') return require('path');
      if (name.endsWith('local.settings.json')) return { Values: { COSMOS_ENDPOINT: 'test', COSMOS_KEY: 'test' } };
      if (name === '@azure/cosmos') return { CosmosClient: class { database() { return { container: () => ({ items: { query: () => ({
        hasMoreResults: () => pagesRead < 2,
        fetchNext: async () => { pagesRead++; return { resources: [1].map(i => ({ id: 'sample-test-' + i, studentId: 'student-test-a',
          target: 'Prompt', pass: null, outcome: 'too_quiet', wavBase64: wavBytes.toString('base64') })) }; },
      }) } }) }; } } };
      throw new Error('unexpected require: ' + name);
    },
  };
  await vm.runInNewContext(fs.readFileSync('api/download_speech_samples.js', 'utf8'), downloadSandbox);
  check(pagesRead === 1 && [...exported.keys()].filter(x => x.endsWith('.wav')).length === 1, 'download limit stops paged audio reads without loading the full collection');
  check([...exported.entries()].find(([file]) => file.endsWith('manifest.csv'))[1].includes('too_quiet'), 'export retains rejected-recording outcome metadata');

  const b = browser();
  for (let i = 0; i < 35; i++) { b.cap.maybeCapture(b.sample()); await b.flush(); await b.advance(10000); }
  check(b.cap.status().sentThisSession === 30 && b.cap.status().stored === 30, 'client uploads 30 recordings, with no double counting');
  check(b.calls.filter(x => x.url.endsWith('/saveSpeechSample')).length === 30, 'client stops network audio at the quota');
  check(b.calls.every(x => !x.body || !x.body.studentId || x.req.headers['X-Auth-Token'] === 'token-a'), 'queued uploads use their captured session token');

  const stuck = browser({ hang: '/speechSampleConsent' });
  for (let i = 0; i < 100; i++) stuck.cap.maybeCapture(stuck.sample());
  await stuck.flush();
  check(stuck.cap.status().pending === 2 && stuck.cap.status().dropped.queue_full === 98, 'pending bound includes a hung consent lookup');
  await stuck.advance(40000);
  check(stuck.cap.status().pending === 0 && stuck.encoded() === 0, 'timeouts release retained audio even when fetch ignores abort');

  const busy = browser({ busy: true }); busy.cap.maybeCapture(busy.sample()); await busy.flush();
  check(busy.encoded() === 0 && busy.cap.status().sentThisSession === 0, 'global contention sends no audio and consumes no client quota');
  const skipped = browser({ skipUpload: true }); skipped.cap.maybeCapture(skipped.sample()); await skipped.flush();
  check(skipped.cap.status().stored === 0 && skipped.cap.status().sentThisSession === 0, 'a skipped HTTP 200 is not counted as a stored recording');

  const switched = browser({ hang: '/speechSampleConsent' });
  const oldSample = switched.sample(); switched.cap.maybeCapture(oldSample); await switched.flush();
  switched.config.hang = null; switched.sandbox.authActiveUser = { id: 'student-test-b' };
  switched.cap.maybeCapture(oldSample); switched.cap.maybeCapture(switched.sample()); await switched.flush();
  check(switched.encoded() === 0 && !switched.calls.some(x => x.url.endsWith('/saveSpeechSample')), 'account switch discards old audio and never reuses consent for the next child');

  const enabledLater = browser({ enabled: false });
  enabledLater.cap.maybeCapture(enabledLater.sample()); await enabledLater.flush();
  check(enabledLater.encoded() === 0, 'disabled collection never encodes audio');
  enabledLater.config.enabled = true; await enabledLater.advance(61000);
  enabledLater.cap.maybeCapture(enabledLater.sample()); await enabledLater.flush();
  check(enabledLater.cap.status().stored === 1, 'consent refresh notices the later launch switch without reloading');

  const hide = browser({ hang: '/saveSpeechSample' }); hide.cap.maybeCapture(hide.sample()); await hide.flush(); hide.cap.reset(); await hide.flush();
  check(hide.cap.status().pending === 0, 'page hide/reset aborts research rather than delaying progress delivery');
  console.log(checks + ' speech collection runtime checks passed');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { Date.now = originalNow; });
