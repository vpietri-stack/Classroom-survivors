// Creates reference MP3s from public lesson text only. Never sends mic audio.
// API contract: https://soundoftext.com/docs ; also used by gen_missing_audio.js.
const fs = require('node:fs');
const path = require('node:path');
const data = require('../interactive_notes_data.js');
const dir = path.join(__dirname, '..', 'interactive_notes_assets', 'audio');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function json(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  for (const item of data.pairs.flatMap(p => [p.left, p.right])) {
    const destination = path.join(dir, item.word + '.mp3');
    if (fs.existsSync(destination) && fs.statSync(destination).size > 1000) continue;
    const result = await json('https://api.soundoftext.com/sounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ engine: 'Google', data: { voice: 'en-GB', text: item.sentence } }) });
    if (!result.success || !result.id) throw new Error('Sound of Text did not accept ' + item.word);
    let done = false;
    for (let i = 0; i < 15; i++) {
      await wait(1200);
      const status = await json('https://api.soundoftext.com/sounds/' + result.id);
      if (status.status === 'Error') throw new Error(status.message);
      if (status.status === 'Done' && status.location) {
        const r = await fetch(status.location, { signal: AbortSignal.timeout(20000) });
        if (!r.ok) throw new Error('MP3 HTTP ' + r.status);
        const bytes = Buffer.from(await r.arrayBuffer());
        const mp3Signature = bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224);
        if (bytes.length < 1000 || !mp3Signature) throw new Error('Invalid audio response: ' + r.headers.get('content-type') + ', ' + bytes.length + ' bytes');
        fs.writeFileSync(destination, bytes); console.log(item.word + ': ' + bytes.length + ' bytes'); done = true; break;
      }
    }
    if (!done) throw new Error('MP3 generation timeout for ' + item.word);
    await wait(1200);
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
