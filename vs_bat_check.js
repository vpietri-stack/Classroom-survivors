// One-off: inspect the sliced bat PNGs for stray/disconnected clusters (foreign
// wingtips). Reports, per file, the connected components of opaque pixels with
// their bounding boxes + area so we can see if a small cluster sits in a corner
// away from the main body.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILES = ['sprites/vs/enemy_bat_up.png', 'sprites/vs/enemy_bat_down.png', 'sprites/vs/enemy_bat_hit.png'];
(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    for (const file of FILES) {
        const src = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
        const r = await page.evaluate(async ({ src }) => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
            const W = img.width, H = img.height;
            const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const d = ctx.getImageData(0, 0, W, H).data;
            const comp = new Int32Array(W * H).fill(-1);
            const comps = [];
            for (let p0 = 0; p0 < W * H; p0++) {
                if (comp[p0] !== -1 || d[p0 * 4 + 3] < 12) continue;
                const idx = comps.length; const q = [p0]; comp[p0] = idx;
                let minX = W, minY = H, maxX = 0, maxY = 0, area = 0, h = 0;
                while (h < q.length) {
                    const p = q[h++]; const x = p % W, y = (p / W) | 0; area++;
                    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
                    const nb = [p - 1, p + 1, p - W, p + W];
                    for (const n of nb) { if (n >= 0 && n < W * H && comp[n] === -1 && d[n * 4 + 3] >= 12) { comp[n] = idx; q.push(n); } }
                }
                comps.push({ minX, minY, maxX, maxY, area });
            }
            comps.sort((a, b) => b.area - a.area);
            return { W, H, total: comps.length, comps: comps.slice(0, 6) };
        }, { src });
        console.log(file, JSON.stringify(r));
    }
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
