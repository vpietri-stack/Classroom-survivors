// One-off tool: strip baked-in checkerboard backgrounds from AI-generated
// sprite sheets and save true-alpha PNGs. Uses headless Chrome canvas.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const JOBS = [
    { in: 'sprites/td/anim/dropout.png', out: 'sprites/td/anim/dropout.png' },
    { in: 'sprites/td/anim/backpack.png', out: 'sprites/td/anim/backpack.png' },
    { in: 'sprites/td/anim/nerd.png', out: 'sprites/td/anim/nerd.png' },
    { in: 'C:/Users/vpiet/AppData/Roaming/Qoder/SharedClientCache/cache/images/task-f36/Gemini_Generated_Image_2ltrox2ltrox2ltr-cb075e56.png', out: 'sprites/td/anim/pencil.png' }
];

(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    for (const job of JOBS) {
        const buf = fs.readFileSync(job.in);
        const dataUrl = 'data:image/png;base64,' + buf.toString('base64');

        const result = await page.evaluate(async (src) => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
            const W = img.width, H = img.height;
            const cv = document.createElement('canvas');
            cv.width = W; cv.height = H;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const id = ctx.getImageData(0, 0, W, H);
            const d = id.data;

            // Sample checkerboard tones from corners + scan for second tone
            const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
            const tones = [];
            const addTone = (c) => {
                for (const t of tones) if (Math.abs(t[0] - c[0]) + Math.abs(t[1] - c[1]) + Math.abs(t[2] - c[2]) < 30) return;
                tones.push(c);
            };
            // Sample along all 4 borders every 3px to catch both checker tones
            for (let x = 0; x < W; x += 3) { addTone(px(x, 0)); addTone(px(x, H - 1)); }
            for (let y = 0; y < H; y += 3) { addTone(px(0, y)); addTone(px(W - 1, y)); }
            // Keep only light-gray-ish tones (checkerboard is light gray/white)
            const bgTones = tones.filter(c => c[0] > 150 && c[1] > 150 && c[2] > 150 &&
                Math.abs(c[0] - c[1]) < 18 && Math.abs(c[1] - c[2]) < 18 && Math.abs(c[0] - c[2]) < 18);

            const TOL = 14;
            const isBg = (i) => {
                const r = d[i], g = d[i + 1], b = d[i + 2];
                for (const t of bgTones) {
                    if (Math.abs(r - t[0]) <= TOL && Math.abs(g - t[1]) <= TOL && Math.abs(b - t[2]) <= TOL) return true;
                }
                return false;
            };

            // BFS flood fill from all border pixels
            const visited = new Uint8Array(W * H);
            const stack = [];
            for (let x = 0; x < W; x++) { stack.push(x, 0, x, H - 1); }
            for (let y = 0; y < H; y++) { stack.push(0, y, W - 1, y); }
            const queue = [];
            for (let k = 0; k < stack.length; k += 2) {
                const x = stack[k], y = stack[k + 1];
                const p = y * W + x;
                if (!visited[p] && isBg(p * 4)) { visited[p] = 1; queue.push(p); }
            }
            let head = 0;
            while (head < queue.length) {
                const p = queue[head++];
                const x = p % W, y = (p / W) | 0;
                const neigh = [];
                if (x > 0) neigh.push(p - 1);
                if (x < W - 1) neigh.push(p + 1);
                if (y > 0) neigh.push(p - W);
                if (y < H - 1) neigh.push(p + W);
                for (const q of neigh) {
                    if (!visited[q] && isBg(q * 4)) { visited[q] = 1; queue.push(q); }
                }
            }
            // Apply transparency
            let removed = 0;
            for (let p = 0; p < W * H; p++) {
                if (visited[p]) { d[p * 4 + 3] = 0; removed++; }
            }
            ctx.putImageData(id, 0, 0);
            return { W, H, tones: bgTones, removedPct: Math.round(removed / (W * H) * 100), url: cv.toDataURL('image/png') };
        }, dataUrl);

        const outBuf = Buffer.from(result.url.split(',')[1], 'base64');
        fs.writeFileSync(job.out, outBuf);
        console.log(path.basename(job.out), `${result.W}x${result.H}`, `bgTones=${result.tones.length}`, `removed=${result.removedPct}%`, `-> ${job.out}`);
    }

    await browser.close();
    console.log('DONE');
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
