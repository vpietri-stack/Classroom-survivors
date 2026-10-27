'use strict';
// Actual Recorder -> WAV gate -> actual Whisper -> scorer -> UI integration.
// Chromium's fake mic reads an explicitly supplied synthetic WAV, never a
// physical microphone. Generate a teacher/reference WAV first, not child audio.
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const url = process.argv[2] || 'http://127.0.0.1:8093/interactive_notes_poc.html';
const wav = process.argv[3];
if (!wav || !fs.existsSync(wav)) throw new Error('Pass an explicit synthetic WAV path as the second argument.');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=' + path.resolve(wav) + '%noloop']
  });
  try {
    const context = await browser.newContext({ permissions: ['microphone'] });
    const page = await context.newPage();
    await page.route('**/*', route => route.request().url().startsWith(new URL(url).origin) || route.request().url().startsWith('blob:') ? route.continue() : route.abort());
    await page.goto(url); await page.waitForFunction(() => window.InteractiveNotesPOC);
    await page.locator('#engineButton').click();
    await page.waitForFunction(() => ['ready', 'error'].includes(InteractiveNotesPOC.snapshot().engine), { timeout: 360000 });
    assert.equal(await page.evaluate(() => InteractiveNotesPOC.snapshot().engine), 'ready');
    await page.locator('#listenButton').click(); await page.waitForFunction(() => !InteractiveNotesPOC.snapshot().playing);
    await page.locator('#recordButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'recording');
    await page.waitForTimeout(3800);
    await page.locator('#recordButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'idle', { timeout: 120000 });
    const result = await page.evaluate(() => ({ state: InteractiveNotesPOC.snapshot(), heard: document.getElementById('heardText').textContent, feedback: document.getElementById('feedback').textContent }));
    console.log(JSON.stringify(result, null, 2));
    assert.equal(result.state.progress['pu3-u9-p111-boring'].passed, true, 'real recorder and model recognise synthetic fake-mic sentence');
    const qa = path.join(os.tmpdir(), 'classroom-interactive-notes-poc'); fs.mkdirSync(qa, { recursive: true });
    fs.writeFileSync(path.join(qa, 'real-microphone-pipeline.json'), JSON.stringify({ input: 'Windows Hazel synthetic English WAV through Chromium fake microphone', physicalMicrophoneUsed: false, result }, null, 2));
    await page.screenshot({ path: path.join(qa, 'real-speech-pass.png'), fullPage: true });
    console.log('PASS actual Recorder -> real Whisper -> guarded scorer -> saved UI progress');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
