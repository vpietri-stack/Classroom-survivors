// Slice the TD dropout zombie sheet (6 frames, side view) + the bucket
// zombie from the TD enemies lineup into VS enemy PNGs.
// Frames via connected components sorted by x (stars/droplets merged into the
// nearest frame, dust dropped). Auto-detects background: if the sheet still
// has an opaque near-white bg it is flood-keyed from the borders (dark
// outlines protect interior whites - eyes, bucket); already-transparent
// sheets skip keying. Pre-shrunk per the offline-shrink convention.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const JOBS = [
    {
        file: 'sprites/td/anim/dropout.png',
        // 6-frame convention: walkA, walkB, windup, strike, hit, defeated
        names: ['zombie_walk_a', 'zombie_walk_b', 'zombie_windup', 'zombie_lunge', 'zombie_hit', 'zombie_dead'],
        outMax: 56
    },
    {
        file: 'sprites/td/enemies.png',
        // 5 pixel zombies; only the 3rd (bucket head) is wanted -> the boss
        names: [null, null, 'boss', null, null],
        outMax: 110
    }
];

(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    for (const job of JOBS) {
        const dataUrl = 'data:image/png;base64,' + fs.readFileSync(job.file).toString('base64');
        const result = await page.evaluate(async ({ src, names, outMax }) => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
            const W = img.width, H = img.height;
            const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const id = ctx.getImageData(0, 0, W, H);
            const d = id.data;

            // Detect baked near-white bg (opaque borders) -> flood-key it
            let opaqueBorder = 0, samples = 0;
            for (let x = 0; x < W; x += 7) {
                for (const y of [0, H - 1]) {
                    samples++;
                    if (d[(y * W + x) * 4 + 3] > 200) opaqueBorder++;
                }
            }
            if (opaqueBorder > samples * 0.5) {
                const isBg = (i) => {
                    const r = d[i], g = d[i + 1], b = d[i + 2];
                    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
                    return d[i + 3] > 0 && (mx - mn) <= 18 && mn >= 232;
                };
                const vis = new Uint8Array(W * H); const q = [];
                const seed = (x, y) => { const p = y * W + x; if (!vis[p] && isBg(p * 4)) { vis[p] = 1; q.push(p); } };
                for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
                for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
                let h = 0;
                while (h < q.length) {
                    const p = q[h++]; const x = p % W, y = (p / W) | 0;
                    if (x > 0) { const t = p - 1; if (!vis[t] && isBg(t * 4)) { vis[t] = 1; q.push(t); } }
                    if (x < W - 1) { const t = p + 1; if (!vis[t] && isBg(t * 4)) { vis[t] = 1; q.push(t); } }
                    if (y > 0) { const t = p - W; if (!vis[t] && isBg(t * 4)) { vis[t] = 1; q.push(t); } }
                    if (y < H - 1) { const t = p + W; if (!vis[t] && isBg(t * 4)) { vis[t] = 1; q.push(t); } }
                }
                for (let p = 0; p < W * H; p++) if (vis[p]) d[p * 4 + 3] = 0;
                ctx.putImageData(id, 0, 0);
            }

            // Connected components of opaque pixels
            const comp = new Int32Array(W * H).fill(-1);
            const comps = [];
            for (let p0 = 0; p0 < W * H; p0++) {
                if (comp[p0] !== -1 || d[p0 * 4 + 3] < 12) continue;
                const idx = comps.length;
                const q = [p0]; comp[p0] = idx;
                let minX = W, minY = H, maxX = 0, maxY = 0, area = 0, h2 = 0;
                while (h2 < q.length) {
                    const p = q[h2++];
                    const x = p % W, y = (p / W) | 0;
                    area++;
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    if (x > 0) { const n = p - 1; if (comp[n] === -1 && d[n * 4 + 3] >= 12) { comp[n] = idx; q.push(n); } }
                    if (x < W - 1) { const n = p + 1; if (comp[n] === -1 && d[n * 4 + 3] >= 12) { comp[n] = idx; q.push(n); } }
                    if (y > 0) { const n = p - W; if (comp[n] === -1 && d[n * 4 + 3] >= 12) { comp[n] = idx; q.push(n); } }
                    if (y < H - 1) { const n = p + W; if (comp[n] === -1 && d[n * 4 + 3] >= 12) { comp[n] = idx; q.push(n); } }
                }
                comps.push({ minX, minY, maxX, maxY, area });
            }

            const sorted = [...comps].sort((a, b) => b.area - a.area);
            const frames = sorted.slice(0, names.length);
            const minor = sorted.slice(names.length);
            for (const m of minor) {
                if (m.area < 60) continue;
                const mcx = (m.minX + m.maxX) / 2, mcy = (m.minY + m.maxY) / 2;
                let best = null, bd = 1e12;
                for (const f of frames) {
                    const fcx = (f.minX + f.maxX) / 2, fcy = (f.minY + f.maxY) / 2;
                    const dd = (mcx - fcx) * (mcx - fcx) + (mcy - fcy) * (mcy - fcy);
                    if (dd < bd) { bd = dd; best = f; }
                }
                if (best && Math.sqrt(bd) < Math.max(best.maxX - best.minX, best.maxY - best.minY)) {
                    best.minX = Math.min(best.minX, m.minX); best.maxX = Math.max(best.maxX, m.maxX);
                    best.minY = Math.min(best.minY, m.minY); best.maxY = Math.max(best.maxY, m.maxY);
                }
            }
            frames.sort((a, b) => a.minX - b.minX);

            const out = {};
            frames.forEach((f, i) => {
                if (!names[i]) return; // deliberately skipped cell
                const pad = 4;
                const sx = Math.max(0, f.minX - pad), sy = Math.max(0, f.minY - pad);
                const sw = Math.min(W, f.maxX + pad) - sx, sh = Math.min(H, f.maxY + pad) - sy;
                const scale = Math.min(1, outMax / Math.max(sw, sh));
                const ow = Math.max(1, Math.round(sw * scale)), oh = Math.max(1, Math.round(sh * scale));
                const pc = document.createElement('canvas'); pc.width = ow; pc.height = oh;
                const pctx = pc.getContext('2d');
                pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high';
                pctx.drawImage(cv, sx, sy, sw, sh, 0, 0, ow, oh);
                out[names[i]] = { url: pc.toDataURL('image/png'), w: ow, h: oh };
            });
            return out;
        }, { src: dataUrl, names: job.names, outMax: job.outMax });

        for (const name of job.names) {
            if (!name) continue;
            const obj = result[name];
            if (!obj) { console.log('enemy_' + name + '.png MISSING'); continue; }
            fs.writeFileSync('sprites/vs/enemy_' + name + '.png', Buffer.from(obj.url.split(',')[1], 'base64'));
            console.log('enemy_' + name + '.png', obj.w + 'x' + obj.h);
        }
    }

    await browser.close();
    console.log('DONE');
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
