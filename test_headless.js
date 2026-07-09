// Headless test harness for Classroom Survivors
// Run: node test_headless.js
const { chromium } = require('playwright-core');
const path = require('path');

const PROJECT_DIR = __dirname;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///' + path.join(PROJECT_DIR, 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const consoleMsgs = [];
  const errors = [];
  page.on('console', (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) =>
    errors.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText}`)
  );

  console.log('Loading:', URL);
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  // give the game a moment to boot / run a few frames
  await page.waitForTimeout(3000);

  // Basic DOM sanity checks
  const title = await page.title();
  const bodyTextLen = (await page.textContent('body'))?.length || 0;
  const canvasCount = await page.locator('canvas').count();
  const hasStartBtn = await page.locator('button').count();

  await page.screenshot({ path: path.join(PROJECT_DIR, 'test_screenshot.png') });

  console.log('--- RESULTS ---');
  console.log('title:', title);
  console.log('canvas elements:', canvasCount);
  console.log('buttons:', hasStartBtn);
  console.log('body text length:', bodyTextLen);
  console.log('console messages:', consoleMsgs.length);
  consoleMsgs.slice(0, 30).forEach((m) => console.log('  ', m));
  console.log('errors:', errors.length);
  errors.forEach((e) => console.log('  ', e));

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('HARNESS FAILED:', e);
  process.exit(1);
});
