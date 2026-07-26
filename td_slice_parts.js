// One-off: process a 2x2 paper-doll parts sheet -> alpha-stripped, auto-cropped part PNGs.
// Usage: node td_slice_parts.js <input.png> <outDir>
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const INPUT = process.argv[2] || 'C:/Users/vpiet/AppData/Roaming/Qoder/SharedClientCache/cache/images/task-d19/dropout_parts-2bebca37.png';
const OUTDIR = process.argv[3] || 'sprites/td/anim/parts/dropout';
const NAMES = ['head', 'torso', 'arm', 'leg']; // TL, TR, BL, BR

(async () => {
    fs.mkdirSync(OUTDIR, { recursive: true });
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const dataUrl = 'data:image/png;base64,' + fs.readFileSync(INPUT).toString('base64');

    const parts = await page.evaluate(async (src) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
        const W = img.width, H = img.height;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, W, H);
        const d = id.data;

        // Strip light checkerboard (flood fill from borders, low-sat bright predicate)
        const isBg = (i) => {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            return (mx - mn) <= 26 && mn >= 95;
        };
        const visited = new Uint8Array(W * H);
        const queue = [];
        const seed = (x, y) => { const p = y * W + x; if (!visited[p] && isBg(p * 4)) { visited[p] = 1; queue.push(p); } };
        for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
        for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
        let head = 0;
        while (head < queue.length) {
            const p = queue[head++];
            const x = p % W, y = (p / W) | 0;
            if (x > 0) { const q = p - 1; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; queue.push(q); } }
            if (x < W - 1) { const q = p + 1; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; queue.push(q); } }
            if (y > 0) { const q = p - W; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; queue.push(q); } }
            if (y < H - 1) { const q = p + W; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; queue.push(q); } }
        }
        for (let p = 0; p < W * H; p++) if (visited[p]) d[p * 4 + 3] = 0;
        ctx.putImageData(id, 0, 0);

        // Slice 2x2 quadrants, auto-crop each to non-transparent bbox (+2px pad)
        const results = [];
        const qw = W / 2, qh = H / 2;
        const quads = [[0, 0], [qw, 0], [0, qh], [qw, qh]];
        for (const [qx, qy] of quads) {
            const q = ctx.getImageData(qx, qy, qw, qh);
            let minX = qw, minY = qh, maxX = -1, maxY = -1;
            for (let y = 0; y < qh; y++) {
                for (let x = 0; x < qw; x++) {
                    if (q.data[(y * qw + x) * 4 + 3] > 8) {
                        if (x < minX) minX = x; if (x > maxX) maxX = x;
                        if (y < minY) minY = y; if (y > maxY) maxY = y;
                    }
                }
            }
            const pad = 2;
            minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
            maxX = Math.min(qw - 1, maxX + pad); maxY = Math.min(qh - 1, maxY + pad);
            const cw = maxX - minX + 1, ch = maxY - minY + 1;
            const c2 = document.createElement('canvas');
            c2.width = cw; c2.height = ch;
            c2.getContext('2d').drawImage(cv, qx + minX, qy + minY, cw, ch, 0, 0, cw, ch);
            results.push({ w: cw, h: ch, url: c2.toDataURL('image/png') });
        }
        return results;
    }, dataUrl);

    parts.forEach((p, i) => {
        const buf = Buffer.from(p.url.split(',')[1], 'base64');
        fs.writeFileSync(path.join(OUTDIR, NAMES[i] + '.png'), buf);
        console.log(NAMES[i] + '.png', p.w + 'x' + p.h, Math.round(buf.length / 1024) + 'KB');
    });

    await browser.close();
    console.log('DONE ->', OUTDIR);
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
