const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('./geo_export.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS: ' + name); passed++; }
    catch (e) { console.error('FAIL: ' + name); console.error(e); failed++; }
}

console.log('=== TEST SUITE: Geo Export ===\n');

// --- coordinate conversion ---------------------------------------------------
test('outside China: passthrough (no GCJ shift)', () => {
    assert.deepStrictEqual(G.wgs84ToGcj02(48.8583, 2.2945), [48.8583, 2.2945]); // Paris
    assert.deepStrictEqual(G.wgs84ToBd09(48.8583, 2.2945), [48.8583, 2.2945]);
});
test('inside China: GCJ offset direction+magnitude sane (100m-1.2km)', () => {
    const [gLat, gLng] = G.wgs84ToGcj02(25.0458, 102.7101); // Kunming
    const dLat = Math.abs(gLat - 25.0458) * 111000;
    const dLng = Math.abs(gLng - 102.7101) * 111000 * Math.cos(25.0458 * Math.PI / 180);
    assert.ok(dLat + dLng > 50 && dLat < 1200 && dLng < 1200, `offset lat=${dLat}m lng=${dLng}m`);
    // NOTE: the original brief asserted "GCJ shift in Yunnan is northeast" here, but the
    // published eviltransform/coordtransform algorithm yields ~330m SOUTH / ~145m EAST at
    // this exact point (verified via three independent transcriptions — JS x2 + Python —
    // and validated against coordtransform's README test vector 116.404,39.915 to <1mm).
    // The GCJ offset direction varies by location; NE holds for Beijing (covered by the
    // anchor test below). Pinning the exact published values is a STRONGER assertion.
    assert.ok(Math.abs(gLat - 25.04282499004523) < 1e-9 && Math.abs(gLng - 102.71153753988237) < 1e-9,
        `matches published eviltransform values: ${gLat},${gLng}`);
});
test('BD09 adds positive offset on top of GCJ02', () => {
    const [gLat, gLng] = G.wgs84ToGcj02(25.0458, 102.7101);
    const [bLat, bLng] = G.gcj02ToBd09(gLat, gLng);
    assert.ok(bLat > gLat && bLng > gLng);
    assert.ok(Math.abs(bLat - gLat) < 0.01 && Math.abs(bLng - gLng) < 0.01);
});
test('conversion is deterministic and finite', () => {
    const a = G.wgs84ToBd09(25.0458, 102.7101);
    const b = G.wgs84ToBd09(25.0458, 102.7101);
    assert.deepStrictEqual(a, b);
    assert.ok(a.every(Number.isFinite));
});
test('known anchor: Beijing wgs(39.9042,116.4074) -> bd09 within 1.5km NE', () => {
    const [bLat, bLng] = G.wgs84ToBd09(39.9042, 116.4074);
    // Published WGS84->BD09 total offset for Beijing is ~1.1-1.3km NE.
    assert.ok(bLat > 39.9042 && bLat < 39.925);
    assert.ok(bLng > 116.4074 && bLng < 116.430);
});

