// Slice the VS weapon/power-up item sheet (4x3 grid) into individual PNGs.
// Steps: strip baked checkerboard -> cut grid cells -> trim to opaque bbox
// -> pre-shrink to 64px max side (offline, avoids GPU minification artifacts)
// -> export sprites/vs/item_<name>.png
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const IN = 'sprites/vs/item_sheet_raw.png';
const OUT_MAX = 64; // pre-shrunk max side in px

// Grid position (row-major) -> output name
const NAMES = [
    'ruler', 'scissors', 'eraser', 'balloon',
    'plane', 'triangle', 'book', 'tornado',
    'magnet', 'milk', 'star', 'chest'
];

(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const dataUrl = 'data:image/png;base64,' + fs.readFileSync(IN).toString('base64');

    const result = await page.evaluate(async ({ src, names, outMax }) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
        const W = img.width, H = img.height;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, W, H);
        const d = id.data;

        // Strip baked checkerboard (light gray/white, low saturation) via
        // border flood-fill — skipped automatically if sheet is already
        // transparent (border pixels have alpha 0)
        const isBg = (i) => {
            if (d[i + 3] === 0) return false;
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

        // Cut 4x3 grid, trim each cell to its opaque bbox, downscale, export
        const COLS = 4, ROWS = 3;
        const cw = W / COLS, ch = H / ROWS;
        const out = {};
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const name = names[r * COLS + c];
                const x0 = Math.floor(c * cw), y0 = Math.floor(r * ch);
                const x1 = Math.floor((c + 1) * cw), y1 = Math.floor((r + 1) * ch);
                // opaque bbox inside the cell
                let minX = x1, minY = y1, maxX = x0, maxY = y0, found = false;
                for (let y = y0; y < y1; y++) {
                    for (let x = x0; x < x1; x++) {
                        if (d[(y * W + x) * 4 + 3] > 8) {
                            found = true;
                            if (x < minX) minX = x; if (x > maxX) maxX = x;
                            if (y < minY) minY = y; if (y > maxY) maxY = y;
                        }
                    }
                }
                if (!found) { out[name] = null; continue; }
                const pad = 4;
                const sx = Math.max(x0, minX - pad), sy = Math.max(y0, minY - pad);
                const sw = Math.min(x1, maxX + pad) - sx, sh = Math.min(y1, maxY + pad) - sy;
                const scale = Math.min(1, outMax / Math.max(sw, sh));
                const ow = Math.max(1, Math.round(sw * scale)), oh = Math.max(1, Math.round(sh * scale));
                const pc = document.createElement('canvas');
                pc.width = ow; pc.height = oh;
                const pctx = pc.getContext('2d');
                pctx.imageSmoothingEnabled = true;
                pctx.imageSmoothingQuality = 'high';
                pctx.drawImage(cv, sx, sy, sw, sh, 0, 0, ow, oh);
                out[name] = { url: pc.toDataURL('image/png'), w: ow, h: oh };
            }
        }
        return out;
    }, { src: dataUrl, names: NAMES, outMax: OUT_MAX });

    for (const name of NAMES) {
        const obj = result[name];
        if (!obj) { console.log('item_' + name + '.png MISSING (empty cell)'); continue; }
        fs.writeFileSync('sprites/vs/item_' + name + '.png', Buffer.from(obj.url.split(',')[1], 'base64'));
        console.log('item_' + name + '.png', obj.w + 'x' + obj.h);
    }

    await browser.close();
    console.log('DONE');
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
