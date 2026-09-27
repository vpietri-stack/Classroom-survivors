# Geo v2 — Multi-Sample Consensus Home Location — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v1's one-shot, freeze-forever location capture with every-login sampling, a unique-day-consensus "home" derivation, a privileged clear endpoint, and a dashboard student list with per-student 清除位置 — so trip captures self-heal instead of poisoning the dataset.

**Architecture:** All changes extend the v1 geo pipeline in place: client drops its ok-gate (frontend_auth.js), server replaces latest-wins with `applyGeoSamples` + `_consensusGeo` (saveAnalytics.js), one new privileged endpoint `clearGeo.js`, and `geo_export.js` gains a student list + richer CSV columns. The `geo` field keeps its v1 shape plus additive `days`/`samples`, so every existing consumer keeps working.

**Tech Stack:** Vanilla JS browser scripts, Azure Functions v4 (Node), Cosmos DB (`patch` API, @azure/cosmos 4.9.3), zero-dependency Node test harness (assert + vm-blob).

**Spec:** `docs/superpowers/specs/2026-09-26-geo-multi-sample-design.md` (supersedes capture/retention parts of `2026-09-25-student-geolocation-design.md`)

## Global Constraints

- Work on `preview` only. NEVER merge to `main`, NEVER push, NEVER deploy without explicit user instruction.
- NEVER `git add -A`/`git add .` — stage the exact paths listed. Leave `api/speech_events_dump_full.json` and `api/_geo_clear.js` untracked.
- Final stamps: `version.json` + `APP_VERSION` (frontend_auth.js:16) + `index.html:731 ?v=` all byte-identical at **`2026-09-26a`**; `teacher_dashboard.html` bumps `teacher_dashboard.js?v=` and `geo_export.js?v=` to the same.
- Privacy invariant: client rounds to 2 decimals before enqueue; server re-rounds; invalid fixes never stored.
- `npm test` green before every commit; `cd api && npm test` at the end (needs local func host — see Task 7).
- The v1 handler contract stays: geo eventIds (valid or not) always land in `addedEventIds` so clients clear their queues.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `api/src/functions/saveAnalytics.js` | Modify | Replace `extractGeoUpdates` single-geo output with `geoEvents` passthrough; new `applyGeoSamples` + `_consensusGeo` + helpers |
| `test_geo_events.js` | Modify | Rewrite for new contract + consensus suite |
| `frontend_auth.js` | Modify | Drop ok-gate in `csMaybeCaptureGeo` (lines ~295-299); comment update |
| `test_geo_capture.js` | Modify | Flip the "ok flag stops capture" test to "captures every login" |
| `api/src/functions/clearGeo.js` | Create | Privileged POST removing /geo + /geoSamples via patch |
| `geo_export.js` | Modify | CSV columns +days/+samples/+sharesCellWith; `renderGeoList` + `clearStudentGeo`; map label day-count; `_cellShareMap` |
| `test_geo_export.js` | Modify | New CSV/label assertions |
| `teacher_dashboard.html` | Modify | `<div id="geoList">` in the Student Locations panel; ?v= bumps |
| `teacher_dashboard.js` | Modify | One line: call `renderGeoList()` in switchTab settings branch (after line 565) |
| `version.json`, `index.html`, `frontend_auth.js` | Modify | Stamps |
| `docs/wiki/11-data-model.md`, `docs/wiki/10-backend-api.md`, `docs/wiki/15-gotchas-and-history.md` | Modify | v2 data model, clearGeo endpoint, trip-contamination lesson |

---

### Task 0: Branch check

- [ ] **Step 1:** Run `git status`. Expected: on `preview`, only untracked `api/_geo_clear.js` + `api/speech_events_dump_full.json`. If on another branch: `git checkout preview`. If tracked files are modified: STOP, ask user.

---

### Task 1: Server — applyGeoSamples + consensus

**Files:**
- Modify: `api/src/functions/saveAnalytics.js` (replace lines 107-150 `extractGeoUpdates`; add helpers; handler line ~222 destructure + line ~273 `if (geo) user.geo = geo;`; `module.exports`)
- Modify: `test_geo_events.js` (full rewrite)

