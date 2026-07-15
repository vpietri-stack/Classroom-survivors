// End-to-end CLIENT<->SERVER contract test (no DOM).
// Mirrors exactly what frontend_auth.js now does:
//   - read app-config.json for X-App-Key
//   - POST /login -> capture data.token
//   - store token, send as Authorization: Bearer on subsequent calls
//   - do NOT append ?creatorId
// Runs against local func (:7074) + isolated test DB. Not part of the app bundle.
const BASE = process.env.TEST_BASE || 'http://localhost:7074/api';

let pass = 0, fail = 0;
const log = (ok, name, extra = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
    ok ? pass++ : fail++;
};

async function getAppKey() {
    try {
        const r = await fetch('http://localhost:7074/app-config.json');
        if (r.ok) { const j = await r.json(); return j.APP_API_KEY || ''; }
    } catch {}
    return '';
}

async function main() {
    const appKey = await getAppKey();

    // 1. Login as alice (browser would POST {login,password})
    const loginRes = await fetch(`${BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Key': appKey },
        body: JSON.stringify({ login: 'alice', password: 'alice123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    log(loginRes.status === 200 && !!token, 'login returns token (client captures data.token)', 'status=' + loginRes.status);

    // 2. CORS preflight must advertise Authorization (browser will block header otherwise)
    const preflight = await fetch(`${BASE}/saveAnalytics`, {
        method: 'OPTIONS',
        headers: {
            'Origin': 'http://localhost:7074',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Authorization, X-App-Key, Content-Type'
        }
    });
    const allowHeaders = preflight.headers.get('Access-Control-Allow-Headers') || '';
    log(/Authorization/i.test(allowHeaders), 'CORS preflight allows Authorization header', allowHeaders);

    // 3. Client attaches Bearer (exactly like apiFetch) + does NOT add ?creatorId
    //    saveAnalytics with a body that still carries studentId (legacy field) -> server
    //    must scope to token.sub, not the body field.
    const saveRes = await fetch(`${BASE}/saveAnalytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Key': appKey, 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ studentId: 'student_bob', events: [{ e2e: true }] }) // bob id must be IGNORED
    });
    log(saveRes.status === 200, 'saveAnalytics with Bearer 200 (client->server)', 'status=' + saveRes.status);

    // 4. getStudents via Bearer returns ONLY alice (token.scoped)
    const gsRes = await fetch(`${BASE}/getStudents`, {
        headers: { 'X-App-Key': appKey, 'Authorization': 'Bearer ' + token }
    });
    const gs = await gsRes.json();
    log(gs.length === 1 && gs[0].login === 'alice', 'getStudents Bearer-scoped to alice', 'len=' + gs.length);

    // 5. alice's record has the e2e event (self-write), bob's does NOT (body studentId ignored)
    const aliceHas = JSON.stringify(gs[0].analytics || '').includes('"e2e":true');
    log(aliceHas, 'alice self-write landed (token.sub used)');

    // 6. NO Bearer -> 401 (proves the old no-token client path is now rejected)
    const noTok = await fetch(`${BASE}/saveAnalytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Key': appKey },
        body: JSON.stringify({ events: [{ x: 1 }] })
    });
    log(noTok.status === 401, 'no-Bearer call rejected 401 (old client would break)', 'status=' + noTok.status);

    console.log(`\nE2E RESULT: pass=${pass} fail=${fail}`);
    process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
