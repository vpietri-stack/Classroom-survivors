// Slice the VS rat/bat enemy sheets (magenta background) into frame PNGs.
// - Key: magenta-family hue (r high, b high, g low) INCLUDING the darker
//   magenta drop shadows — removed globally, not flood-filled, since pure
//   magenta never appears inside the characters.
// - Frames found via connected components; tiny components (the ✦ watermark,
//   stray droplets) are dropped, near ones (impact stars around the hit pose)
//   are merged into the nearest big frame by bbox proximity.
// - Exports are MASKED to each frame's own components: overlapping bboxes on
//   the sheet (e.g. a neighbour's wingtip inside this frame's box) no longer
//   bleed into the cut frame.
// - Colour boost (saturation ×1.3, brightness ×1.13): the sheets came back
//   muted browns/greys next to the candy-bright weapon items, so frames are
//   brightened in post to sit in the same palette family.
// - Pre-shrunk so enemies render at emoji-like size in-game (perf + no GPU
//   minification artifacts). Rat ~52px, bat ~46px.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const JOBS = [
    { file: 'sprites/vs/enemy_rat_raw.png', names: ['rat_walk', 'rat_hit'], outMax: 52, boost: true },
    { file: 'sprites/vs/enemy_bat_raw.png', names: ['bat_up', 'bat_down', 'bat_hit'], outMax: 46, boost: true }
];

(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    for (const job of JOBS) {
        const dataUrl = 'data:image/png;base64,' + fs.readFileSync(job.file).toString('base64');
        const result = await page.evaluate(async ({ src, names, outMax, boost }) => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
            const W = img.width, H = img.height;
            const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const id = ctx.getImageData(0, 0, W, H);
            const d = id.data;

            // Global magenta-family key (bg + darker shadow tints). The teal
            // crest is g-dominant and fur is grey (r≈g≈b), so this is safe.
            for (let p = 0; p < W * H; p++) {
                const i = p * 4;
                const r = d[i], g = d[i + 1], b = d[i + 2];
                if (r > 120 && b > 110 && g < 0.62 * Math.min(r, b)) d[i + 3] = 0;
            }
            ctx.putImageData(id, 0, 0);

            // Connected components of remaining opaque pixels
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
                comps.push({ idx, minX, minY, maxX, maxY, area });
            }

            // Big components = frames (as many as names); the rest merge into
            // the nearest frame if close (impact stars), else dropped (✦ mark)
            const sorted = [...comps].sort((a, b) => b.area - a.area);
            const frames = sorted.slice(0, names.length);
            frames.forEach(f => { f.ids = new Set([f.idx]); });
            const minor = sorted.slice(names.length);
            for (const m of minor) {
                if (m.area < 60) continue; // dust / watermark sparkle
                const mcx = (m.minX + m.maxX) / 2, mcy = (m.minY + m.maxY) / 2;
                let best = null, bd = 1e12;
                for (const f of frames) {
                    const fcx = (f.minX + f.maxX) / 2, fcy = (f.minY + f.maxY) / 2;
                    const dd = (mcx - fcx) * (mcx - fcx) + (mcy - fcy) * (mcy - fcy);
                    if (dd < bd) { bd = dd; best = f; }
                }
                // merge only when genuinely near the frame (stars hover close)
                if (best && Math.sqrt(bd) < Math.max(best.maxX - best.minX, best.maxY - best.minY)) {
                    best.minX = Math.min(best.minX, m.minX); best.maxX = Math.max(best.maxX, m.maxX);
                    best.minY = Math.min(best.minY, m.minY); best.maxY = Math.max(best.maxY, m.maxY);
                    best.ids.add(m.idx);
                }
            }
            frames.sort((a, b) => a.minX - b.minX); // left-to-right = names order

            const out = {};
            frames.forEach((f, i) => {
                const pad = 4;
                const sx = Math.max(0, f.minX - pad), sy = Math.max(0, f.minY - pad);
                const sw = Math.min(W, f.maxX + pad) - sx, sh = Math.min(H, f.maxY + pad) - sy;
                // MASKED crop: copy only this frame's own components so a
                // neighbour's overlapping wingtip can't bleed into the cut
                const crop = new ImageData(sw, sh);
                const cd = crop.data;
                for (let y = 0; y < sh; y++) {
                    for (let x = 0; x < sw; x++) {
                        const sp = (sy + y) * W + (sx + x);
                        if (d[sp * 4 + 3] < 1 || !f.ids.has(comp[sp])) continue;
                        const si = sp * 4, di = (y * sw + x) * 4;
                        let r = d[si], g = d[si + 1], b = d[si + 2];
                        if (boost) {
                            // Saturation ×1.3 + brightness ×1.13 to match the
                            // bright weapon-item palette
                            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                            r = (gray + (r - gray) * 1.3) * 1.13;
                            g = (gray + (g - gray) * 1.3) * 1.13;
                            b = (gray + (b - gray) * 1.3) * 1.13;
                        }
                        cd[di] = Math.max(0, Math.min(255, r));
                        cd[di + 1] = Math.max(0, Math.min(255, g));
                        cd[di + 2] = Math.max(0, Math.min(255, b));
                        cd[di + 3] = d[si + 3];
                    }
                }
                const mc = document.createElement('canvas'); mc.width = sw; mc.height = sh;
                mc.getContext('2d').putImageData(crop, 0, 0);
                const scale = Math.min(1, outMax / Math.max(sw, sh));
                const ow = Math.max(1, Math.round(sw * scale)), oh = Math.max(1, Math.round(sh * scale));
                const pc = document.createElement('canvas'); pc.width = ow; pc.height = oh;
                const pctx = pc.getContext('2d');
                pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high';
                pctx.drawImage(mc, 0, 0, sw, sh, 0, 0, ow, oh);
                out[names[i]] = { url: pc.toDataURL('image/png'), w: ow, h: oh };
            });
            return out;
        }, { src: dataUrl, names: job.names, outMax: job.outMax, boost: !!job.boost });

        for (const name of job.names) {
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