**Interfaces:**
- Consumes: geo events `{type:'geo',lat,lng,timestamp,eventId}` from v1 client.
- Produces:
  - `extractGeoUpdates(events) -> { geoEvents: Array, geoEventIds: string[], cleanEvents: Array }` (NOTE: `.geo` single value is GONE; `.geoEvents` = raw geo events in arrival order)
  - `applyGeoSamples(user, geoEvents) -> boolean` (mutates `user.geoSamples` + `user.geo`)
  - `user.geo = { lat, lng, capturedAt, source:'browser', days:int, samples:int }`
  - `user.geoSamples = [{lat,lng,capturedAt}]`, cap `GEO_SAMPLE_CAP=30`
  - Task 3/5 read `geo.days`/`geo.samples`; Task 4's clearGeo removes both fields.

- [ ] **Step 1: Rewrite the failing tests**

Replace the ENTIRE content of `test_geo_events.js` with:

```js
const assert = require('assert');
const {
    extractGeoUpdates,
    applyGeoSamples,
    GEO_SAMPLE_CAP
} = require('./api/src/functions/saveAnalytics.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS: ' + name); passed++; }
    catch (e) { console.error('FAIL: ' + name); console.error(e); failed++; }
}

console.log('=== TEST SUITE: Geo v2 Samples + Consensus ===\n');

// ---- extractGeoUpdates: passthrough contract ----
test('non-geo events pass through untouched', () => {
    const events = [{ type: 'exercise', eventId: 'ex_1' }];
    const r = extractGeoUpdates(events);
    assert.deepStrictEqual(r.geoEvents, []);
    assert.deepStrictEqual(r.geoEventIds, []);
    assert.strictEqual(r.cleanEvents.length, 1);
});
test('geo events diverted, ids collected, order kept', () => {
    const r = extractGeoUpdates([
        { type: 'geo', lat: 25.05, lng: 102.71, timestamp: '2026-09-26T01:00:00Z', eventId: 'g1' },
        { type: 'exercise', eventId: 'ex_1' },
        { type: 'geo', lat: 25.06, lng: 102.71, eventId: 'g2' }
    ]);
    assert.strictEqual(r.cleanEvents.length, 1);
    assert.deepStrictEqual(r.geoEventIds, ['g1', 'g2']);
    assert.strictEqual(r.geoEvents.length, 2);
    assert.strictEqual(r.geoEvents[0].eventId, 'g1');
});

// ---- applyGeoSamples ----
function fix(lat, lng, ts) { return { type: 'geo', lat, lng, timestamp: ts, eventId: 'g_' + ts }; }

test('single valid fix creates sample + consensus geo', () => {
    const user = {};
    const changed = applyGeoSamples(user, [fix(25.045, 102.712, '2026-09-26T01:00:00Z')]);
    assert.strictEqual(changed, true);
    assert.strictEqual(user.geoSamples.length, 1);
    assert.strictEqual(user.geo.lat, 25.05); // re-rounded
    assert.strictEqual(user.geo.lng, 102.71);
    assert.strictEqual(user.geo.days, 1);
    assert.strictEqual(user.geo.samples, 1);
    assert.strictEqual(user.geo.source, 'browser');
});
test('invalid fixes acked by caller but never stored', () => {
    const user = {};
    const changed = applyGeoSamples(user, [
        { lat: 'abc', lng: 102.7, timestamp: '2026-09-26T01:00:00Z' },
        { lat: 95, lng: 102.7, timestamp: '2026-09-26T01:00:00Z' },
        { lat: null, lng: null, timestamp: '2026-09-26T01:00:00Z' }
    ]);
    assert.strictEqual(changed, false);
    assert.strictEqual(user.geoSamples.length, 0);
    assert.strictEqual(user.geo, undefined);
});
test('same cell + same Beijing day dedups (burst of logins = 1 day-vote)', () => {
    const user = {};
    for (let h = 1; h <= 10; h++) {
        applyGeoSamples(user, [fix(25.05, 102.71, `2026-09-26T0${h % 10}:00:00Z`)]);
    }
    assert.strictEqual(user.geoSamples.length, 1);
    assert.strictEqual(user.geo.days, 1);
});
test('Beijing day boundary respected (UTC 16:00 = next Beijing day)', () => {
    const user = {};
    applyGeoSamples(user, [fix(25.05, 102.71, '2026-09-25T15:00:00Z')]); // 25th 23:00 BJ
    applyGeoSamples(user, [fix(25.05, 102.71, '2026-09-25T17:00:00Z')]); // 26th 01:00 BJ
    assert.strictEqual(user.geoSamples.length, 2);
    assert.strictEqual(user.geo.days, 2);
});
test('different cells on the same day both kept (home + school diversity)', () => {
    const user = {};
    applyGeoSamples(user, [fix(25.05, 102.71, '2026-09-26T01:00:00Z')]);
    applyGeoSamples(user, [fix(24.90, 102.80, '2026-09-26T08:00:00Z')]);
    assert.strictEqual(user.geoSamples.length, 2);
});
test('unique-day mode: 8 spread days beat a 2-day trip burst', () => {
    const user = {};
    for (let d = 1; d <= 8; d++) {
        applyGeoSamples(user, [fix(25.05, 102.71, `2026-09-${String(d).padStart(2, '0')}T01:00:00Z`)]);
    }
    applyGeoSamples(user, [fix(25.18, 102.65, '2026-09-20T01:00:00Z')]);
    applyGeoSamples(user, [fix(25.18, 102.65, '2026-09-21T01:00:00Z')]);
    assert.strictEqual(user.geo.lat, 25.05);
    assert.strictEqual(user.geo.days, 8);
    assert.strictEqual(user.geo.samples, 10);
});
test('tie in days breaks to most recent cell', () => {
    const user = {};
    applyGeoSamples(user, [fix(25.05, 102.71, '2026-09-01T01:00:00Z')]);
    applyGeoSamples(user, [fix(24.90, 102.80, '2026-09-05T01:00:00Z')]);
    assert.strictEqual(user.geo.lat, 24.9); // later day wins tie
    assert.strictEqual(user.geo.days, 1);
});
test('legacy seed: v1 geo without geoSamples counts as one day-vote', () => {
    const user = { geo: { lat: 25.05, lng: 102.71, capturedAt: '2026-09-10T01:00:00Z', source: 'browser' } };
    applyGeoSamples(user, [fix(24.90, 102.80, '2026-09-26T01:00:00Z')]);
    assert.strictEqual(user.geoSamples.length, 2);
    assert.strictEqual(user.geo.lat, 24.9); // tie broken by recency
});
test('cap trims oldest beyond GEO_SAMPLE_CAP', () => {
    const user = {};
    for (let d = 1; d <= 35; d++) {
        applyGeoSamples(user, [fix(25.05, 102.71, `2026-08-${String(d).padStart(2, '0')}T01:00:00Z`)]);
    }
    assert.strictEqual(user.geoSamples.length, GEO_SAMPLE_CAP);
    assert.strictEqual(user.geo.samples, GEO_SAMPLE_CAP);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run to verify failure** — `node test_geo_events.js` → TypeError (applyGeoSamples not exported).

- [ ] **Step 3: Implement in saveAnalytics.js**

Replace the whole `extractGeoUpdates` block (lines 107-150) with:

```js
const GEO_SAMPLE_CAP = 30;

