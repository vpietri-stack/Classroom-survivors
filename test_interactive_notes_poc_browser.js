'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const url = process.argv[2] || 'http://127.0.0.1:8093/interactive_notes_poc.html';
const qa = path.join(os.tmpdir(), 'classroom-interactive-notes-poc');
fs.mkdirSync(qa, { recursive: true });
let checks = 0;
const ok = (condition, label) => { assert.ok(condition, label); checks++; console.log('PASS ' + label); };
const snapshot = page => page.evaluate(() => window.InteractiveNotesPOC.snapshot());
async function harness(page) {
  await page.evaluate(() => {
    window.testHarness = { text: 'The film is boring.', mode: 'ok', mic: 'ok', starts: 0, stopped: 0, loads: 0, resets: 0, played: [], actualPlay: HTMLMediaElement.prototype.play };
    HTMLMediaElement.prototype.play = function () {
      window.testHarness.played.push(this.src);
      if (testHarness.playFailure) {
        setTimeout(() => this.dispatchEvent(new Event('error')), 10);
        return Promise.reject(new Error('missing reference'));
      }
      setTimeout(() => { if (!this.paused || this.src) this.dispatchEvent(new Event('ended')); }, 80);
      return Promise.resolve();
    };
    function wav() {
      const duration = testHarness.mode === 'short' ? .4 : 2;
      const n = Math.floor(16000 * duration), b = new ArrayBuffer(44 + n * 2), dv = new DataView(b);
      dv.setUint32(24, 16000, true);
      for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, testHarness.mode === 'quiet' ? 0 : Math.sin(i / 5) * 7000, true);
      return new Blob([b], { type: 'audio/wav' });
    }
    window.Recorder = class {
      static isSupported() { return true; }
      constructor() { this.level = .3; this._chunks = []; this.recording = false; }
      async start() {
        testHarness.starts++;
        if (testHarness.mic === 'denied') throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
        if (testHarness.mic === 'pending') await new Promise(resolve => { testHarness.resolveMic = resolve; });
        this.recording = true;
        this.stream = { getTracks: () => [{ stop() { testHarness.stopped++; } }] };
      }
      async stop() { this.recording = false; return wav(); }
    };
    window.LocalEngine = {
      async load() { testHarness.loads++; if (testHarness.failLoad) throw new Error('offline'); },
      resetLoad() { testHarness.resets++; },
      async transcribe() { if (testHarness.delay) await new Promise(resolve => { testHarness.resolveTranscribe = resolve; }); return { text: testHarness.text }; }
    };
  });
}
async function listen(page) { await page.locator('#listenButton').click(); await page.waitForFunction(() => !InteractiveNotesPOC.snapshot().playing); }
async function say(page, text, mode = 'ok') {
  await page.evaluate(({ text, mode }) => { testHarness.text = text; testHarness.mode = mode; }, { text, mode });
  await page.locator('#recordButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'recording');
  await page.locator('#recordButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'idle');
}
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const page = await context.newPage(), errors = [], external = [], api = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const request = route.request();
      if (/\/api\//.test(request.url())) api.push(request.url());
      if (!request.url().startsWith(new URL(url).origin)) { external.push(request.url()); return route.abort(); }
      return route.continue();
    });
    await page.goto(url); await page.waitForFunction(() => window.InteractiveNotesPOC);
    ok((await snapshot(page)).engine === 'idle', 'no eager model download');
    ok(await page.locator('#recordButton').isDisabled(), 'listen before recording');
    ok(await page.locator('.pair-tab').count() === 6, 'all six pairs rendered');
    await page.screenshot({ path: path.join(qa, 'desktop.png'), fullPage: true });
    await harness(page);
    await page.locator('.example-card').first().click(); await page.waitForFunction(() => !InteractiveNotesPOC.snapshot().playing);
    ok((await snapshot(page)).progress['pu3-u9-p111-boring'].listened, 'click illustration plays reference and marks listened on end');
    await page.evaluate(() => {
      testHarness.playFailure = true; testHarness.synthCount = 0;
      speechSynthesis.speak = utterance => { testHarness.synthCount++; setTimeout(() => utterance.dispatchEvent(new Event('end')), 30); };
      speechSynthesis.cancel = () => {};
    });
    await listen(page);
    ok(await page.evaluate(() => testHarness.synthCount === 1), 'failed MP3 uses device speech exactly once despite error plus rejected play');
    await page.evaluate(() => { testHarness.playFailure = false; });
    await page.locator('#recordButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().engine === 'ready');
    ok(await page.evaluate(() => testHarness.starts === 0), 'loading model never starts microphone automatically');
    await say(page, 'The film is bored.');
    ok(!(await snapshot(page)).progress['pu3-u9-p111-boring'].passed, 'wrong adjective ending not credited');
    await say(page, 'The film is boring.', 'quiet');
    ok((await snapshot(page)).progress['pu3-u9-p111-boring'].attempts === 1, 'silence is coaching, not scored');
    await say(page, 'The film is boring.', 'short');
    ok((await snapshot(page)).progress['pu3-u9-p111-boring'].attempts === 1, 'short clip is coaching, not scored');
    await say(page, 'The film is boring.');
    ok((await snapshot(page)).progress['pu3-u9-p111-boring'].passed, 'valid recognised sentence credited');
    ok(!(await page.locator('#replayButton').isDisabled()), 'student can replay own recording');
    await page.reload(); await page.waitForFunction(() => window.InteractiveNotesPOC); await harness(page);
    ok((await snapshot(page)).progress['pu3-u9-p111-boring'].passed, 'progress survives reload');
    await page.locator('#teacherTools').evaluate(el => { el.open = true; });
    await page.selectOption('#profile', 'b');
    ok(Object.keys((await snapshot(page)).progress).length === 0, 'second trial profile has separate progress');
    await page.selectOption('#profile', 'a');
    ok((await snapshot(page)).progress['pu3-u9-p111-boring'].passed, 'first trial profile restored');
    await page.evaluate(() => { testHarness.failLoad = true; });
    await page.locator('#engineButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().engine === 'error');
    ok(!(await page.locator('#listenButton').isDisabled()), 'model load failure preserves listening');
    await page.evaluate(() => { testHarness.failLoad = false; });
    await page.locator('#engineButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().engine === 'ready');
    ok(await page.evaluate(() => testHarness.resets === 1), 'model retry resets failed loader');
    await page.evaluate(() => { testHarness.mic = 'denied'; });
    await page.locator('#recordButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'idle');
    ok((await page.locator('#feedback').textContent()).includes('允许麦克风'), 'permission denial has recoverable help');
    await page.evaluate(() => { testHarness.mic = 'pending'; });
    await page.locator('#recordButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'permission');
    await page.locator('#recordButton').evaluate(button => button.click());
    ok(await page.evaluate(() => testHarness.starts === 2), 'double tap cannot start a second permission request');
    await page.locator('.pair-tab').nth(1).click();
    await page.evaluate(() => { testHarness.resolveMic(); testHarness.mic = 'ok'; });
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => testHarness.stopped > 0) && (await snapshot(page)).phase === 'idle', 'navigation closes a late microphone permission stream');
    await listen(page);
    await page.evaluate(() => { testHarness.delay = true; testHarness.text = 'The robot is interesting.'; });
    await page.locator('#recordButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'recording');
    await page.locator('#recordButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'transcribing');
    await page.locator('.pair-tab').nth(2).click();
    await page.evaluate(() => { testHarness.resolveTranscribe(); testHarness.delay = false; });
    await page.waitForFunction(() => !InteractiveNotesPOC.snapshot().inference);
    ok(!(await snapshot(page)).progress['pu3-u9-p111-interesting']?.passed, 'stale inference cannot credit another example');
    await page.locator('#teacherTools').evaluate(el => { el.open = true; });
    await page.locator('#teacherFile').setInputFiles(path.join(__dirname, 'interactive_notes_assets/audio/frightening.mp3'));
    await page.waitForFunction(() => document.getElementById('teacherStatus').textContent.includes('已保存'));
    ok((await page.locator('#audioSource').textContent()).includes('老师示范'), 'teacher MP3 replaces selected reference');
    await page.reload(); await page.waitForFunction(() => window.InteractiveNotesPOC); await harness(page);
    await page.locator('.pair-tab').nth(2).click();
    await page.waitForFunction(() => document.getElementById('audioSource').textContent.includes('老师示范'));
    ok(true, 'teacher demo persists in IndexedDB after reload');
    await page.locator('#teacherTools').evaluate(el => { el.open = true; });
    await page.locator('#teacherClear').click(); await page.waitForFunction(() => document.getElementById('teacherStatus').textContent.includes('恢复'));
    ok(!(await page.locator('#audioSource').textContent()).includes('老师示范'), 'restore original reference');
    await page.reload(); await page.waitForFunction(() => window.InteractiveNotesPOC); await harness(page);
    await page.locator('#engineButton').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().engine === 'ready');
    for (let pair = 0; pair < 6; pair++) {
      await page.locator('.pair-tab').nth(pair).click();
      for (let side = 0; side < 2; side++) {
        await page.locator('.example-card').nth(side).click();
        await page.waitForFunction(() => !InteractiveNotesPOC.snapshot().playing);
        const target = await page.locator('#target').textContent();
        await say(page, target);
      }
      await page.screenshot({ path: path.join(qa, 'pair-' + (pair + 1) + '.png'), fullPage: true });
    }
    ok(Object.values((await snapshot(page)).progress).filter(x => x.passed).length === 12, 'complete twelve-sentence session earns twelve real UI passes');
    await page.locator('#teacherTools').evaluate(el => { el.open = true; });
    const attemptsBeforeDemo = (await snapshot(page)).progress['pu3-u9-p111-surprised'].attempts;
    await page.locator('#teacherRecord').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'recording');
    await page.locator('#teacherRecord').click(); await page.waitForFunction(() => InteractiveNotesPOC.snapshot().phase === 'idle');
    ok((await snapshot(page)).progress['pu3-u9-p111-surprised'].attempts === attemptsBeforeDemo, 'teacher demonstration recording never counts as a learner attempt');
    await page.locator('#teacherClear').click(); await page.waitForFunction(() => document.getElementById('teacherStatus').textContent.includes('恢复'));
    for (const viewport of [{ width: 768, height: 1024 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), viewport.width + 'px tablet/landscape has no horizontal overflow');
    }
    await page.setViewportSize({ width: 320, height: 740 });
    await page.locator('#teacherTools').evaluate(el => { el.open = false; });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px phone has no horizontal overflow');
    await page.screenshot({ path: path.join(qa, 'phone-320.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.example-card').nth(1).click();
    await page.waitForFunction(() => !InteractiveNotesPOC.snapshot().playing);
    await page.screenshot({ path: path.join(qa, 'phone-practice.png'), fullPage: true });
    ok(external.length === 0 && api.length === 0, 'POC interactions make no external or app API requests');
    ok(errors.length === 0, 'no browser runtime errors: ' + errors.join(', '));
    console.log(checks + ' browser checks passed; screenshots: ' + qa);
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
