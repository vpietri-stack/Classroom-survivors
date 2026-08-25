// Regression tests for the 2026-08-25 "Doris forced-refresh" fix primitives:
//
//   1. flushAnalyticsWithDeadline(maxMs) — the completion-time flush that the
//      study/uno/gomoku/VS end screens AWAIT before rendering. It must:
//        a. resolve TRUE (queue drained) once the server accepts the events;
//        b. NEVER hang longer than the deadline when the network stalls —
//           an iPad whose page process is about to be recycled cannot wait
//           forever, and the UI must show the completion screen.
//   2. saveActiveUserToCache() — hardened cached-profile writer. It must:
//        a. never throw (an unguarded QuotaExceededError here used to abort
//           queueSessionEvent mid-completion);
//        b. on a quota failure, retry once with the analytics mirror trimmed
//           to the most recent 500 events, then restore the in-memory array.
//
// Background: doris_zhangyanyi (iPad 11, WeChat + Safari) lost every
// completed study session after 2026-08-21 because the completion record was
// shipped fire-and-forget; the page process restarted within ~1s of the
// completion overlay and the in-flight flush (and the just-written
// localStorage mirror) died with it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const src = fs.readFileSync(path.join(root, 'teaching_content.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(root, 'frontend_auth.js'), 'utf8');

// --- controllable localStorage stub ------------------------------------------
let store = {};
let quotaLimit = Infinity;   // max JSON bytes allowed per key
let setItemCalls = [];       // { key, size } history for assertions
const localStorageStub = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    const s = String(v);
    setItemCalls.push({ key: k, size: s.length });
    if (s.length > quotaLimit) {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
    store[k] = s;
  },
  removeItem: (k) => { delete store[k]; }
};

// --- controllable network stub ------------------------------------------------
// frontend_auth.js defines its own apiFetch() that calls the GLOBAL fetch, so
// the interception point is fetch itself.
let fetchBehavior = 'ok'; // 'ok' | 'hang'
let posts = [];
function fetchStub(url, options = {}) {
  posts.push({ url: String(url), body: options.body });
  if (fetchBehavior === 'hang') return new Promise(() => {}); // never resolves
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
}

const sandbox = {
  console,
  API_BASE_URL: 'http://test.local/api',
  document: { addEventListener: () => {} },
  window: {},
  localStorage: localStorageStub,
  setTimeout, clearTimeout, setInterval, clearInterval,
  navigator: {},          // no sendBeacon — unload path irrelevant here
  fetch: fetchStub,
  getAppKey: () => Promise.resolve('test-key'),
  // teach-content globals that frontend_auth expects to find at module scope
  isTestMode: false,
  authActiveUser: null,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS:', name); }
  else { fail++; console.log('FAIL:', name); }
}

function makeUser() {
  return {
    id: 'student_doris_test', login: 'doris_test', name: 'Doris',
    role: 'student', srState: { vocab: {}, sentences: {}, sentencePairs: {} },
    sessionCount: 3, analytics: []
  };
}

(async () => {
  // ---- 1a. deadline flush delivers the session event and reports success ----
  fetchBehavior = 'ok';
  sandbox.authActiveUser = makeUser();
  sandbox.analyticsQueue = [];
  vm.runInContext('authActiveUser = __user; analyticsQueue = [];', Object.assign(sandbox, { __user: sandbox.authActiveUser }));
  // Simulate the completion path: finalize-style SR pending + session event.
  vm.runInContext(`
    srPendingState = { vocab: { cat: { interval: 2 } } };
    srIncrementSession = true;
    queueSessionEvent('study', { durationMs: 300000, durationFormatted: '5m 0s' });
  `, sandbox);
  ok('completion event queued before flush', sandbox.analyticsQueue.length === 1);
  const t0 = Date.now();
  const drained = await sandbox.flushAnalyticsWithDeadline(4000);
  const elapsed = Date.now() - t0;
  ok('deadline flush resolves true when server accepts', drained === true);
  ok('deadline flush drains the queue', sandbox.analyticsQueue.length === 0);
  ok('deadline flush is fast on a good network (<1.5s)', elapsed < 1500);
  ok('flush POSTed saveAnalytics', posts.some(p => p.url.includes('/saveAnalytics')));
  const body = JSON.parse(posts.filter(p => p.url.includes('/saveAnalytics')).pop().body);
  ok('session event carried srState + incrementSession', !!body.srState && body.incrementSession === true);
  ok('queue mirror cleared after server ack', !('csAnalyticsQueue' in store));

  // ---- 1b. deadline flush NEVER hangs past the deadline on a dead network ----
  fetchBehavior = 'hang';
  posts = [];
  sandbox.authActiveUser = makeUser();
  vm.runInContext('authActiveUser = __user; analyticsQueue = [];', Object.assign(sandbox, { __user: sandbox.authActiveUser }));
  vm.runInContext(`queueSessionEvent('study', { durationMs: 1000 });`, sandbox);
  const t1 = Date.now();
  const drained2 = await sandbox.flushAnalyticsWithDeadline(600); // short deadline for test speed
  const waited = Date.now() - t1;
  ok('deadline flush returns false when network stalls', drained2 === false);
  ok('deadline flush respects the deadline (<=1.5s for a 600ms cap)', waited <= 1500);
  ok('stalled events remain in the queue for next-login drain', sandbox.analyticsQueue.length === 1);
  ok('stalled events stay persisted in localStorage', typeof store['csAnalyticsQueue'] === 'string');
  fetchBehavior = 'ok';

  // ---- 2a. saveActiveUserToCache never throws, even when storage is full ----
  sandbox.authActiveUser = makeUser();
  vm.runInContext('authActiveUser = __user;', Object.assign(sandbox, { __user: sandbox.authActiveUser }));
  // Simulate a big analytics mirror (600 events) + a quota smaller than the
  // full serialization but bigger than the trimmed one.
  sandbox.authActiveUser.analytics = Array.from({ length: 600 }, (_, i) => ({
    type: 'exercise', exerciseType: 'spelling', mode: 'study', attempts: 1,
    durationMs: 5000, timestamp: new Date().toISOString(), eventId: 'ex_' + i,
    itemDetails: 'word: ' + 'x'.repeat(40)
  }));
  vm.runInContext('authActiveUser = __user;', Object.assign(sandbox, { __user: sandbox.authActiveUser }));
  const fullSize = JSON.stringify([sandbox.authActiveUser]).length;
  quotaLimit = fullSize - 5000; // just below full size
  setItemCalls = [];
  let threw = false;
  try { sandbox.saveActiveUserToCache(); } catch { threw = true; }
  ok('saveActiveUserToCache never throws on quota error', !threw);
  const savedUserCalls = setItemCalls.filter(c => c.key === 'savedUsers');
  ok('quota failure triggers exactly one trimmed retry', savedUserCalls.length === 2);
  ok('trimmed retry is smaller than the full mirror', savedUserCalls[1].size < savedUserCalls[0].size);
  const cached = JSON.parse(store['savedUsers']);
  ok('trimmed mirror keeps the most recent 500 events', cached[0].analytics.length === 500
     && cached[0].analytics[499].eventId === 'ex_599');
  ok('in-memory analytics restored after the trim-retry', sandbox.authActiveUser.analytics.length === 600);
  quotaLimit = Infinity;

  // ---- 2b. storage totally unavailable -> still silent, app keeps working ----
  store = {};
  quotaLimit = -1; // every setItem throws
  threw = false;
  try { sandbox.saveActiveUserToCache(); } catch { threw = true; }
  ok('saveActiveUserToCache silent when storage is unusable', !threw);
  quotaLimit = Infinity;

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
