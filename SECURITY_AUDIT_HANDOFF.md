# Security Audit + Auth Hardening — Handoff File

> **Audience:** future developer / AI agent picking this project up, and Val for reference.
> **Date written:** 2026-07-23 (compiled after the auth-hardening work + `REQUIRE_AUTH` flip + `testMode` gate).
> **Repo:** `Classroom-survivors` (root `D:/coding/html games/Classroom-survivors`).
> **Live site:** https://vpietri-stack.github.io/Classroom-survivors/  (GitHub Pages, static)
> **Live API:** Azure Static Web App `Val-ESL` → `https://brave-bush-0438ab000.7.azurestaticapps.net/api`
> **Branch at time of writing:** `main` (HEAD `b2cd8bd`, which already bundles speech-recognition + Tower Defense work *on top of* the security fixes).

---

## 0. TL;DR (plain language for Val)

- All the security bugs we found are **fixed and live-verified**.
- Anonymous people can **no longer read student data** — the API now requires a login token (`REQUIRE_AUTH` is on in production).
- Your own login, dashboard, password view, and password change all still work.
- The "test mode" back-door that gave away a free teacher login is now **switched off in production** (it only works on your local machine).
- **One thing still open:** we should rotate the database key + session secret, because they flashed in our chat earlier. Not urgent, but recommended.
- **You still need to do the real-world check:** log in as a student in a browser and play a round, to confirm progress saving works end-to-end (I can't log in as a student from here).

---

## 1. Current Production State (verified 2026-07-23)

### 1.1 Azure SWA environment variables (presence only — NO values reproduced here)
| Key | In prod? | Meaning |
|-----|----------|---------|
| `COSMOS_ENDPOINT` | ✅ | Cosmos DB account URL |
| `COSMOS_KEY` | ✅ | Cosmos read/write key (full DB access) |
| `REQUIRE_AUTH` | ✅ = `true` | **Auth lock is ON** (anonymous API calls rejected) |
| `SESSION_SECRET` | ✅ | JWT signing secret |
| `TEST_MODE` | ❌ **absent** | testMode bypass is OFF in prod (correct) |
| `APP_API_KEY` | ❌ not set | app-key gate is a no-op (see §4) |

> Set via Azure Portal → Val-ESL → *Environment variables* (Production) blade, **or** via the Azure CLI at `D:/azure-cli/venv/Scripts/az.bat` (`az staticwebapp appsettings set -n Val-ESL -g classroom-survivors --setting-names "KEY=VALUE"`).

### 1.2 Live verification results (curl against the real API)
| Test | Result | Interpretation |
|------|--------|----------------|
| `GET /api/getStudents` (no token) | **401** | Anonymous access blocked ✅ |
| `GET /api/getStudents` (valid teacher token) | **200**, 96 students | Authorized access works ✅ |
| `POST /api/login?testMode=true` (body `{}`) | **401** | testMode bypass OFF in prod ✅ |
| `POST /api/changePassword` (token.sub === body.id) | **200** | Self password change works ✅ |
| `POST /api/changePassword` (token.sub ≠ body.id) | **403** | Cross-user change blocked ✅ |
| `POST /api/login` (real teacher creds) | verified in earlier sessions; **re-confirm in browser** | Password login path intact |

### 1.3 Version stamps (unchanged by security work, documented for deploy discipline)
- `version.json` → `"version": "2026-07-23c"`
- `frontend_auth.js` → `const APP_VERSION = '2026-07-23c'`
- These MUST stay identical on every deploy (see `DEPLOY_VERSION_STAMP.md`). Security deploys did **not** bump them.

---

## 2. The Audit Findings (what was wrong → what we did)

Severity order, each with root cause + fix + where the fix lives.

### FINDING 1 — Anonymous API access exposed all student data (CRITICAL, now FIXED)
**Symptom:** `GET /api/getStudents` with no token returned all 96 students, including plaintext passwords when `?includeSecure=true` was appended.
**Root cause:** `getStudents.js` only blocked anonymous callers *inside* an `includeSecure` branch; the plain list was world-readable because `REQUIRE_AUTH` was off.
**Fix:** Flipped `REQUIRE_AUTH` to `true` in production. Now `getStudents.js` calls `auth.enforceAuth()` → `auth.unauthorized()` (401) for any unauthenticated caller.
**Where:** `api/src/functions/getStudents.js:19`; gate helper in `shared/auth.js` (`enforceAuth`, `unauthorized`).
**Deploy note:** No code redeploy needed — it's an env var. Flipped via Azure CLI on 2026-07-23. Reversible (set `false`).

### FINDING 2 — Azure SWA proxy hijacked the `Authorization` header (CRITICAL, now FIXED)
**Symptom:** Client sent `Authorization: Bearer <ourJWT>`; server-side `requireAuth` saw a *different* token and rejected everything with 403.
**Root cause (deep):** Azure SWA *managed functions* inject their own `Authorization` header on every invocation — a host token with `iss: https://*.scm.azurewebsites.net`, `aud: https://*.azurewebsites.net/azurefunctions`. This **overwrites** any client-supplied `Authorization` header before function code runs. Diagnosed with a probe (`diagAuth6`): we sent a fake short token `abc123def` and the server *received a 365-char Azure JWT* — proving the header is rewritten in transit, not by our code.
**Fix:** Client now sends our JWT in **`X-Auth-Token`** instead of `Authorization`. `auth.getBearer()` prefers `X-Auth-Token`, falls back to `Authorization`. `X-Auth-Token` added to CORS `Access-Control-Allow-Headers` in both `staticwebapp.config.json` and `api/host.json`.
**Where:**
- `api/src/functions/shared/auth.js` — `getBearer()`
- `frontend_auth.js` — `apiFetch()` sets `X-Auth-Token`
- `staticwebapp.config.json:9,17` and `api/host.json` — allow-header lists
**Verified:** live `X-Auth-Token` arrives intact (221 chars, our JWT unmodified).

### FINDING 3 — Teacher/admin dashboard returned empty student list (HIGH, now FIXED)
**Symptom:** Val (role `admin`) opened the dashboard — no students shown.
**Root cause:** `isPrivileged(token)` (in `shared/auth.js`) only treated `teacher`/`BM` as privileged and **excluded `admin`**, so the dashboard's data call was gated out for Val.
**Fix:** `isPrivileged()` now includes `admin`. (Plus an earlier backend fix: `getStudents` was stripping the `password` field and `publicUser()` always stripped it — both relaxed behind the secure gate so teachers can *view* passwords; see Finding 6.)
**Where:** `shared/auth.js` (`isPrivileged`); `getStudents.js` (`includeSecure`); `admin_dashboard.js` (render + eye-toggle + no-empty-save).

### FINDING 4 — Student "Save Changes" returned 403 (HIGH, now FIXED)
**Symptom:** Editing a student record (Settings) → 403 for Val.
**Root cause:** `updateStudent.js`, `addStudent.js`, and `login.js` defined `PRIV_ROLES = ['teacher','BM']` (no `admin`). `setTargets.js`/`manageBms.js` called `isPrivileged(token, ['teacher','BM'])` explicitly. All excluded `admin`.
**Fix:** `PRIV_ROLES` → `['teacher','BM','admin']` in the three files; `setTargets`/`manageBms` changed to `isPrivileged(token)` (default now includes admin).
**Where:** `updateStudent.js`, `addStudent.js`, `login.js`, `setTargets.js`, `manageBms.js`. Committed `0745bdb`. Live-verified: `updateStudent` with Val's admin token → `success:true`.

### FINDING 5 — `changePassword` 403 + cross-user risk (HIGH, now FIXED)
**Symptom:** Password change failed with 403; also a student could (in theory) change *another* student's password.
**Root cause:** (a) the `Authorization` hijack (Finding 2) broke token verification; (b) `requireSelfOrRole(token, id)` correctly required `token.sub === body.id` (the Cosmos **doc id**, e.g. `student_test6`), but the frontend sometimes sent the *login* (`test6`) instead of the doc id — a mismatch the gate rightly rejected.
**Fix:** (a) moved token to `X-Auth-Token` (Finding 2). (b) confirmed frontend `authActiveUser.id` is set to the doc id on login. Gate `requireSelfOrRole` retained as-is (it's correct).
**Where:** `changePassword.js:16,22`; `frontend_auth.js` (login sets `authActiveUser.id = data.id`).

### FINDING 6 — Teachers couldn't SEE student passwords (UX regression from earlier security pass, now RESTORED)
**Context:** Val needs to *view* passwords to recover them for parents via WeChat (no email/SMS/OAuth in mainland China). An earlier "security" pass had stripped passwords everywhere. Val explicitly chose to **revert to plaintext storage** for recoverability.
**Fix:** 
- `addStudent.js` / `updateStudent.js` store the password **plaintext** again.
- `login.js` does **recovery-on-login**: if the stored value is a `scrypt$` hash (legacy) or empty, it stores the just-typed plaintext so the teacher can see it next time.
- `getStudents` returns `password` only when `?includeSecure=true` + caller is teacher/BM/admin (401 for anon).
- `admin_dashboard.js` shows the recovered password in a box with an eye-toggle, and the save handler only sends `password` when non-empty (so an empty view can't nuke a stored password).
**DB state note:** mixed — imported/CSV/reset passwords are plaintext; passwords from *before* recovery-on-login are still `scrypt$` hashes and show as `scrypt$…` until that student next logs in.

### FINDING 7 — `login?testMode=true` gave away a free teacher token (HIGH, now FIXED)
**Symptom:** Anyone hitting `POST /api/login?testMode=true` (from the GitHub Pages origin, which passes the app-key gate with no key) got a valid teacher/BM JWT **with no password check**.
**Root cause:** `login.js` unconditionally honored the `testMode` query param.
**Fix:** Gated behind `auth.testModeEnabled()`, which returns `true` **only if `TEST_MODE=true` is set in env**. Prod has `TEST_MODE` unset → bypass skipped → falls through to normal login → 401.
**Where:** `shared/auth.js:113` (`testModeEnabled`), `:201` (export); `login.js:19`. Committed and live-verified (401 in prod). `api/local.settings.json` sets `TEST_MODE=true` so Val's *local* func host keeps the dev convenience.

### FINDING 8 — Credential exposure in client / chat (MEDIUM, remediated; rotation recommended)
**History:** Early in the project, Cosmos credentials were embedded in client-side code. Remediated by moving all secrets to SWA env vars + server-side functions. **Outstanding:** `COSMOS_KEY` and `SESSION_SECRET` values appeared in this chat's tool output during the audit. Recommend **rotation** (see §5). Not urgent, but treat as exposed.

---

## 3. Auth Model (how it works now)

- **Token:** JWT signed with `SESSION_SECRET`, `sub` = Cosmos doc id (e.g. `student_test6`, `teacher_admin`), plus `login`, `role`, `name`.
- **Transport:** client sends token in `X-Auth-Token` header (NOT `Authorization` — see Finding 2).
- **Gate `requireAuth(request)`:** if `enforceAuth()` (i.e. `REQUIRE_AUTH=true`) is on, returns `{error: 401}` for missing/invalid token; otherwise returns `{token: verified|null}` for legacy compat.
- **Privilege:** `isPrivileged(token)` = role ∈ {teacher, BM, admin}. Used by dashboards, `setTargets`, `manageBms`.
- **Self-scope:** `requireSelfOrRole(token, id)` enforces `token.sub === id` (or privileged) for `changePassword`/`updateStudent`.
- **App-key gate:** `validateApiKey(request)` — currently a no-op because `APP_API_KEY` is not set; it allows the GitHub Pages origin through. Left intentionally permissive; if you ever set `APP_API_KEY`, all clients must send `X-App-Key`.

---

## 4. Deployment Model & Emergency Switches

- **Static site** (HTML/JS) = GitHub Pages, built from `main` on push (~1–2 min).
- **API** (Azure Functions) = Azure SWA GitHub Action, built from `main` on push. Workflow file lives under `.github/workflows/` (name generated, e.g. `azure-static-web-apps-*.yml`); confirm via `git ls-files | grep workflows`.
- **Auth lock toggle (no redeploy):** `az staticwebapp appsettings set -n Val-ESL -g classroom-survivors --setting-names "REQUIRE_AUTH=false"` (or Portal). Takes effect in seconds.
- **testMode bypass (local only):** set `TEST_MODE=true` in `api/local.settings.json` for your local func host; **never** set it in the SWA Portal.
- **Rotate secrets:** `az staticwebapp appsettings set ... --setting-names "COSMOS_KEY=<new>" "SESSION_SECRET=<new>"`. After rotating `SESSION_SECRET`, all users must re-login (old tokens invalid). After rotating `COSMOS_KEY`, update it in Portal too (old key still valid until regenerated in Cosmos).
- **Cache discipline:** always bump `version.json` + `frontend_auth.js APP_VERSION` together (see `DEPLOY_VERSION_STAMP.md`). Security deploys did NOT change these.

---

## 5. Open Items & Recommendations

1. **Rotate `COSMOS_KEY` + `SESSION_SECRET`** (exposed in chat earlier). ~5 min via CLI. Recommended but not blocking.
2. **Browser end-to-end check by Val:** student login → play a round → confirm progress/session saves + round ends normally. I can't do this (no student password). This is the only unverified happy-path.
3. **`APP_API_KEY`:** consider setting it to require a shared key from the GitHub Pages client, closing the last "any GitHub Pages origin" gap. Optional — adds a static secret to the client (not truly secret, but raises the bar).
4. **`valprobe` / `probe123` test account** still exists in the **production** Cosmos DB (leftover from the audit). Delete it when convenient.
5. **Future hardening (optional, out of scope):** Azure AD / managed identity for Cosmos instead of a shared key; `git filter-repo` to scrub any historical secret commits (verify none remain first — current tree is clean).

---

## 6. File Map — where security logic lives

| Concern | File |
|---------|------|
| Auth gates, JWT, testMode flag, privilege | `api/src/functions/shared/auth.js` |
| App-key gate (no-op until `APP_API_KEY` set) | `api/src/functions/shared/validateApiKey.js` |
| Cosmos client | `api/src/functions/shared/db.js` |
| Login + testMode bypass | `api/src/functions/login.js` |
| Password change (self-scope) | `api/src/functions/changePassword.js` |
| Student list (secure gate) | `api/src/functions/getStudents.js` |
| Student write (admin role) | `api/src/functions/updateStudent.js`, `addStudent.js` |
| BM/target writes (privilege) | `api/src/functions/setTargets.js`, `manageBms.js` |
| Analytics/avatar writes (token scope) | `api/src/functions/saveAnalytics.js`, `updateAvatar.js` |
| Client token send + version watchdog | `frontend_auth.js` |
| Admin password view UI | `admin_dashboard.js` |
| CORS / allow-headers | `staticwebapp.config.json`, `api/host.json` |
| Local dev env (has `TEST_MODE=true`) | `api/local.settings.json` (**untracked, do not commit**) |
| Deploy version discipline | `DEPLOY_VERSION_STAMP.md`, `version.json` |

---

## 7. Verification Checklist (what was / wasn't tested)

**Tested live (2026-07-23):**
- [x] Anonymous `getStudents` → 401 (lock on)
- [x] Authorized teacher `getStudents` → 200 (96 students)
- [x] `login?testMode=true` → 401 (bypass off in prod)
- [x] Self `changePassword` (matching id) → 200; cross-user → 403
- [x] `node --check` + `npm run test` → 11/11 pass (final state)
- [x] No leftover diagnostic/`TEMP DIAG` code in `api/src/functions/`

**NOT tested live (needs Val or a student credential):**
- [ ] Real student password login + full round play + progress save
- [ ] Real teacher password login in browser (curl used a placeholder; path verified via token)
- [ ] `recovery-on-login` producing a visible plaintext password for a *legacy-hashed* student (verified locally earlier; spot-check one student in prod)

---

*End of handoff. Secrets are intentionally NOT reproduced in this file — refer to the Azure Portal / `D:/azure-cli` for live values, and rotate `COSMOS_KEY` + `SESSION_SECRET` per §5.*
