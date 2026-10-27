'use strict';
// Real model smoke test using synthetic public reference audio, never a child's
// voice or a live microphone. Target text is NOT passed into transcription.
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const url = process.argv[2] || 'http://127.0.0.1:8093/interactive_notes_poc.html';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const external = [], api = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text().slice(0, 160)); });
    await page.route('**/*', route => {
      const requestUrl = route.request().url();
      if (/\/api\//.test(requestUrl)) api.push(requestUrl);
      if (!requestUrl.startsWith(new URL(url).origin) && !requestUrl.startsWith('blob:')) { external.push(requestUrl); return route.abort(); }
      return route.continue();
    });
    await page.goto(url);
    await page.waitForFunction(() => window.InteractiveNotesPOC);
    await page.locator('#engineButton').click();
    console.log('Loading real Whisper tiny.en from local assets…');
    await page.waitForFunction(() => ['ready', 'error'].includes(InteractiveNotesPOC.snapshot().engine), { timeout: 360000 });
    assert.equal(await page.evaluate(() => InteractiveNotesPOC.snapshot().engine), 'ready');
    console.log('Real engine ready');
    const results = [];
    for (let index = 0; index < 12; index++) {
      const result = await page.evaluate(async index => {
        const item = InteractiveNotesData.pairs.flatMap(pair => [pair.left, pair.right])[index];
        const response = await fetch(item.audio);
        if (!response.ok) throw new Error('missing reference');
        const buffer = await response.arrayBuffer();
        const context = new AudioContext();
        const decoded = await context.decodeAudioData(buffer);
        const pcm = LocalEngine._resample(decoded.getChannelData(0), decoded.sampleRate, 16000);
        await context.close();
        const start = performance.now();
        const transcript = await LocalEngine.transcribe(pcm);
        const verdict = InteractiveNotesCore.assess(item, transcript.text, 1, Scorer);
        return { word: item.word, target: item.sentence, heard: transcript.text, seconds: Number(((performance.now() - start) / 1000).toFixed(2)), pass: verdict.pass, kind: verdict.kind };
      }, index);
      results.push(result); console.log(JSON.stringify(result));
    }
    assert.equal(results.length, 12);
    assert.ok(results.filter(x => x.pass).length >= 10, 'reference-audio smoke test passes at least 10 of 12; inspect any misses');
    assert.equal(api.length, 0); assert.equal(external.length, 0); assert.equal(errors.length, 0);
    const output = { model: 'real whisper-tiny.en', input: 'Sound of Text en-GB reference MP3s', targetSuppliedToASR: false, microphoneUsed: false, results, external, api, errors };
    const qa = path.join(os.tmpdir(), 'classroom-interactive-notes-poc'); fs.mkdirSync(qa, { recursive: true });
    fs.writeFileSync(path.join(qa, 'real-model-results.json'), JSON.stringify(output, null, 2));
    console.log('Real model smoke test: ' + results.filter(x => x.pass).length + '/12; no mic, API calls or external requests.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