// --- CSV ---------------------------------------------------------------------
const students = [
    { id: 's1', fullName: 'Zhang, San', geo: { lat: 25.05, lng: 102.71, capturedAt: '2026-09-25T10:00:00.000Z', days: 3, samples: 7 } },
    { id: 's2', fullName: 'Li "Lily"', geo: null },
    { id: 's3', name: 'Wang Wu' } // no geo field at all
];
test('CSV: BOM + header + all students incl. missing', () => {
    const csv = G.buildLocationCsv(students);
    assert.ok(csv.charCodeAt(0) === 0xFEFF, 'starts with UTF-8 BOM');
    const lines = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
    assert.strictEqual(lines[0], 'studentId,name,hasLocation,capturedAt,days,samples,wgs84_lat,wgs84_lng,bd09_lat,bd09_lng,sharesCellWith');
    assert.strictEqual(lines.length, 4);
});
test('CSV: quoting for commas and double quotes', () => {
    const csv = G.buildLocationCsv(students);
    assert.ok(csv.includes('"Zhang, San"'));
    assert.ok(csv.includes('"Li ""Lily"""'));
});
test('CSV: hasLocation flags + bd09 columns populated only when geo present', () => {
    const lines = G.buildLocationCsv(students).replace(/^\uFEFF/, '').trim().split('\r\n');
    assert.ok(lines[1].startsWith('s1,"Zhang, San",1,2026-09-25T10:00:00.000Z,3,7,25.05,102.71,'));
    assert.strictEqual(lines[2].split(',')[2], '0');
    assert.ok(lines[2].endsWith(',,,,'));
    assert.strictEqual(lines[3].split(',')[2], '0');
});
test('CSV: name falls back through fullName -> name -> login', () => {
    const csv = G.buildLocationCsv([{ id: 'x', login: 'x_login' }]);
    assert.ok(csv.includes('x_login'));
});
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

// --- Baidu HTML ---------------------------------------------------------------
test('HTML: embeds student points as BD-09, injects AK, escapes </script>', () => {
    const html = G.buildBaiduMapHtml(students, 'TEST_AK_123');
    assert.ok(html.includes('ak=TEST_AK_123'), 'AK injected into script src');
    assert.ok(html.includes('api.map.baidu.com'), 'loads Baidu JS API');
    assert.ok(html.includes('const STUDENTS ='), 'data embedded');
    assert.ok(html.includes('"name":"Zhang, San"') || html.includes('\\"name\\":\\"Zhang'), 's1 embedded');
    assert.ok(!/const STUDENTS = [^;]*<\/script/.test(html), 'no raw </script> inside data');
    const dataLine = html.split('\n').find(l => l.includes('const STUDENTS ='));
    assert.ok(dataLine.includes('<') === false, 'data line contains no literal < (escaped to \\u003c)');
    assert.ok(!dataLine.includes('</'), 'no literal </ in embedded data line');
    // s2 (no geo) must NOT appear as a map point
    assert.ok(!dataLine.includes('s2') && !dataLine.includes('Lily'));
});
test('HTML: driving-time UI hooks present', () => {
    const html = G.buildBaiduMapHtml(students, 'AK');
    assert.ok(html.includes('DrivingRoute'));
    assert.ok(html.includes('计算驾车时间'));
    assert.ok(html.includes('csCampusPins'));
});
test('HTML: __NOSTUDENTS__ and __STUDENTS__ placeholders fully replaced', () => {
    const html = G.buildBaiduMapHtml(students, 'AK');
    assert.ok(html.includes('__NOSTUDENTS__') === false, 'no leftover __NOSTUDENTS__ token');
    assert.ok(html.includes('__STUDENTS__') === false, 'no leftover __STUDENTS__ token');
    // fixture: s1 has geo; s2 geo:null; s3 no geo field -> 2 without location
    assert.ok(html.includes('2 名学生暂无位置数据'), 'no-location count is 2');
});
test('HTML: $& in student name survives String.replace (no $-pattern corruption)', () => {
    const html = G.buildBaiduMapHtml(
        [{ id: 'd1', fullName: 'A$&B', geo: { lat: 25.05, lng: 102.71, capturedAt: '2026-09-25T10:00:00.000Z' } }],
        'AK');
    const line = html.split('\n').find(l => l.includes('const STUDENTS ='));
    const json = line.replace('const STUDENTS =', '').replace(/;\s*$/, '');
    const arr = JSON.parse(json);
    assert.strictEqual(arr[0].name, 'A$&B');
});