/**
 * Diverts `type:'geo'` events out of the analytics stream (v2, 2026-09-26):
 * geo events NEVER enter the analytics array. ALL geo eventIds (valid or not)
 * are returned for acking so clients clear their queues; raw events are
 * returned in arrival order for applyGeoSamples. Invalid fixes are dropped
 * there (defense in depth — client already rounds; we re-round here).
 *
 * @param {Array} events
 * @returns {{ geoEvents: Array, geoEventIds: string[], cleanEvents: Array }}
 */
function extractGeoUpdates(events) {
    const geoEvents = [];
    const geoEventIds = [];
    const cleanEvents = [];
    (events || []).forEach(event => {
        if (event && event.type === 'geo') {
            if (event.eventId) geoEventIds.push(event.eventId);
            geoEvents.push(event);
            return;
        }
        cleanEvents.push(event);
    });
    return { geoEvents, geoEventIds, cleanEvents };
}

/** Beijing-time calendar date (China has no DST — fixed +8 offset is exact). */
function _beijingDate(tsMs) {
    return new Date((Number.isFinite(tsMs) ? tsMs : 0) + 8 * 3600e3).toISOString().slice(0, 10);
}

function _validGeoFix(event) {
    const lat = Number(event && event.lat);
    const lng = Number(event && event.lng);
    if (event && (event.lat === '' || event.lat === null || event.lng === '' || event.lng === null)) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return {
        lat: Math.round(lat * 100) / 100,
        lng: Math.round(lng * 100) / 100,
        capturedAt: (event && event.timestamp) || new Date().toISOString()
    };
}

/**
 * Consensus home over samples: group by ~1km cell, count DISTINCT Beijing
 * calendar days per cell (burst of same-day logins = 1 vote), winner = most
 * days, tie = most recent fix. Returns the v1-compatible `geo` shape plus
 * additive days/samples confidence fields.
 */
