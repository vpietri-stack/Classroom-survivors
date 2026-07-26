// Tool: strip baked-in checkerboard backgrounds from AI-generated sprite
// sheets and save true-alpha PNGs. Uses headless Chrome canvas.
// v2: robust predicate flood fill (low-saturation + bright) instead of exact
// tone matching — kills noisy/off-tone checker squares. Bold dark character
// outlines stop the flood, protecting interior grays/whites (eyes, buckets).
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const CACHE = 'C:/Users/vpiet/AppData/Roaming/Qoder/SharedClientCache/cache/images/task-f36/';
const JOBS = [
    { in: CACHE + 'dropout-9e8b6c8f.png', out: 'sprites/td/anim/dropout.png', mode: 'light' },
    { in: CACHE + 'backpack-39c9bb25.png', out: 'sprites/td/anim/backpack.png', mode: 'light' },
    { in: CACHE + 'bucket-e370896b.png', out: 'sprites/td/anim/nerd.png', mode: 'light' },
    { in: CACHE + 'Gemini_Generated_Image_2ltrox2ltrox2ltr-cb075e56.png', out: 'sprites/td/anim/pencil.png', mode: 'light' },
    // Old static sheets: generated on BLACK backgrounds
    { in: 'sprites/td/towers.png', out: 'sprites/td/towers.png', mode: 'dark' },
    { in: 'sprites/td/enemies.png', out: 'sprites/td/enemies.png', mode: 'dark' }
];

(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    for (const job of JOBS) {
        const buf = fs.readFileSync(job.in);
        const dataUrl = 'data:image/png;base64,' + buf.toString('base64');

        const result = await page.evaluate(async ({ src, mode }) => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
            const W = img.width, H = img.height;
            const cv = document.createElement('canvas');
            cv.width = W; cv.height = H;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const id = ctx.getImageData(0, 0, W, H);
            const d = id.data;

            // Background predicate:
            // 'light' = checkerboard (near-gray, bright) — Nano Banana sheets
            // 'dark'  = solid black bg — old static ImageGen sheets (character
            //           outlines are ~#333 = 51, so cutoff below that)
            const isBg = mode === 'dark'
                ? (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]); return mx <= 40; }
                : (i) => {
                    const r = d[i], g = d[i + 1], b = d[i + 2];
                    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
                    return (mx - mn) <= 26 && mn >= 95;
                };

            // BFS flood fill from all border pixels
            const visited = new Uint8Array(W * H);
            const queue = [];
            const trySeed = (x, y) => {
                const p = y * W + x;
                if (!visited[p] && isBg(p * 4)) { visited[p] = 1; queue.push(p); }
            };
            for (let x = 0; x < W; x++) { trySeed(x, 0); trySeed(x, H - 1); }
            for (let y = 0; y < H; y++) { trySeed(0, y); trySeed(W - 1, y); }
            let head = 0;
            while (head < queue.length) {
                const p = queue[head++];
                const x = p % W, y = (p / W) | 0;
                if (x > 0) { const q = p - 1; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; queue.push(q); } }
                if (x < W - 1) { const q = p + 1; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; queue.push(q); } }
                if (y > 0) { const q = p - W; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; queue.push(q); } }
                if (y < H - 1) { const q = p + W; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; queue.push(q); } }
            }
            // Apply transparency
            let removed = 0;
            for (let p = 0; p < W * H; p++) {
                if (visited[p]) { d[p * 4 + 3] = 0; removed++; }
            }
            // Residual check: count remaining opaque "checker-like" pixels
            let residual = 0;
            for (let p = 0; p < W * H; p++) {
                if (!visited[p] && isBg(p * 4)) residual++;
            }
            ctx.putImageData(id, 0, 0);
            return { W, H, removedPct: Math.round(removed / (W * H) * 100), residualPct: (residual / (W * H) * 100).toFixed(2), url: cv.toDataURL('image/png') };
        }, { src: dataUrl, mode: job.mode });

        const outBuf = Buffer.from(result.url.split(',')[1], 'base64');
        fs.writeFileSync(job.out, outBuf);
        console.log(path.basename(job.out), `${result.W}x${result.H}`, `removed=${result.removedPct}%`, `residualGrayish=${result.residualPct}% (incl. legit character pixels)`, `-> ${job.out}`);
    }

    await browser.close();
    console.log('DONE');
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
