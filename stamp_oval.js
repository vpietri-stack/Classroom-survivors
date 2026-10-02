// ============================================================
// stamp_oval.js — put a coloured oval over a band of an image.
//
//   node stamp_oval.js <src.png> <outPrefix> <n> <cy1> <cy2> ... <cyN>
//                      [--rx 0.30] [--ry 0.10] [--colours red,blue,green]
//
// Why this exists: the image generator cannot hold a "storey 1 = 1, storey
// 2 = 2, storey 3 = 3" sequence across a multi-storey drawing — asked for
// three numbered floors it stamps the SAME digit on every floor, or circles
// the roof. So we generate ONE correct numbered building and draw the oval
// ourselves. cy values are fractions of the content height, top to bottom.
//
// Output: <outPrefix>-1.png, -2.png ... on a 512x512 white canvas, trimmed
// to the source content box first so the fractions mean the same thing here
// as they do in slice_vocab_sheet.js.
// ============================================================
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const argv = process.argv.slice(2);
const getOpt = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = argv[i + 1]; argv.splice(i, 2); return v;
};
const [srcPath, outPrefix, nArg, ...cys] = argv;
if (!srcPath || !outPrefix || !nArg || !cys.length) {
  console.error('Usage: node stamp_oval.js <src.png> <outPrefix> <n> <cy1> <cy2> ... [--rx .30] [--ry .10] [--colours red,blue,green]');
  process.exit(2);
}
const RX = parseFloat(getOpt('rx', '0.30'));
const RY = parseFloat(getOpt('ry', '0.10'));
const COLOURS = (getOpt('colours', 'red,blue,green') + '').split(',');
const N = parseInt(nArg, 10);
const centres = cys.map(Number).slice(0, N);
if (centres.some(isNaN)) { console.error('cy values must be numbers'); process.exit(2); }

(async () => {
  const b64 = 'data:image/png;base64,' + fs.readFileSync(path.resolve(srcPath)).toString('base64');
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
  await page.setContent('<body></body>');

  const out = await page.evaluate(async ({ b64, centres, RX, RY, COLOURS }) => {
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = b64; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
    const g0 = c0.getContext('2d', { willReadFrequently: true });
    g0.drawImage(img, 0, 0);
    const d = g0.getImageData(0, 0, W, H);
    const px = d.data;

    // The generator stamps a "Qoder AI 生成" mark bottom-right. It is non-white,
    // so it stretches the content box and gets baked into every crop. A colour
    // test on the glyph pixels is unreliable (they are not neutral grey), so we
    // hard-clear the corner rectangle instead. Safe here because the building
    // is centred and never reaches x>0.78 / y>0.90 at the same time.
    {
      const kx0 = Math.floor(W * 0.78), ky0 = Math.floor(H * 0.90);
      g0.fillStyle = '#ffffff';
      g0.fillRect(kx0, ky0, W - kx0, H - ky0);
    }
    const dd = g0.getImageData(0, 0, W, H).data;

    // content bounding box, same near-white rule the slicer uses
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (dd[i] < 238 || dd[i + 1] < 238 || dd[i + 2] < 238) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

    const shots = [];
    centres.forEach((cy, idx) => {
      const out = document.createElement('canvas'); out.width = 512; out.height = 512;
      const o = out.getContext('2d');
      o.fillStyle = '#ffffff'; o.fillRect(0, 0, 512, 512);
      const sc = Math.min(512 / cw, 512 / ch) * 0.88;
      const w = cw * sc, h = ch * sc, px = (512 - w) / 2, py = (512 - h) / 2;
      o.imageSmoothingQuality = 'high';
      o.drawImage(img, x0, y0, cw, ch, px, py, w, h);
      o.strokeStyle = COLOURS[idx % COLOURS.length];
      o.lineWidth = 14; o.lineCap = 'round';
      o.beginPath();
      o.ellipse(px + w / 2, py + h * cy, w * RX, h * RY, 0, 0, Math.PI * 2);
      o.stroke();
      shots.push(out.toDataURL('image/png'));
    });

    const cs = document.createElement('canvas');
    cs.width = shots.length * 200; cs.height = 210;
    const cc = cs.getContext('2d');
    cc.fillStyle = '#f2f2f2'; cc.fillRect(0, 0, cs.width, cs.height);
    for (let i = 0; i < shots.length; i++) {
      const im = new Image();
      await new Promise(r => { im.onload = r; im.src = shots[i]; });
      cc.drawImage(im, i * 200 + 8, 8, 184, 184);
      cc.fillStyle = '#c00'; cc.font = 'bold 20px sans-serif';
      cc.fillText(String(i + 1), i * 200 + 10, 206);
    }
    return { shots, contact: cs.toDataURL('image/png') };
  }, { b64, centres, RX, RY, COLOURS });

  out.shots.forEach((url, i) => {
    const p = path.join('images', 'vocab', outPrefix + '-' + (i + 1) + '.png');
    fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote ' + p + '  (cy ' + centres[i] + ', ' + COLOURS[i % COLOURS.length] + ')');
  });
  fs.writeFileSync('tmp_oval_review.png', Buffer.from(out.contact.split(',')[1], 'base64'));
  await browser.close();
  console.log('\nreview -> tmp_oval_review.png');
})();