function _consensusGeo(samples) {
    const byCell = new Map();
    samples.forEach(s => {
        const key = s.lat.toFixed(2) + ',' + s.lng.toFixed(2);
        let c = byCell.get(key);
        if (!c) { c = { lat: s.lat, lng: s.lng, days: new Set(), latest: 0 }; byCell.set(key, c); }
        c.days.add(_beijingDate(new Date(s.capturedAt).getTime()));
        const t = new Date(s.capturedAt).getTime() || 0;
        if (t > c.latest) c.latest = t;
    });
    let best = null;
    byCell.forEach(c => {
        if (!best || c.days.size > best.days.size ||
            (c.days.size === best.days.size && c.latest > best.latest)) best = c;
    });
    return {
        lat: best.lat, lng: best.lng,
        capturedAt: new Date(best.latest).toISOString(),
        source: 'browser', days: best.days.size, samples: samples.length
    };
}

/**
 * Appends validated fixes to user.geoSamples (dedup: same cell + same Beijing
 * day keeps only the first; cap GEO_SAMPLE_CAP trims oldest) and recomputes
 * user.geo as the unique-day consensus. Seeds from a legacy v1 user.geo when
 * no sample list exists yet, so old captures count as one day-vote instead of
 * vanishing. Mutates user; returns true when anything changed.
 *
 * @param {Object} user - the student doc (mutated)
 * @param {Array} geoEvents - raw type:'geo' events from extractGeoUpdates
 * @returns {boolean}
 */
function applyGeoSamples(user, geoEvents) {
    if (!user || !geoEvents || !geoEvents.length) return false;
    if (!Array.isArray(user.geoSamples)) {
        user.geoSamples = [];
        const g = user.geo;
        if (g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lng))) {
            user.geoSamples.push({
                lat: Number(g.lat), lng: Number(g.lng),
                capturedAt: g.capturedAt || new Date(0).toISOString()
            });
        }
    }
    let changed = false;
    geoEvents.forEach(ev => {
        const fix = _validGeoFix(ev);
        if (!fix) return;
        const day = _beijingDate(new Date(fix.capturedAt).getTime());
        const dup = user.geoSamples.some(s =>
            s.lat === fix.lat && s.lng === fix.lng &&
            _beijingDate(new Date(s.capturedAt).getTime()) === day);
        if (dup) return;
        user.geoSamples.push(fix);
        if (user.geoSamples.length > GEO_SAMPLE_CAP) {
            user.geoSamples = user.geoSamples.slice(-GEO_SAMPLE_CAP);
        }
        changed = true;
    });
    if (changed && user.geoSamples.length) user.geo = _consensusGeo(user.geoSamples);
    return changed;
}
```

Handler wiring — two edits:

a) Line ~222: change `const { geo, geoEventIds, cleanEvents } = extractGeoUpdates(events);` to

```js
            const { geoEvents, geoEventIds, cleanEvents } = extractGeoUpdates(events);
```

b) Line ~273: replace `if (geo) user.geo = geo; // latest capture wins (idempotent on retry)` with

```js
                if (geoEvents.length) applyGeoSamples(user, geoEvents); // v2 consensus (idempotent on retry)
```

c) `module.exports`: replace `extractGeoUpdates,` with `extractGeoUpdates, applyGeoSamples, _consensusGeo, GEO_SAMPLE_CAP,`.

- [ ] **Step 4: Run tests** — `node test_geo_events.js && npm test` → all green (handler-only files, no other suite touches geo).

- [ ] **Step 5: Commit**

```bash
git add api/src/functions/saveAnalytics.js test_geo_events.js
git commit -m "feat(api): geo v2 — every-login samples with unique-day consensus home"
```

---

### Task 2: Client — capture on every login

**Files:**
- Modify: `frontend_auth.js:283-299` (comment + gate removal)
- Modify: `test_geo_capture.js` (flip the ok-gate test)

**Interfaces:**
- Consumes: nothing new. Produces: one geo event per login (dedup happens server-side).

- [ ] **Step 1: Update the failing test**

In `test_geo_capture.js`, replace the block

```js
  // --- ok flag stops further capture ---
  var callsBefore = geoCalls;
  csMaybeCaptureGeo();
  report('ok flag: geolocation not called again', geoCalls === callsBefore);
```

with

```js
  // --- v2: NO ok gate — every login captures again (server dedups) ---
  var callsBefore = geoCalls;
  csMaybeCaptureGeo();
  report('v2: captures again on next login even after success', geoCalls === callsBefore + 1);
  var okFlag = JSON.parse(localStorage.getItem('csGeoDone_stu1') || 'null');
  report('v2: ok flag still written for diagnostics', okFlag && okFlag.status === 'ok');
```

