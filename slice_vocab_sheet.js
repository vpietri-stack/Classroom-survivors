// ============================================================
// slice_vocab_sheet.js — cut a Nano-Banana grid sheet into vocab images.
//
// Usage:
//   node slice_vocab_sheet.js <sheet.(png|jpg)> <cols> <rows> "word1,word2,..."
//
// Words map to cells left-to-right, top-to-bottom. Use "-" to skip a cell.
// Each cell is cropped with a small inset, auto-trimmed to its content
// bounding box (near-white/transparent treated as background), then
// contain-fitted onto a 512x512 white canvas and saved to
// images/vocab/<word lowercase, spaces->hyphens>.png.
// A labeled contact sheet (tmp_slice_review.png) is produced for review —
// verify it BEFORE committing.
// ============================================================
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const [sheetPath, colsArg, rowsArg, wordsArg] = process.argv.slice(2);
if (!sheetPath || !colsArg || !rowsArg || !wordsArg) {
  console.error('Usage: node slice_vocab_sheet.js <sheet.png> <cols> <rows> "word1,word2,..."');
  process.exit(2);
}
const cols = parseInt(colsArg, 10);
const rows = parseInt(rowsArg, 10);
const words = wordsArg.split(',').map(w => w.trim());
if (words.length !== cols * rows) {
  console.error('word count ' + words.length + ' != cells ' + cols * rows + ' (use "-" for empty cells)');
  process.exit(2);
}
const outDir = path.join(__dirname, 'images', 'vocab');
const fileFor = w => w.trim().toLowerCase().replace(/ /g, '-') + '.png';

(async () => {
  const data = fs.readFileSync(path.resolve(sheetPath));
  const ext = sheetPath.split('.').pop().toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/' + ext;
  const b64 = 'data:' + mime + ';base64,' + data.toString('base64');

  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  await page.setContent('<body></body>');

  const results = await page.evaluate(async ({ b64, cols, rows, words }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = b64; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const cw = W / cols, ch = H / rows;
    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const sctx = src.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);

    function isBg(d, i) { // near-white or transparent
      return d[i + 3] < 16 || (d[i] > 238 && d[i + 1] > 238 && d[i + 2] > 238);
    }
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const word = words[r * cols + c];
        if (word === '-') { out.push(null); continue; }
        // cell with 2% inset (avoids neighbours bleeding in)
        const ix = Math.round(c * cw + cw * 0.02), iy = Math.round(r * ch + ch * 0.02);
        const iw = Math.round(cw * 0.96), ih = Math.round(ch * 0.96);
        const d = sctx.getImageData(ix, iy, iw, ih);
        // content bounding box
        let minX = iw, minY = ih, maxX = -1, maxY = -1;
        for (let y = 0; y < ih; y++) {
          for (let x = 0; x < iw; x++) {
            if (!isBg(d.data, (y * iw + x) * 4)) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) { out.push({ word, empty: true }); continue; }
        const bw = maxX - minX + 1, bh = maxY - minY + 1;
        // contain-fit onto 512x512 white canvas with 6% padding
        const dst = document.createElement('canvas');
        dst.width = 512; dst.height = 512;
        const dctx = dst.getContext('2d');
        dctx.fillStyle = '#ffffff';
        dctx.fillRect(0, 0, 512, 512);
        const scale = Math.min(480 / bw, 480 / bh);
        const dw = bw * scale, dh = bh * scale;
        dctx.drawImage(src, ix + minX, iy + minY, bw, bh, (512 - dw) / 2, (512 - dh) / 2, dw, dh);
        out.push({ word, png: dst.toDataURL('image/png') });
      }
    }
    return out;
  }, { b64, cols, rows, words });

  let written = 0;
  const review = [];
  for (const r of results) {
    if (!r) continue;
    if (r.empty) { console.log('EMPTY cell for "' + r.word + '" — skipped'); continue; }
    const dest = path.join(outDir, fileFor(r.word));
    fs.writeFileSync(dest, Buffer.from(r.png.split(',')[1], 'base64'));
    review.push({ word: r.word, png: r.png });
    written++;
    console.log('wrote ' + fileFor(r.word));
  }

  // review contact sheet
  const cells = review.map(r => `<div style="border:1px solid #999;padding:4px;text-align:center;background:#fff">
    <img src="${r.png}" style="width:120px;height:120px;object-fit:contain"><br>
    <b style="font:10px monospace">${r.word}</b></div>`).join('');
  await page.setViewportSize({ width: 1180, height: 200 + Math.ceil(review.length / 6) * 160 });
  await page.setContent(`<body style="margin:0;background:#eee">
    <div id="grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:8px">${cells}</div></body>`);
  await page.locator('#grid').screenshot({ path: path.join(__dirname, 'tmp_slice_review.png') });
  await browser.close();
  console.log('\n' + written + ' images written; review sheet -> tmp_slice_review.png');
})();
