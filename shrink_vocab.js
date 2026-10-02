// ============================================================
// shrink_vocab.js — bring newly sliced vocab PNGs down to the house
// weight budget for images/vocab/.
//
//   node shrink_vocab.js <file.png> [...]
//   node shrink_vocab.js --over 100        (shrink every vocab png over 100KB)
//
// The slicer emits 512x512 truecolour (150-420KB). Every shipped asset in
// images/vocab/ is 320x320 and under 100KB, because .vocab-image renders at
// clamp(80px, 25vw, 140px) and all five consumers share that one class.
//
// Ladder, matching the 2026-10-02 bulk pass: 320px @ 24 levels/channel,
// stepping to 288/20, 256/16, 256/12 only while the file is still over budget.
// Posterising collapses the colour count, which is what makes the PNG deflate
// well — the artwork is flat-colour cartoon, so it is visually lossless.
//
// Uses playwright-core + Chrome canvas: there is no ImageMagick on this host
// (the `convert` on PATH is the NTFS filesystem tool, not an image converter).
// ============================================================
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const BUDGET = 100 * 1024;
const LADDER = [[320, 24], [288, 20], [256, 16], [256, 12]];

const argv = process.argv.slice(2);
let targets;
if (argv[0] === '--over') {
  const kb = parseFloat(argv[1] || '100');
  const dir = 'images/vocab';
  targets = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg)$/i.test(f))
    .map(f => path.join(dir, f))
    .filter(f => fs.statSync(f).size > kb * 1024);
} else {
  targets = argv.filter(Boolean);
}
if (!targets.length) { console.log('nothing to shrink'); process.exit(0); }

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  await page.setContent('<body></body>');
  let done = 0, failed = 0, before = 0, after = 0;

  for (const file of targets) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) { console.log('SKIP (missing) ' + file); failed++; continue; }
    const orig = fs.statSync(abs).size;
    const ext = abs.split('.').pop().toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    const b64 = 'data:' + mime + ';base64,' + fs.readFileSync(abs).toString('base64');

    let out = null, used = null;
    for (const [px, levels] of LADDER) {
      const dataUrl = await page.evaluate(async ({ b64, px, levels }) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = b64; });
        const c = document.createElement('canvas');
        c.width = px; c.height = px;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, px, px);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, px, px);
        const d = ctx.getImageData(0, 0, px, px);
        const step = 255 / (levels - 1);
        for (let i = 0; i < d.data.length; i += 4) {
          d.data[i]     = Math.round(Math.round(d.data[i]     / step) * step);
          d.data[i + 1] = Math.round(Math.round(d.data[i + 1] / step) * step);
          d.data[i + 2] = Math.round(Math.round(d.data[i + 2] / step) * step);
        }
        ctx.putImageData(d, 0, 0);
        return c.toDataURL('image/png');
      }, { b64, px, levels });

      const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
      if (buf.length <= BUDGET) { out = buf; used = px + 'px/' + levels + 'lv'; break; }
      out = buf; used = px + 'px/' + levels + 'lv';
    }

    if (out.length > BUDGET) {
      console.log('OVER BUDGET ' + path.basename(file) + '  ' + (out.length / 1024).toFixed(0) + 'KB at ' + used);
      failed++; continue;
    }
    fs.writeFileSync(abs, out);
    before += orig; after += out.length; done++;
    console.log(path.basename(file).padEnd(22) + (orig / 1024).toFixed(0) + 'KB -> ' +
      (out.length / 1024).toFixed(0) + 'KB  (' + used + ')');
  }

  await browser.close();
  console.log('\nshrunk ' + done + ' file(s), ' + (before / 1048576).toFixed(1) + 'MB -> ' +
    (after / 1048576).toFixed(1) + 'MB' + (failed ? ' | ' + failed + ' problem(s)' : ''));
})();