- [ ] **Step 2: Run to verify failure** — `node test_geo_capture.js` → "captures again" FAILs (gate still present).

- [ ] **Step 3: Edit frontend_auth.js**

Replace lines 283-299 region — the comment tail and the gate. Change

```js
// array. Retry policy (teacher-mandated): failures retry EVERY login until a
// fix succeeds; only 'ok' is permanent. Caveats: WeChat Android webview often
// lacks geolocation (fail flag, silent), and the browser's own permission
// popup is the consent record.
```

to

```js
// array. v2 (2026-09-26): captures on EVERY login — one fix is a snapshot,
// not a verdict (trip contamination, 2026-09-26). The SERVER dedups (same
// cell + same Beijing day) and derives home as the unique-day consensus, so
// repeated home fixes cost nothing and a trip can never freeze in. The
// csGeoDone flag is diagnostic-only now — it no longer gates capture.
// Caveats: iOS Safari re-prompts per login (accepted); WeChat Android webview
// often lacks geolocation (silent fail, retried next login).
```

and delete the two gate lines inside `csMaybeCaptureGeo`:

```js
    const flag = csGeoGetFlag();
    if (flag && flag.status === 'ok') return; // captured once — never ask again
```

Keep `csGeoSetFlag('ok')` in the success callback (diagnostics). `maximumAge: 86400000` stays — it lets a same-day re-login reuse the cached fix silently.

- [ ] **Step 4: Run tests** — `node test_geo_capture.js && npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add frontend_auth.js test_geo_capture.js
git commit -m "feat(client): geo capture on every login; ok-flag demoted to diagnostics"
```

---

### Task 3: New endpoint — clearGeo.js

**Files:**
- Create: `api/src/functions/clearGeo.js`
- Modify: `staticwebapp.config.json` ONLY if other function routes need entries there (check `grep -n "clearGeo\|getStudentArchive" api/staticwebapp.config.json`; SWA auto-registers functions — likely no change needed)

**Interfaces:**
- Consumes: `auth.requireAuth`, `auth.isPrivileged`, `auth.forbidden` (shared/auth.js), Cosmos patch API.
- Produces: `POST /clearGeo` with `{studentId}` → `{success:true, cleared:0|1|2}`; privileged-only; 404 unknown student. Task 5's dashboard button calls it.

- [ ] **Step 1: Implement**

Create `api/src/functions/clearGeo.js`:

```js
const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');

// Geo v2 (2026-09-26): teacher/BM/admin clears a student's captured location
// (trip contamination, moved family). Removes /geo + /geoSamples only. The
// client captures on every login, so the student's next login re-seeds the
// data — this endpoint IS the "request recapture" mechanism.
app.http('clearGeo', {
    route: 'clearGeo',
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!validateApiKey(request)) return { status: 403, body: 'Forbidden.' };
            let body = {};
            try { body = await request.json(); } catch { /* allow query-param studentId */ }
            const studentId = body.studentId || request.query.get('studentId');
            if (!studentId) return { status: 400, jsonBody: { error: 'studentId required' } };

            const { token, error } = auth.requireAuth(request);
            if (error) return error;
            if (!auth.isPrivileged(token)) return auth.forbidden();

            const container = getContainer();
            const { resources } = await container.items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: studentId }] })
                .fetchAll();
            if (!resources.length) return { status: 404, jsonBody: { error: 'student not found' } };
            const doc = resources[0];
            const pk = doc.studentId !== undefined ? doc.studentId : undefined;

            const operations = [];
            if (doc.geo !== undefined) operations.push({ op: 'remove', path: '/geo' });
            if (doc.geoSamples !== undefined) operations.push({ op: 'remove', path: '/geoSamples' });
            if (operations.length) {
                await container.item(doc.id, pk).patch({ operations });
            }
            context.log(`clearGeo by ${token.role} for ${studentId}: removed ${operations.length} field(s)`);
            return { status: 200, jsonBody: { success: true, cleared: operations.length } };
        } catch (e) {
            context.error('clearGeo failed:', e);
            return { status: 500, body: 'Server error clearing geo.' };
        }
    }
});
```

- [ ] **Step 2: Live verify against the test container**

