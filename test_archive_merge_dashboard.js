// teacher_dashboard.js is a browser script: it registers a DOMContentLoaded
// listener at module scope, so we stub a minimal `document` before requiring it.
// The listener callback never fires in Node, so no further DOM is touched.
global.document = { addEventListener: () => {} };

const assert = require('assert');
const { mergeAnalytics, getAnalyticsInRange } = require('./teacher_dashboard.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS: ' + name); passed++; }
    catch (e) { console.error('FAIL: ' + name); console.error(e); failed++; }
}

console.log('=== TEST SUITE: Archive Merge / Dashboard History ===\n');

test('mergeAnalytics: live-only when no archives', () => {
    const live = [{ eventId: 'a', type: 'session', timestamp: '2026-08-30T10:00:00Z' }];
    const out = mergeAnalytics(live, []);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].eventId, 'a');
});

test('mergeAnalytics: adds archived events from archive docs', () => {
    const live = [{ eventId: 'live1', type: 'session', timestamp: '2026-08-30T10:00:00Z' }];
    const archives = [
        { type: 'student_analytics_archive', events: [
            { eventId: 'old1', type: 'session', timestamp: '2026-08-01T09:00:00Z' },
            { eventId: 'old2', type: 'exercise', timestamp: '2026-08-02T09:00:00Z' },
        ]},
    ];
    const out = mergeAnalytics(live, archives);
    assert.strictEqual(out.length, 3);
    const ids = out.map(e => e.eventId).sort();
    assert.deepStrictEqual(ids, ['live1', 'old1', 'old2']);
});

test('mergeAnalytics: de-dups overlap by eventId', () => {
    const live = [{ eventId: 'dup', type: 'session', timestamp: '2026-08-30T10:00:00Z' }];
    const archives = [{ type: 'student_analytics_archive', events: [
        { eventId: 'dup', type: 'session', timestamp: '2026-08-30T10:00:00Z' }, // overlap with live
        { eventId: 'fresh', type: 'exercise', timestamp: '2026-08-01T09:00:00Z' },
    ]}];
    const out = mergeAnalytics(live, archives);
    assert.strictEqual(out.length, 2); // dup removed, fresh kept
});

test('mergeAnalytics: ignores malformed archives', () => {
    const live = [{ eventId: 'a' }];
    const out = mergeAnalytics(live, [null, {}, { foo: 'bar' }]);
    assert.strictEqual(out.length, 1);
});

test('getAnalyticsInRange: prefers merged _fullAnalytics over live analytics', () => {
    const student = {
        analytics: [{ eventId: 'live', type: 'session', timestamp: '2026-08-30T10:00:00Z' }],
        _fullAnalytics: [
            { eventId: 'live', type: 'session', timestamp: '2026-08-30T10:00:00Z' },
            { eventId: 'arch', type: 'session', timestamp: '2026-08-01T09:00:00Z' },
        ],
    };
    const out = getAnalyticsInRange(student, '', '');
    assert.strictEqual(out.length, 2);
});

test('getAnalyticsInRange: date filter applies to merged set', () => {
    const student = {
        _fullAnalytics: [
            { eventId: 'live', type: 'session', timestamp: '2026-08-30T10:00:00Z' },
            { eventId: 'arch', type: 'session', timestamp: '2026-08-01T09:00:00Z' },
        ],
    };
    // Only August 30 onward
    const out = getAnalyticsInRange(student, '2026-08-30', '2026-08-31');
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].eventId, 'live');
});

test('getAnalyticsInRange: falls back to live analytics when no merge', () => {
    const student = { analytics: [{ eventId: 'x', type: 'session', timestamp: '2026-08-30T10:00:00Z' }] };
    const out = getAnalyticsInRange(student, '', '');
    assert.strictEqual(out.length, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
