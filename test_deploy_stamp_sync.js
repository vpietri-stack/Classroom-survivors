// test_deploy_stamp_sync.js
// =============================================================================
// GUARD RAIL — deploy version stamps MUST stay in sync.
//
// Three stamps must be IDENTICAL after every deploy:
//   1. version.json            -> "version"
//   2. frontend_auth.js        -> const APP_VERSION = '...'
//   3. index.html              -> <script src="frontend_auth.js?v=...">
//
// WHY: startVersionWatchdog() (frontend_auth.js) polls version.json and, if the
// live version is GREATER than the running APP_VERSION, calls
// registerUpdateBanner() -> the red bottom banner "⚠️ 无法保存进度 — 点击重新输入密码"
// shows for EVERY user (students + teacher). A mismatch = everyone sees the
// banner and can't self-heal. This was broken in commit 9accb3d's predecessor
// (version.json bumped, APP_VERSION + index.html ?v= forgotten) and took a full
// Pages-deploy unstick to recover.
//
// This test is wired into `npm test`, which is REQUIRED green before any commit
// (repo discipline). So a future change literally cannot ship a stamp drift.
// To bump a version: edit all three, then `npm test` must pass.
// =============================================================================
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const failures = [];

// 1. version.json
let vj;
try {
  vj = JSON.parse(read('version.json')).version;
  if (!vj) failures.push('version.json: "version" field is empty');
} catch (e) {
  failures.push('version.json: could not read/parse -> ' + e.message);
}

// 2. frontend_auth.js  const APP_VERSION = '...'
const fa = read('frontend_auth.js');
const mApp = fa.match(/const\s+APP_VERSION\s*=\s*'([^']+)'/);
if (!mApp) failures.push("frontend_auth.js: APP_VERSION not found (expected `const APP_VERSION = 'YYYY-MM-DDx'`)");
const appV = mApp ? mApp[1] : null;

// 3. index.html  frontend_auth.js?v=...
const ih = read('index.html');
const mIdx = ih.match(/frontend_auth\.js\?v=([0-9A-Za-z\-]+)/);
if (!mIdx) failures.push('index.html: frontend_auth.js ?v= cache-buster stamp not found');
const idxV = mIdx ? mIdx[1] : null;

// Cross-check all present values are equal
const present = [vj, appV, idxV].filter(Boolean);
if (present.length === 3) {
  if (!(vj === appV && appV === idxV)) {
    failures.push(
      `stamp mismatch -> version.json=${vj} | frontend_auth.js APP_VERSION=${appV} | index.html ?v=${idxV}`
    );
  }
}

if (failures.length) {
  console.error('');
  console.error('DEPLOY STAMP MISMATCH — the version watchdog will show the red');
  console.error('"can\'t save progress" banner to ALL users until this is fixed.');
  console.error('Fix: set version.json "version", frontend_auth.js APP_VERSION, and');
  console.error('index.html frontend_auth.js ?v= to the SAME stamp, then re-run npm test.');
  console.error('');
  failures.forEach((f) => console.error('  - ' + f));
  console.error('');
  process.exit(1);
}

console.log(`DEPLOY STAMPS SYNCED at ${vj} (version.json = frontend_auth.js APP_VERSION = index.html ?v=)`);