```bash
cd api && (func start --port 7072 > /tmp/func_host.log 2>&1 &) && sleep 15
VAL=$(curl -s -X POST http://localhost:7072/api/login -H "X-App-Key: test-harness-key" -H "Content-Type: application/json" -d '{"login":"val","password":"teacher123"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
# seed a geo via saveAnalytics, then clear it, then confirm gone:
ALICE=$(curl -s -X POST http://localhost:7072/api/login -H "X-App-Key: test-harness-key" -H "Content-Type: application/json" -d '{"login":"alice","password":"alice123"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
curl -s -X POST http://localhost:7072/api/saveAnalytics -H "X-App-Key: test-harness-key" -H "Content-Type: application/json" -H "Authorization: Bearer $ALICE" -d '{"events":[{"type":"geo","lat":25.045,"lng":102.712,"timestamp":"2026-09-26T10:00:00.000Z","eventId":"geo_cg_1"}]}'
curl -s -X POST http://localhost:7072/api/clearGeo -H "X-App-Key: test-harness-key" -H "Content-Type: application/json" -H "Authorization: Bearer $VAL" -d '{"studentId":"student_alice"}'
# Expected: {"success":true,"cleared":2}  (id is student_alice — confirm via getStudents if unsure)
curl -s http://localhost:7072/api/getStudents -H "X-App-Key: test-harness-key" -H "Authorization: Bearer $VAL" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d).find(s=>s.login==='alice');console.log('geo:',JSON.stringify(a.geo),'samples:',JSON.stringify(a.geoSamples))})"
# Expected: geo: undefined samples: undefined
# Negative: student token -> 403:
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:7072/api/clearGeo -H "X-App-Key: test-harness-key" -H "Content-Type: application/json" -H "Authorization: Bearer $ALICE" -d '{"studentId":"student_alice"}'
# Expected: 403
```

Then kill the func host (`taskkill //F //IM func.exe` or stop the background task).

- [ ] **Step 3: Commit**

```bash
git add api/src/functions/clearGeo.js
git commit -m "feat(api): clearGeo endpoint — privileged removal of student location data"
```

---

### Task 4: geo_export.js — richer CSV + student list + clear button

**Files:**
- Modify: `geo_export.js` (buildLocationCsv ~line 70; _geoStudentsToPoints ~line 85; template label line ~135; add renderGeoList/clearStudentGeo/_cellShareMap near renderGeoCoverage ~line 259; module.exports)
- Modify: `test_geo_export.js`

**Interfaces:**
- Consumes: `allStudents` (each with `geo{lat,lng,capturedAt,days,samples}` from Tasks 1/3), `apiFetch` + `API_BASE` (frontend_auth.js globals), DOM ids `geoList`, `geoCoverage`.
- Produces: `renderGeoList()`, `clearStudentGeo(id, name)` (called from HTML onclick), CSV header `studentId,name,hasLocation,capturedAt,days,samples,wgs84_lat,wgs84_lng,bd09_lat,bd09_lng,sharesCellWith`. Task 5 adds the container div + switchTab hook.

- [ ] **Step 1: Update tests (failing)**

In `test_geo_export.js`: replace the header assertion with

```js
    assert.strictEqual(lines[0], 'studentId,name,hasLocation,capturedAt,days,samples,wgs84_lat,wgs84_lng,bd09_lat,bd09_lng,sharesCellWith');
```

replace the s1 row assertion with

```js
    assert.ok(lines[1].startsWith('s1,"Zhang, San",1,2026-09-25T10:00:00.000Z,3,7,25.05,102.71,'));
```

and update the fixture student s1 to `geo: { lat: 25.05, lng: 102.71, capturedAt: '2026-09-25T10:00:00.000Z', days: 3, samples: 7 }`, then ADD:

```js
test('CSV: sharesCellWith lists other students in the same ~1km cell', () => {
    const pair = [
        { id: 's1', fullName: 'A', geo: { lat: 25.05, lng: 102.71, capturedAt: 'x', days: 2, samples: 2 } },
        { id: 's2', fullName: 'B', geo: { lat: 25.05, lng: 102.71, capturedAt: 'y', days: 1, samples: 1 } },
        { id: 's3', fullName: 'C', geo: { lat: 24.90, lng: 102.80, capturedAt: 'z', days: 4, samples: 4 } }
    ];
    const lines = G.buildLocationCsv(pair).replace(/^\uFEFF/, '').trim().split('\r\n');
    assert.ok(lines[1].endsWith(',s2'), 's1 shares with s2');
    assert.ok(lines[2].endsWith(',s1'), 's2 shares with s1');
    assert.ok(lines[3].endsWith(','), 'lone cell has empty sharesCellWith');
});
test('map HTML: label shows day-count for confidence', () => {
    const html = G.buildBaiduMapHtml(
        [{ id: 's1', fullName: 'A', geo: { lat: 25.05, lng: 102.71, capturedAt: 'x', days: 6, samples: 9 } }], 'AK');
    assert.ok(html.includes('"days":6'), 'days embedded in point data');
});
```

