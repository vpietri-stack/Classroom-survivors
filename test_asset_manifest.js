// ============================================================
// ASSET MANIFEST SYNC — asset_cache.js vs the files on disk.
//
// Guarantee requested by the user: any NEW image added as a game
// asset must automatically be covered by the prefetch cache.
//  1) every .png under sprites/td/ on disk is listed in
//     AssetCache.TD_SPRITES  (forgotten new sprite -> FAIL)
//  2) every runtime .png under sprites/vs/ on disk is listed in
//     AssetCache.VS_SPRITES (files with '_raw' in the name are
//     uncut tooling sheets, never loaded at runtime -> excluded)
//  3) every .mp3 under music/ on disk is listed in AssetCache.MUSIC
//  4) every .mp3 under sfx/ on disk is listed in AssetCache.SFX
//  5) every listed path exists on disk        (stale entry -> FAIL)
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

// --- extract a list of quoted string literals from an array in asset_cache.js ---
const src = fs.readFileSync(path.join(__dirname, 'asset_cache.js'), 'utf8');
function extractList(name) {
  const m = src.match(new RegExp(name + '\\s*=\\s*\\[([\\s\\S]*?)\\];'));
  ok(!!m, 'asset_cache.js contains a ' + name + ' array');
  const list = m ? Array.from(m[1].matchAll(/'([^']+)'/g)).map(x => x[1]) : [];
  ok(list.length > 0, name + ' is non-empty (' + list.length + ' entries)');
  return list;
}

// --- walk a dir for files with the given extension --------------------------
function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, ext));
    else if (e.isFile() && e.name.toLowerCase().endsWith(ext)) out.push(p);
  }
  return out;
}
function rel(p) { return path.relative(__dirname, p).split(path.sep).join('/'); }

// Sync-check one manifest against one disk dir, both directions.
function checkGroup(name, dir, ext, diskFilter) {
  const listed = extractList(name);
  let onDisk = walk(path.join(__dirname, dir), ext).map(rel);
  if (diskFilter) onDisk = onDisk.filter(diskFilter);
  // disk -> list: a new runtime asset must be added to the manifest
  for (const f of onDisk) ok(listed.includes(f), name + ': on disk & listed: ' + f);
  // list -> disk: no stale entries pointing at deleted files
  for (const f of listed) ok(onDisk.includes(f), name + ': listed & on disk: ' + f);
}

checkGroup('TD_SPRITES', 'sprites/td', '.png');
// '_raw' sheets are Nano Banana slicing inputs, never loaded at runtime
checkGroup('VS_SPRITES', 'sprites/vs', '.png', f => !/_raw/.test(f));
checkGroup('MUSIC', 'music', '.mp3');
checkGroup('SFX', 'sfx', '.mp3');

console.log('\n--- ASSET MANIFEST ---');
console.log(pass + ' passed, ' + fail + ' failed');
console.log('RESULT: ' + (fail === 0 ? 'PASS' : 'FAIL'));
process.exit(fail === 0 ? 0 : 1);
