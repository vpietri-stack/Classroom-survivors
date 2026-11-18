'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const root = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function createStaticServer() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(root, rel);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
      res.end(data);
    });
  });
}

function apiFulfill(route, student) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type,x-app-key,x-auth-token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
  if (route.request().method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers });
  }
  const url = new URL(route.request().url());
  if (url.pathname === '/api/login') {
    return route.fulfill({ status: 200, headers, json: student });
  }
  return route.fulfill({
    status: 200,
    headers,
    json: { enabled: false, addedEventIds: [], duplicateEventIds: [], events: [] }
  });
}

function installAudioHook(pageOrContext) {
  return pageOrContext.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args);
      window.__lastAudio = audio;
      return audio;
    };
  });
}

async function waitReaderReady(frameOrPage) {
  await frameOrPage.waitForFunction(() => Boolean(
    window.FriendlyFarmLoader && window.InteractiveNotesData
    && window.InteractiveNotesPOC && window.NotesSpeech
    && document.querySelector('.page-image')?.naturalWidth > 0
  ));
}

async function assertImageLoaded(locator, message) {
  await locator.waitFor({ state: 'visible' });
  const loaded = await locator.evaluate(img => (
    img.complete ? img.naturalWidth > 0 : new Promise(resolve => {
      img.addEventListener('load', () => resolve(img.naturalWidth > 0), { once: true });
      img.addEventListener('error', () => resolve(false), { once: true });
    })
  ));
  assert.ok(loaded, message);
}

async function verifyPlaybackAndSpeech(frameOrPage, clipId) {
  const expected = await frameOrPage.evaluate(id => {
    const c = window.InteractiveNotesData.clips[id];
    return { text: c.text, translation: c.translation, count: document.querySelectorAll('.hotspot').length, clipCount: Object.keys(window.InteractiveNotesData.clips).length };
  }, clipId);
  assert.equal(expected.count, expected.clipCount, 'renders one hotspot per bubble clip');

  await frameOrPage.locator(`.hotspot[data-clip="${clipId}"]`).first().click();
  await frameOrPage.waitForFunction(id => (
    window.InteractiveNotesPOC.snapshot().currentClip === id
    && window.__lastAudio && window.__lastAudio.currentTime > 0.02
    && !window.__lastAudio.paused
  ), clipId, { timeout: 10000 });

  const nowText = await frameOrPage.locator('#nowPlaying').textContent();
  const statusText = await frameOrPage.locator('#playerStatus').textContent();
  assert.ok(nowText && nowText.includes(expected.text), `#nowPlaying shows bubble English text (${nowText})`);
  assert.ok(statusText && statusText.includes(expected.translation), `#playerStatus shows bubble Chinese translation (${statusText})`);

  assert.equal(await frameOrPage.locator('#replay').isEnabled(), true);
  assert.equal(await frameOrPage.locator('#stop').isEnabled(), true);
  assert.equal(await frameOrPage.locator('.notes-speech button').first().isEnabled(), true, 'speech practice button enabled');

  await frameOrPage.locator('#speed').selectOption('0.8');
  assert.equal(await frameOrPage.evaluate(() => window.__lastAudio.playbackRate), 0.8);
  await frameOrPage.locator('#replay').click();
  await frameOrPage.waitForFunction(() => window.__lastAudio && window.__lastAudio.currentTime > 0.02, null, { timeout: 10000 });
  await frameOrPage.locator('#stop').click();
  await frameOrPage.waitForFunction(() => !window.__lastAudio || window.__lastAudio.paused);
}