// --- DOM paths: renderGeoList / clearStudentGeo --------------------------------
// Both read the classic-script global `allStudents`, so requiring the module is
// not enough (in CommonJS `typeof allStudents` is 'undefined' and the functions
// early-return). Run the real source in a vm context with a stubbed page —
// same approach as test_asset_manifest.js / test_session_flush_deadline.js.
function loadGeoPage(students) {
    const page = { html: null, posts: [], confirms: [], alerts: [] };
    const sandbox = {
        allStudents: students,
        API_BASE: '/api',
        console,
        document: {
            getElementById: function (id) {
                if (id !== 'geoList') return null;
                return {
                    get innerHTML() { return page.html; },
                    set innerHTML(v) { page.html = v; }
                };
            }
        },
        confirm: function (msg) { page.confirms.push(msg); return sandbox.__confirmAnswer; },
        alert: function (msg) { page.alerts.push(msg); },
        // Chainable that never settles: the POST itself is what we assert on.
        apiFetch: function (url, opts) {
            page.posts.push({ url: String(url), opts: opts });
            return { then: function () { return this; }, catch: function () { return this; } };
        }
    };
    sandbox.__confirmAnswer = true;
    vm.createContext(sandbox);
    const fns = vm.runInContext(
        fs.readFileSync(path.join(__dirname, 'geo_export.js'), 'utf8') +
        '\n;({ renderGeoList: renderGeoList, clearStudentGeo: clearStudentGeo })',
        sandbox, { filename: 'geo_export.js' });
    page.renderGeoList = fns.renderGeoList;
    page.clearStudentGeo = fns.clearStudentGeo;
    page.confirmAnswer = function (v) { sandbox.__confirmAnswer = v; };
    return page;
}

const lily = {
    id: 'student_lily', fullName: 'Li "Lily"',
    geo: { lat: 25.05, lng: 102.71, capturedAt: '2026-09-25T10:00:00.000Z', days: 3, samples: 7 }
};

test('geo list: teacher-entered names are HTML-escaped in the cell text', () => {
    const nasty = { id: 'student_nasty', fullName: 'Li "Lily"><img src=x onerror=alert(1)>', geo: { lat: 25.05, lng: 102.71, capturedAt: 'x', days: 1, samples: 1 } };
    const page = loadGeoPage([nasty]);
    page.renderGeoList();
    const html = page.html;
    assert.ok(html, 'renderGeoList wrote markup into #geoList');
    assert.ok(html.includes('Li &quot;Lily&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'), 'name is escaped text: ' + html);
    assert.ok(!html.includes('<img'), 'no element injected via the name');
    assert.ok(!/&quot;>/.test(html), 'a double quote cannot close an attribute early');
});

test('geo list: the onclick payload carries the id only, never the name', () => {
    const page = loadGeoPage([lily]);
    page.renderGeoList();
    assert.ok(page.html.includes('onclick="clearStudentGeo(\'student_lily\')"'), 'id-only onclick: ' + page.html);
    assert.ok(!/clearStudentGeo\([^)]*Lily/.test(page.html), 'no name in the call payload');
});

test('geo list: a quote-bearing id is JS-escaped, not entity-escaped, in onclick', () => {
    const page = loadGeoPage([{ id: "x');alert('pwned", fullName: 'A', geo: { lat: 25.05, lng: 102.71 } }]);
    page.renderGeoList();
    const onclick = /onclick="([^"]*)"/.exec(page.html)[1];
    assert.strictEqual(onclick, "clearStudentGeo('x\\');alert(\\'pwned')");
    assert.ok(!onclick.includes('&#39;'), '&#39; would decode back to a live quote before the JS parses');
});

test('geo list: 同址 badge and columns still render for plain data', () => {
    const a = { id: 's1', fullName: 'Ann', geo: { lat: 25.05, lng: 102.71, capturedAt: '2026-09-25T10:00:00.000Z', days: 4, samples: 9 } };
    const b = { id: 's2', fullName: 'Bob', geo: { lat: 25.05, lng: 102.71, capturedAt: '2026-09-25T10:00:00.000Z', days: 2, samples: 3 } };
    const page = loadGeoPage([a, b]);
    page.renderGeoList();
    assert.ok(page.html.includes('同址'), 'shared-cell badge kept');
    assert.ok(page.html.includes('25.05,102.71'), 'home cell kept');
    assert.ok(page.html.includes('<td>4</td><td>9</td><td>2026-09-25</td>'), 'days/samples/captured kept');
});