- [ ] **Step 2: Run to verify failure** — `node test_geo_export.js` → header/rows assertions FAIL.

- [ ] **Step 3: Implement**

In `geo_export.js`:

a) Add after `_studentName` (used by both CSV and list):

```js
function _cellKey(g) { return Number(g.lat).toFixed(2) + ',' + Number(g.lng).toFixed(2); }

function _cellShareMap(students) {
    var m = {};
    (students || []).forEach(function (s) {
        if (s && s.geo && Number.isFinite(Number(s.geo.lat))) {
            var k = _cellKey(s.geo);
            (m[k] = m[k] || []).push(s.id);
        }
    });
    return m;
}
```

b) In `buildLocationCsv`, replace the header row and the geo-present branch:

```js
    var rows = [['studentId', 'name', 'hasLocation', 'capturedAt', 'days', 'samples', 'wgs84_lat', 'wgs84_lng', 'bd09_lat', 'bd09_lng', 'sharesCellWith']];
    var share = _cellShareMap(students);
    (students || []).forEach(function (s) {
        var g = s && s.geo;
        if (g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lng))) {
            var b = wgs84ToBd09(Number(g.lat), Number(g.lng));
            var others = (share[_cellKey(g)] || []).filter(function (id) { return id !== s.id; }).join(' ');
            rows.push([s.id, _studentName(s), 1, g.capturedAt || '', g.days === undefined ? '' : g.days, g.samples === undefined ? '' : g.samples, g.lat, g.lng, b[0].toFixed(6), b[1].toFixed(6), others]);
        } else {
            rows.push([s.id, _studentName(s), 0, '', '', '', '', '', '', '', '']);
        }
    });
```

c) In `_geoStudentsToPoints`, add `days: (s.geo.days !== undefined ? s.geo.days : null),` to the returned object; in the HTML template, change the student marker label line to

```js
'    m.setLabel(new BMapGL.Label(s.name + (s.days > 1 ? " (" + s.days + "d)" : ""), {offset: new BMapGL.Size(15,-5)}));',
```

d) Add the list + clear (after `renderGeoCoverage`), matching the `apiFetch` POST pattern of admin_dashboard.js:199:

```js
function renderGeoList() {
    var el = typeof document !== 'undefined' && document.getElementById('geoList');
    if (!el || typeof allStudents === 'undefined') return;
    var share = _cellShareMap(allStudents);
    var rows = (allStudents || []).filter(function (s) { return s && s.geo; });
    if (!rows.length) { el.innerHTML = '<p style="font-size:13px;color:#888;">暂无位置数据 — 学生登录后会自动采集。</p>'; return; }
    var html = '<table class="dash-table compact"><thead><tr><th>学生</th><th>Home cell</th><th>Days</th><th>Samples</th><th>Captured</th><th></th></tr></thead><tbody>';
    rows.forEach(function (s) {
        var g = s.geo;
        var shared = (share[_cellKey(g)] || []).length > 1 ? ' <span title="同址" style="color:#d97706;">同址</span>' : '';
        html += '<tr><td>' + _studentName(s) + shared + '</td><td>' + g.lat + ',' + g.lng + '</td><td>' + (g.days !== undefined ? g.days : '-') +
            '</td><td>' + (g.samples !== undefined ? g.samples : '-') + '</td><td>' + String(g.capturedAt || '').slice(0, 10) +
            '</td><td><button class="dash-action-btn" onclick="clearStudentGeo(\'' + s.id + '\',\'' + _studentName(s).replace(/'/g, '') + '\')">清除位置</button></td></tr>';
    });
    el.innerHTML = html + '</tbody></table>';
}

function clearStudentGeo(id, name) {
    if (!confirm('清除 ' + name + ' 的位置数据？该学生下次登录会重新采集。')) return;
    apiFetch(`${API_BASE}/clearGeo`, {
        method: 'POST',
        body: JSON.stringify({ studentId: id })
    }).then(function (res) { return res.json(); }).then(function (j) {
        if (!j || !j.success) throw new Error('clear failed');
        var s = (typeof allStudents !== 'undefined' ? allStudents : []).find(function (x) { return x.id === id; });
        if (s) { delete s.geo; delete s.geoSamples; }
        renderGeoCoverage();
        renderGeoList();
    }).catch(function () { alert('清除失败 — 请重试或检查登录状态'); });
}
```

