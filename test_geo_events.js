const assert = require('assert');
const {
    extractGeoUpdates,
    applyGeoSamples,
    _consensusGeo,
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
test('extractGeoUpdates returns no `geo` key (diversion never writes consensus here)', () => {
    const r = extractGeoUpdates([{ type: 'geo', lat: 25.05, lng: 102.71, eventId: 'g1' }]);
    assert.strictEqual('geo' in r, false);
    assert.deepStrictEqual(Object.keys(r).sort(), ['cleanEvents', 'geoEventIds', 'geoEvents']);
});
test('extractGeoUpdates(null) is safe and returns three empty arrays', () => {
    const r = extractGeoUpdates(null);
    assert.deepStrictEqual(r.geoEvents, []);
    assert.deepStrictEqual(r.geoEventIds, []);
    assert.deepStrictEqual(r.cleanEvents, []);
});
test('client timestamp is clamped and re-serialised (no garbage / future dates)', () => {
    const now = Date.now();
    const user = {};
    applyGeoSamples(user, [
        { type: 'geo', lat: 25.05, lng: 102.71, timestamp: '2099-01-01T00:00:00Z', eventId: 'g_future' },
        { type: 'geo', lat: 24.90, lng: 102.80, timestamp: 'garbage!!!', eventId: 'g_junk' },
        { type: 'geo', lat: 24.80, lng: 102.60, timestamp: 'x'.repeat(5000), eventId: 'g_long' }
    ]);
    assert.strictEqual(user.geoSamples.length, 3, 'valid fixes survive, bad stamps do not discard them');
    user.geoSamples.forEach(s => {
        assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s.capturedAt), 'server-generated ISO stamp: ' + s.capturedAt);
        assert.ok(Date.parse(s.capturedAt) <= now + 1000, 'never future-dated: ' + s.capturedAt);
    });
    const past = {};
    applyGeoSamples(past, [{ type: 'geo', lat: 25.05, lng: 102.71, timestamp: '2026-01-04T06:00:00Z' }]);
    assert.strictEqual(past.geoSamples[0].capturedAt, '2026-01-04T06:00:00.000Z', 'offline-queue replay keeps its real past time');
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
    // 35 REAL, distinct Beijing days spread over three months. (The first
    // version of this test iterated 2026-08-32…35 — invalid dates that parsed
    // to NaN and silently collapsed onto one day, which is exactly how the
    // unbounded/unvalidated `capturedAt` got past review. Real dates + the
    // `geo.days` assertion below make day-count corruption catchable.)
    for (let i = 0; i < 35; i++) {
        const month = 7 + Math.floor(i / 12);   // Jul, Aug, Sep
        const day = 1 + (i % 12);               // 1..12, always a valid date
        applyGeoSamples(user, [fix(25.05, 102.71,
            `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T01:00:00Z`)]);
    }
    assert.strictEqual(user.geoSamples.length, GEO_SAMPLE_CAP);
    assert.strictEqual(user.geo.samples, GEO_SAMPLE_CAP);
    assert.strictEqual(user.geo.days, GEO_SAMPLE_CAP, 'kept samples are 30 DISTINCT day-votes');
    assert.strictEqual(new Set(user.geoSamples.map(s => s.capturedAt.slice(0, 10))).size, GEO_SAMPLE_CAP);
});
test('_consensusGeo returns null on empty samples', () => { assert.strictEqual(_consensusGeo([]), null); });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