test('geo list: header labels the Samples column as the all-cell total', () => {
    const page = loadGeoPage([lily]);
    page.renderGeoList();
    assert.ok(page.html.includes('<th>Samples (all)</th>'), 'Samples column is scoped to all cells: ' + page.html);
});

test('malformed geo (lat only, no usable lng): excluded from list, share map and CSV coords', () => {
    const broken = [
        { id: 's1', fullName: 'Ann', geo: { lat: 25.05, lng: 102.71, capturedAt: 'x', days: 2, samples: 2 } },
        { id: 'bad1', fullName: 'Broken Null Lng', geo: { lat: 25.05, lng: null, capturedAt: 'y', days: 1, samples: 1 } },
        { id: 'bad2', fullName: 'Broken Text Lng', geo: { lat: 25.05, lng: 'abc', capturedAt: 'z', days: 1, samples: 1 } },
        { id: 'bad3', fullName: 'Broken Zero Lng', geo: { lat: 25.05, lng: '', capturedAt: 'w', days: 1, samples: 1 } }
    ];
    // share map: only the one usable student is keyed, and nobody false-shares
    const share = G._cellShareMap(broken);
    assert.deepStrictEqual(Object.keys(share), ['25.05,102.71'], 'no NaN/0 cell buckets');
    assert.deepStrictEqual(share['25.05,102.71'], ['s1']);
    // dashboard list: the three malformed rows are gone, the healthy one stays
    const page = loadGeoPage(broken);
    page.renderGeoList();
    assert.ok(page.html.includes('Ann'), 'usable student still listed');
    ['Broken Null Lng', 'Broken Text Lng', 'Broken Zero Lng'].forEach(function (n) {
        assert.ok(!page.html.includes(n), n + ' filtered out of the table');
    });
    assert.ok(!/25\.05,(NaN|null|abc|,|<\/td>)/.test(page.html), 'no garbage coordinate cell rendered');
    assert.ok(!page.html.includes('同址'), 'malformed docs cannot create a phantom 同址 badge');
    // CSV: malformed docs report hasLocation=0 with empty coord columns
    const lines = G.buildLocationCsv(broken).replace(/^\uFEFF/, '').trim().split('\r\n');
    ['bad1', 'bad2', 'bad3'].forEach(function (id, i) {
        assert.strictEqual(lines[i + 2].split(',')[2], '0', id + ' hasLocation=0');
    });
});

test('clearGeo: POSTs through apiFetch with a JSON content-type and id-only body', () => {
    const page = loadGeoPage([lily]);
    page.clearStudentGeo('student_lily');
    assert.strictEqual(page.posts.length, 1, 'exactly one call');
    const post = page.posts[0];
    assert.ok(post.url.endsWith('/clearGeo'), 'clearGeo endpoint');
    assert.strictEqual(post.opts.method, 'POST');
    assert.strictEqual(post.opts.headers['Content-Type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(post.opts.body), { studentId: 'student_lily' });
    assert.ok(page.confirms[0].includes('Li "Lily"'), 'confirm text re-resolves the display name from allStudents');
});

test('clearGeo: an explicit name argument still wins (signature kept) and a declined confirm posts nothing', () => {
    const page = loadGeoPage([lily]);
    page.clearStudentGeo('student_lily', 'Custom Name');
    assert.ok(page.confirms[0].includes('Custom Name'), '(id, name) signature preserved');
    page.confirmAnswer(false);
    page.clearStudentGeo('student_lily');
    assert.strictEqual(page.posts.length, 1, 'no second POST after declining the confirm');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