e) `module.exports`: add `renderGeoList, clearStudentGeo, _cellShareMap`.

- [ ] **Step 4: Run tests** — `node test_geo_export.js && npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add geo_export.js test_geo_export.js
git commit -m "feat(dashboard): geo list with confidence columns, 同址 badge, per-student clear button; CSV +days/samples/sharesCellWith"
```

---

### Task 5: Dashboard wiring — geoList container + refresh hook

**Files:**
- Modify: `teacher_dashboard.html` (panel after `geoCoverage` <p>, ~line 236; bump `teacher_dashboard.js?v=` and `geo_export.js?v=` to `2026-09-26a`)
- Modify: `teacher_dashboard.js:565` (add one line)

- [ ] **Step 1: HTML** — directly after the `<p id="geoCoverage" ...></p>` line, insert:

```html
                <div id="geoList" style="margin:8px 0 12px;"></div>
```

Bump both script tags to `?v=2026-09-26a`.

- [ ] **Step 2: JS hook** — after `teacher_dashboard.js:565` (`if (typeof renderGeoCoverage === 'function') renderGeoCoverage();`) add:

```js
        if (typeof renderGeoList === 'function') renderGeoList();
```

- [ ] **Step 3: Smoke test** — serve locally (`npx http-server -p 8080`), open teacher_dashboard.html, Settings tab: panel shows 暂无位置数据 or the table; no console errors. (Full clear-button round trip needs live/func-backed API — done in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add teacher_dashboard.html teacher_dashboard.js
git commit -m "feat(dashboard): mount geoList + refresh on Settings tab open"
```

---

### Task 6: Stamps + wiki + gotchas entry

- [ ] **Step 1: Bump stamps to `2026-09-26a`** — `version.json` (+notes: "geo v2: every-login sampling, unique-day consensus home, clearGeo endpoint + dashboard clear button"), `frontend_auth.js:16`, `index.html:731`. Verify: `node test_deploy_stamp_sync.js`.
- [ ] **Step 2: `docs/wiki/11-data-model.md`** — replace the v1 geo block: `geoSamples` array (shape, dedup rule, cap 30, legacy seed), `geo` = consensus with `days`/`samples`, capture cadence = every login, `csGeoDone_*` demoted to diagnostics, new endpoint note.
- [ ] **Step 3: `docs/wiki/10-backend-api.md`** — add `POST /clearGeo` (privileged; removes geo+geoSamples; recapture happens on next login).
- [ ] **Step 4: `docs/wiki/15-gotchas-and-history.md`** — 2026-09-26 entry: Zozo/Zoe trip capture froze as "home" under v1 latest-wins + permanent client ok-flag; v2 fixes via every-login sampling + unique-day mode + server-driven recapture.
- [ ] **Step 5: Full gate + commit**

```bash
npm test
git add version.json frontend_auth.js index.html docs/wiki/11-data-model.md docs/wiki/10-backend-api.md docs/wiki/15-gotchas-and-history.md
git commit -m "chore(release): 2026-09-26a — geo v2 stamps + wiki"
```

---

### Task 7: Final integration verification

- [ ] **Step 1:** `cd api && npm test` with a local func host running (start `func start --port 7072` in background; the suite expects :7072 against the test container). Expect `pass=23 fail=0`. Kill the host after.
- [ ] **Step 2:** Re-run the Task 3 Step 2 seed→clear→re-seed curl sequence once more on the final code; confirm `geo.days` increments across two seeded days.
- [ ] **Step 3:** Report: commits list, test totals, and remind the user that (a) prod cleanup of Zozo/Zoe is `node api/_geo_clear.js` OR the new dashboard button AFTER this ships, and (b) shipping = explicit user instruction (preview → main).

## Self-Review Notes

- Spec coverage: every-login capture→Task 2; samples/dedup/cap/seed/mode→Task 1; clearGeo→Task 3; CSV/labels/同址→Task 4; mounting→Task 5; discipline→Task 6.
- Type consistency: `geo{lat,lng,capturedAt,source,days,samples}` used identically in Tasks 1/4; `geoSamples[{lat,lng,capturedAt}]` in 1/3; `clearStudentGeo(id,name)` signature matches the HTML onclick generated in the same function; CSV header string identical in Tasks 1 fixture data and Task 4 test.
- Known risk: Cosmos `patch` remove on a nonexistent path errors — Task 3 guards with `!== undefined` checks (and clearGeo races are acceptable: worst case a 500 the teacher retries).
