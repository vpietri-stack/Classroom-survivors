// Drive the real Record/Stop sentence-gate UI in Chrome. All audio and the
// capture sink are synthetic; no network request or microphone is permitted.
const { chromium } = require('playwright-core');
const path = require('path');
const assert = require('node:assert/strict');
let checks = 0;
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.evaluate(() => {
      window.__samples = []; window.__scores = []; window.__kind = 'graded'; window.__throwCapture = false;
      window.authActiveUser = { id: 'student-test-a', name: 'Test A', book: 'PU2' };
      Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: 'granted' }) } });
      window.queueExerciseEvent = function () {};
      window.SpeechStatus = { isReady: () => true };
      window.SpeechSampleCapture = { maybeCapture: s => { if (window.__throwCapture) throw new Error('research failure'); window.__samples.push(s); } };
      window.Scorer = { scoreForBook: (target, text, book, attempt) => {
        window.__scores.push({ text, book, attempt }); return { pass: false, accuracy: .4, phoneticRatio: .3 };
      } };
      window.Recorder = class {
        static isSupported() { return true; }
        start() { return Promise.resolve(); }
        stop() {
          const n = window.__kind === 'too_short' ? 4000 : 20000;
          const data = new ArrayBuffer(44 + n * 2), v = new DataView(data);
          for (const [off, s] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']]) for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
          v.setUint32(4, data.byteLength - 8, true); v.setUint32(16, 16, true);
          v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true);
          v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); v.setUint32(40, n * 2, true);
          if (window.__kind !== 'too_quiet') for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, 10000, true);
          return Promise.resolve(new Blob([data], { type: 'audio/wav' }));
        }
      };
      window.LocalEngine = { transcribe: async () => ({ text: window.__kind === 'hallucination' ? '[Music]' : 'A real attempt.' }) };
    });
    await page.addScriptTag({ path: path.join(__dirname, 'speech_ui.js') });
    async function record(kind, newGate = true) {
      await page.evaluate(({ kind, newGate }) => {
        window.__kind = kind;
        if (newGate) {
          document.body.innerHTML = '';
          document.body.appendChild(SpeechUI.makeSentenceGate({ target: 'A short sentence.', book: 'PU2' }));
        }
      }, { kind, newGate });
      const btn = page.locator('.speech-rec-btn');
      await btn.click(); await page.waitForFunction(() => document.querySelector('.rec-inline.show'));
      await btn.click(); await page.waitForFunction(() => !document.querySelector('.speech-rec-btn').disabled && !document.querySelector('.rec-inline.show'));
    }
    for (const kind of ['graded', 'too_short', 'too_quiet', 'hallucination']) await record(kind);
    const results = await page.evaluate(() => ({ samples: __samples.map(s => ({ outcome: s.outcome, pass: s.pass, ownerId: s.ownerId, bytes: s.blob.size, rate: s.sampleRate })), scores: __scores }));
    assert.deepEqual(results.samples.map(s => s.outcome), ['graded', 'too_short', 'too_quiet', 'hallucination']); checks++;
    assert.ok(results.samples.every(s => s.ownerId === 'student-test-a' && s.bytes > 44 && s.rate === 16000)); checks++;
    assert.ok(results.samples.slice(1).every(s => s.pass === null)); checks++;
    assert.equal(results.scores.length, 1); checks++;
    await record('graded', false);
    assert.equal(await page.evaluate(() => __scores.at(-1).attempt), 1); checks++;
    await page.evaluate(() => { window.__throwCapture = true; });
    await record('graded');
    assert.equal(await page.evaluate(() => __scores.length), 3); checks++;
    console.log(checks + ' real-browser speech capture checks passed');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
