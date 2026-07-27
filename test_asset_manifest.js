// ============================================================
// ASSET MANIFEST SYNC — asset_cache.js vs the files on disk.
//
// Guarantee requested by the user: any NEW image added as a game
// asset must automatically be covered by the prefetch cache.
//  1) every .png under sprites/td/ on disk is listed in
//     AssetCache.TD_SPRITES  (forgotten new sprite -> FAIL)
//  2) every listed path exists on disk        (stale entry -> FAIL)
// Vocab images + audio_mp3 need no manifest: their paths are
// derived from TEACHING_CONTENT at runtime and cached on first
// use, so new files are covered automatically.
// Run: node test_asset_manifest.js   (part of npm test)
// ============================================================
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('PASS: ' + msg); }
  else { fail++; console.error('FAIL: ' + msg); }
}

// --- extract TD_SPRITES from asset_cache.js (string literals in the array) ---
const src = fs.readFileSync(path.join(__dirname, 'asset_cache.js'), 'utf8');
const arrMatch = src.match(/TD_SPRITES\s*=\s*\[([\s\S]*?)\];/);
ok(!!arrMatch, 'asset_cache.js contains a TD_SPRITES array');
const listed = arrMatch
  ? Array.from(arrMatch[1].matchAll(/'([^']+)'/g)).map(m => m[1])
  : [];
ok(listed.length > 0, 'TD_SPRITES is non-empty (' + listed.length + ' entries)');

// --- walk sprites/td for .png files on disk --------------------------------
function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.png')) out.push(p);
  }
  return out;
}
const spritesDir = path.join(__dirname, 'sprites', 'td');
const onDisk = walk(spritesDir).map(p =>
  path.relative(__dirname, p).split(path.sep).join('/'));

// 1) disk -> list: a new sprite file must be added to TD_SPRITES
for (const f of onDisk) {
  ok(listed.includes(f), 'on disk & listed: ' + f);
}
// 2) list -> disk: no stale entries pointing at deleted files
for (const f of listed) {
  ok(onDisk.includes(f), 'listed & on disk: ' + f);
}

console.log('\n--- ASSET MANIFEST ---');
console.log(pass + ' passed, ' + fail + ' failed');
console.log('RESULT: ' + (fail === 0 ? 'PASS' : 'FAIL'));
process.exit(fail === 0 ? 0 : 1);
