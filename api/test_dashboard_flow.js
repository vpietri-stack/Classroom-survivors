// Teacher-dashboard flow under ENFORCED mode (REQUIRE_AUTH=true).
// Mirrors what teacher_dashboard.js + admin_dashboard.js actually do:
//   1. teacher/BM logs in via the MAIN app (frontend_auth.js) -> /login POST {login,password}
//   2. token is stored (csSessionToken) and apiFetch auto-attaches it
//   3. dashboard calls /getStudents?includeSecure=true and /manageBms?action=list WITH the token
// Confirms the dashboard keeps working once REQUIRE_AUTH is flipped true.

const BASE = process.env.TEST_BASE || 'http://localhost:7074/api';
const APP_KEY = 'test-harness-key';
const args = [];
function log(ok, name, extra = '') { args.push(ok); console.log((ok ? 'PASS' : 'FAIL') + ': ' + name + (extra ? ' [' + extra + ']' : '')); }

function req(path, opts = {}) {
  return fetch(BASE + path, {
    ...opts,
    headers: { 'X-App-Key': APP_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

async function main() {
  // 1. BM/teacher login (main-app flow)
  const loginRes = await req('/login', {
    method: 'POST',
    body: JSON.stringify({ login: 'val', password: 'teacher123' }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  const token = loginBody.token;
  log(loginRes.status === 200 && !!token, 'BM login via main app returns token', 'status=' + loginRes.status);

  const authHdr = { Authorization: 'Bearer ' + token };

  // 2. getStudents?includeSecure=true with the privileged token -> full list, password stripped
  const gsRes = await req('/getStudents?includeSecure=true', { headers: authHdr });
  const gs = await gsRes.json().catch(() => []);
  log(gsRes.status === 200, 'dashboard getStudents(includeSecure) 200 under enforcement', 'status=' + gsRes.status);
  log(Array.isArray(gs) && gs.length > 0, 'dashboard getStudents returns full student list', 'count=' + (gs.length || 0));
  log(!gs.some(s => s.password), 'dashboard getStudents strips password field', 'leaked=' + gs.filter(s => s.password).length);

  // 3. manageBms privileged call with the token -> 200 (used by admin_dashboard.js)
  const bmRes = await req('/manageBms?action=list', { headers: authHdr });
  log(bmRes.status === 200, 'dashboard manageBms(list) 200 under enforcement', 'status=' + bmRes.status);

  // 4. NEGATIVE: same privileged calls WITHOUT a token -> 401 (proves the lock bites)
  const gsNoTok = await req('/getStudents?includeSecure=true');
  log(gsNoTok.status === 401, 'getStudents without token -> 401 (lock enforced)', 'status=' + gsNoTok.status);

  const pass = args.filter(Boolean).length, total = args.length;
  console.log('\nRESULT: ' + pass + '/' + total + (pass === total ? ' ALL PASS' : ' SOME FAIL'));
  process.exit(pass === total ? 0 : 1);
}
main().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