(async () => {
  const server = createStaticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  try {
    // 1. Library-only + review mode flow inside index.html on PU1 Unit 1 p.8 and PU3 Unit 0 p.5
    {
      const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, hasTouch: true });
      const page = await context.newPage();
      await installAudioHook(context);
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      const student = {
        id: 'ff-test-student',
        fullName: 'Friendly Farm Student',
        role: 'student',
        avatar: '\u{1F642}',
        book: 'PU1',
        unit: '1',
        page: '8'
      };

      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (!url.href.startsWith(base) && url.pathname.startsWith('/api/')) return apiFulfill(route, student);
        if (url.href.startsWith(base)) {
          if (/\/(speech_assets|models|lib\/wasm)\//.test(url.pathname)) return route.abort();
          return route.continue();
        }
        return route.abort();
      });

      await page.goto(base + 'index.html', { waitUntil: 'domcontentloaded' });
      const loginOverlay = page.locator('#loginOverlay');
      await loginOverlay.waitFor();
      await page.locator('#login-username').fill('ff-student');
      await page.locator('#login-password').fill('ff-student');
      await loginOverlay.getByRole('button', { name: '登录', exact: true }).click();
      await page.getByText('Hello, Friendly Farm Student!').waitFor({ timeout: 15000 });

      // libraryOnly note at PU1 U1 p.8 must NOT auto-open or block Study
      await page.waitForFunction(() => Boolean(window.PreviewNotes));
      assert.equal(await page.locator('#preview-notes-overlay').isVisible(), false, 'libraryOnly note does not auto-open on login');
      assert.equal(await page.evaluate(() => PreviewNotes.blocksAdvance()), false, 'libraryOnly note never blocks Study advancement');

      // Open library via button; lands in PU1 Unit 1 showing pu1-u1-p8 in review-only mode
      await page.locator('#preview-notes-button').click();
      const overlay = page.locator('#preview-notes-overlay');
      await overlay.waitFor({ state: 'visible' });
      const thumb = overlay.locator('img[src*="images/notes_thumbs/pu1-u1-p8-pb-p8.webp"]');
      await assertImageLoaded(thumb, 'pu1-u1-p8 thumbnail loads');

      const reviewBtn = overlay.getByRole('button', { name: '点读查看' }).first();
      await reviewBtn.waitFor({ state: 'visible' });
      assert.equal(await overlay.getByRole('button', { name: '开始学习' }).count(), 0, 'libraryOnly card has no mandatory study launch button');

      await reviewBtn.click();
      const iframeEl = overlay.locator('iframe[src*="friendly_farm_notes.html?id=pu1-u1-p8"]');
      await iframeEl.waitFor({ state: 'visible' });
      const src = await iframeEl.getAttribute('src');
      assert.ok(src.includes('mode=review'), 'opens comic reader in review mode');

      const frame = await (await iframeEl.elementHandle()).contentFrame();
      await waitReaderReady(frame);
      assert.equal(await frame.locator('#reader-study-start').textContent(), '返回主界面', 'review footer closes reader instead of starting Study');

      await verifyPlaybackAndSpeech(frame, 'b01');

      await frame.locator('#reader-study-start').click();
      await overlay.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => Boolean(window.PreviewNotes && !window.STUDY_STATE?.active)), true, 'closing review reader does not start Study');

      // Reopen library, switch to All Books -> Power Up 3 -> Unit 0 (Diversicus) -> pu3-u0-p5
      await page.locator('#preview-notes-button').click();
      await overlay.waitFor({ state: 'visible' });
      await overlay.getByRole('button', { name: /全部教材/ }).click();
      await overlay.getByRole('button', { name: /Power Up 3/ }).click();
      await overlay.getByRole('button', { name: /Unit 0/ }).click();
      const pu3Thumb = overlay.locator('img[src*="images/notes_thumbs/pu3-u0-p5-pb-p5.webp"]');
      await assertImageLoaded(pu3Thumb, 'pu3-u0-p5 thumbnail loads');
      await overlay.getByRole('button', { name: '点读查看' }).first().click();

      const pu3FrameEl = overlay.locator('iframe[src*="friendly_farm_notes.html?id=pu3-u0-p5"]');
      await pu3FrameEl.waitFor({ state: 'visible' });
      const pu3Frame = await (await pu3FrameEl.elementHandle()).contentFrame();
      await waitReaderReady(pu3Frame);
      await verifyPlaybackAndSpeech(pu3Frame, 'b01');
      await pu3Frame.locator('#reader-study-start').click();
      await overlay.waitFor({ state: 'hidden' });

      assert.deepEqual(errors, [], 'no pageerrors during index/library flow');
      await context.close();
      console.log('PASS library-only login non-blocking, PU1 U1 p8 & PU3 U0 p5 review-mode audio + speech UI');
    }

    // 2. Offline AssetCache persistence (friendly-farm-v1/) + invalid ID handling
    {
      const context = await browser.newContext({ viewport: { width: 1100, height: 850 }, hasTouch: true });
      const page = await context.newPage();
      await installAudioHook(context);
      const errors = [];
      let phase = 'cold';
      const mediaReqs = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.route('**/*', async route => {
        const reqUrl = route.request().url();
        const isMirror = reqUrl.startsWith('https://gh-proxy.com/');
        if (!isMirror && !reqUrl.startsWith(base)) return route.abort();
        const parsed = new URL(reqUrl);
        const pathname = isMirror ? parsed.pathname.split('/main/')[1] : parsed.pathname.replace(/^\/+/, '');
        if (!pathname) return route.abort();
        const file = path.resolve(root, decodeURIComponent(pathname));
        if (!file.startsWith(root + path.sep)) return route.abort();

        if (/\.(bin|webp|mp3)$/.test(file)) {
          mediaReqs.push({ phase, isMirror, pathname });
          if (phase === 'warm') return route.abort();
          if (isMirror) {
            await new Promise(r => setTimeout(r, 1500));
            try { return await route.abort(); } catch { return; }
          }
        }
        if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
        const ext = path.extname(file).toLowerCase();
        try {
          await route.fulfill({
            status: 200,
            contentType: MIME[ext] || 'application/octet-stream',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: fs.readFileSync(file)
          });
        } catch {}
      });

      await page.goto(base + 'friendly_farm_notes.html?id=pu2-u7-p84');
      await waitReaderReady(page);
      const lastClip = await page.evaluate(() => {
        const keys = Object.keys(window.InteractiveNotesData.clips);
        return keys[keys.length - 1];
      });
      await verifyPlaybackAndSpeech(page, 'b01');
      await page.locator(`.hotspot[data-clip="${lastClip}"]`).first().click();
      await page.waitForFunction(id => window.InteractiveNotesPOC.snapshot().currentClip === id && window.__lastAudio?.currentTime > 0.02, lastClip, { timeout: 10000 });
      await page.locator('#stop').click();

      await page.waitForFunction(() => new Promise(resolve => {
        const req = indexedDB.open('asset-cache', 1);
        req.onsuccess = () => {
          const db = req.result;
          const r = db.transaction('files', 'readonly').objectStore('files').getAllKeys();
          r.onsuccess = () => {
            const matches = r.result.filter(k => k.startsWith('friendly-farm-v1/friendly_farm_assets/pu2-u7-p84/'));
            db.close();
            resolve(matches.length === 2);
          };
        };
      }), null, { timeout: 10000 });

      phase = 'warm';
      mediaReqs.length = 0;
      await page.reload();
      await waitReaderReady(page);
      await verifyPlaybackAndSpeech(page, 'b01');
      assert.equal(mediaReqs.length, 0, 'warm reload serves page.webp & audio-1.bin offline from AssetCache');

      await page.goto(base + 'friendly_farm_notes.html?id=bad');
      await page.locator('#friendly-farm-error').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.hotspot').count(), 0, 'invalid ?id=bad renders notice with zero hotspots');
      assert.deepEqual(errors, [], 'no pageerrors during AssetCache or invalid-id flows');
      await context.close();
      console.log('PASS AssetCache offline persistence (friendly-farm-v1/) and invalid ?id=bad handling');
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
