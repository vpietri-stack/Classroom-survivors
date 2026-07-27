// ============================================================
// gen_missing_audio.js — vocab audio coverage tool.
//
// For every unique item in the vocab arrays of a content file:
//   1. probe Youdao dictvoice (the app's primary TTS)
//   2. check for a local recording in audio_mp3/ (sanitized filename)
//   3. with --generate: create missing MP3s via the Sound of Text
//      API (Google TTS, voice en-GB) and save them into audio_mp3/
//
// Usage:
//   node gen_missing_audio.js content_pu1.js             (report only)
//   node gen_missing_audio.js content_pu1.js --generate  (report + fill gaps)
//
// Youdao failure signature (calibrated 2026-07-28): HTTP 500 +
// application/json for "X - Y" combos; tiny (<4KB) audio bodies for
// some single words. Success = 200 audio/mpeg >= 4KB.
// Filename convention shared with asset_cache.js audioPath():
// exact phrase text minus Windows-illegal characters (\ / : * ? " < > |).
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

const contentFile = process.argv[2];
const doGenerate = process.argv.includes('--generate');
if (!contentFile) {
  console.error('Usage: node gen_missing_audio.js <content_file.js> [--generate]');
  process.exit(2);
}

const mp3Dir = path.join(__dirname, 'audio_mp3');
function sanitize(text) { return text.replace(/[\\/:*?"<>|]/g, '').trim(); }

// --- extract unique vocab ---------------------------------------------------
const sandbox = { TEACHING_CONTENT: {}, AVAILABLE_CONTENT: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, contentFile), 'utf8'), sandbox);
const vocabSet = new Set();
for (const book of Object.values(sandbox.TEACHING_CONTENT)) {
  for (const unit of Object.values(book)) {
    for (const page of Object.values(unit)) {
      for (const item of (page.vocab || [])) {
        const word = (typeof item === 'string') ? item : (item && item.word) || '';
        if (word && word.trim()) vocabSet.add(word.trim());
      }
    }
  }
}
const vocab = Array.from(vocabSet).sort((a, b) => a.localeCompare(b));
console.log(contentFile + ': ' + vocab.length + ' unique vocab items');

// --- Youdao probe -------------------------------------------------------------
function probeYoudao(text) {
  return new Promise((resolve) => {
    const url = 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=1';
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let len = 0;
      res.on('data', (d) => { len += d.length; });
      res.on('end', () => resolve({
        ok: res.statusCode === 200 && /audio/.test(res.headers['content-type'] || '') && len >= 4096,
        status: res.statusCode, bytes: len
      }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'timeout', bytes: 0 }); });
    req.on('error', (e) => resolve({ ok: false, status: 'err:' + e.message, bytes: 0 }));
  });
}

// --- Sound of Text API --------------------------------------------------------
function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.soundoftext.com', path: urlPath, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
      timeout: 30000
    }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(buf) }); }
        catch (_) { resolve({ status: res.statusCode, raw: buf.slice(0, 200) }); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlinkSync(dest); return reject(new Error('HTTP ' + res.statusCode)); }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => { file.close(); try { fs.unlinkSync(dest); } catch (_) {} reject(e); });
  });
}

async function generateOne(text) {
  const create = await api('POST', '/sounds', { engine: 'Google', data: { text, voice: 'en-GB' } });
  if (!create.json || !create.json.success) throw new Error('create failed: ' + JSON.stringify(create));
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const st = await api('GET', '/sounds/' + create.json.id);
    if (st.json && st.json.status === 'Done' && st.json.location) {
      const dest = path.join(mp3Dir, sanitize(text) + '.mp3');
      await download(st.json.location, dest);
      const size = fs.statSync(dest).size;
      if (size < 1000) throw new Error('suspiciously small file: ' + size + 'B');
      return size;
    }
    if (st.json && st.json.status === 'Error') throw new Error('api error: ' + st.json.message);
  }
  throw new Error('poll timeout');
}

// --- main ----------------------------------------------------------------------
(async () => {
  const existing = new Set(fs.readdirSync(mp3Dir));
  const fails = [];
  const CONC = 4;
  let idx = 0;
  async function worker() {
    while (idx < vocab.length) {
      const text = vocab[idx++];
      const youdao = await probeYoudao(text);
      if (!youdao.ok) fails.push({ text, status: youdao.status, bytes: youdao.bytes, hasMp3: existing.has(sanitize(text) + '.mp3') });
      await new Promise(r => setTimeout(r, 150));
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fails.sort((a, b) => a.text.localeCompare(b.text));

  console.log('\nYoudao failures: ' + fails.length);
  fails.forEach(f => console.log('  FAIL(' + f.status + ',' + f.bytes + 'B) ' + JSON.stringify(f.text) +
    (f.hasMp3 ? '  [mp3 exists]' : '  [NEEDS MP3]')));
  const needGen = fails.filter(f => !f.hasMp3).map(f => f.text);
  console.log('need generation: ' + needGen.length);

  if (!doGenerate || !needGen.length) {
    if (needGen.length) console.log('\nRe-run with --generate to create them via soundoftext.com (en-GB).');
    return;
  }

  console.log('\nGenerating via Sound of Text (Google TTS, en-GB) …');
  let okCount = 0, failCount = 0;
  for (let i = 0; i < needGen.length; i++) {
    const text = needGen[i];
    try {
      const size = await generateOne(text);
      okCount++;
      console.log('OK   (' + (i + 1) + '/' + needGen.length + ') "' + sanitize(text) + '.mp3" ' + size + 'B');
    } catch (e) {
      failCount++;
      console.error('FAIL (' + (i + 1) + '/' + needGen.length + ') "' + text + '": ' + e.message);
    }
    await new Promise(r => setTimeout(r, (i + 1) % 5 === 0 ? 4000 : 1200)); // polite batches
  }
  console.log('\nGenerated ' + okCount + ', failed ' + failCount + ' of ' + needGen.length);
  process.exit(failCount === 0 ? 0 : 1);
})();
