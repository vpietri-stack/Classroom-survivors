// Slice the VS player paper-doll parts sheet into individual part PNGs.
// Steps: strip baked checkerboard -> erase black grid lines -> find the 4
// connected components -> classify (body / ruler-arm / two feet) -> export.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const IN = 'sprites/vs/player_parts_raw.png';

(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const dataUrl = 'data:image/png;base64,' + fs.readFileSync(IN).toString('base64');

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

        // 1) checkerboard predicate (light gray/white, low saturation)
        const isBg = (i) => {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            return (mx - mn) <= 26 && mn >= 95;
        };
        // flood from borders
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

        // 2) erase black grid lines: any row/col where >65% of pixels are dark & opaque
        const isDark = (i) => d[i + 3] > 0 && Math.max(d[i], d[i + 1], d[i + 2]) <= 70;
        for (let y = 0; y < H; y++) {
            let dark = 0;
            for (let x = 0; x < W; x++) if (isDark((y * W + x) * 4)) dark++;
            if (dark > W * 0.65) for (let x = 0; x < W; x++) d[(y * W + x) * 4 + 3] = 0;
        }
        for (let x = 0; x < W; x++) {
            let dark = 0;
            for (let y = 0; y < H; y++) if (isDark((y * W + x) * 4)) dark++;
            if (dark > H * 0.65) for (let y = 0; y < H; y++) d[(y * W + x) * 4 + 3] = 0;
        }

        // 3) connected components of remaining opaque pixels
        const comp = new Int32Array(W * H).fill(-1);
        const comps = [];
        for (let p0 = 0; p0 < W * H; p0++) {
            if (comp[p0] !== -1 || d[p0 * 4 + 3] === 0) continue;
            const idx = comps.length;
            const q = [p0]; comp[p0] = idx;
            let minX = W, minY = H, maxX = 0, maxY = 0, area = 0, h2 = 0;
            while (h2 < q.length) {
                const p = q[h2++];
                const x = p % W, y = (p / W) | 0;
                area++;
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                const nb = [];
                if (x > 0) nb.push(p - 1);
                if (x < W - 1) nb.push(p + 1);
                if (y > 0) nb.push(p - W);
                if (y < H - 1) nb.push(p + W);
                for (const n of nb) if (comp[n] === -1 && d[n * 4 + 3] > 0) { comp[n] = idx; q.push(n); }
            }
            comps.push({ minX, minY, maxX, maxY, area });
        }
        ctx.putImageData(id, 0, 0);

        // keep the 4 biggest
        const big = comps.filter(c => c.area > 400).sort((a, b) => b.area - a.area).slice(0, 4);
        // classify: largest = body; of the rest, topmost = arm; remaining 2 = feet by x
        const body = big[0];
        const rest = big.slice(1).sort((a, b) => a.minY - b.minY);
        const arm = rest[0];
        const feet = rest.slice(1).sort((a, b) => a.minX - b.minX);

        const exportPart = (c, pad = 6) => {
            const x0 = Math.max(0, c.minX - pad), y0 = Math.max(0, c.minY - pad);
            const w = Math.min(W, c.maxX + pad) - x0, h = Math.min(H, c.maxY + pad) - y0;
            const pc = document.createElement('canvas');
            pc.width = w; pc.height = h;
            pc.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, w, h);
            return { url: pc.toDataURL('image/png'), w, h };
        };
        return {
            found: big.length,
            areas: big.map(c => c.area),
            body: exportPart(body),
            arm: exportPart(arm),
            footL: feet[0] ? exportPart(feet[0]) : null,
            footR: feet[1] ? exportPart(feet[1]) : null
        };
    }, dataUrl);

    console.log('components found:', result.found, 'areas:', result.areas);
    const save = (obj, name) => {
        if (!obj) { console.log(name, 'MISSING'); return; }
        fs.writeFileSync('sprites/vs/' + name, Buffer.from(obj.url.split(',')[1], 'base64'));
        console.log(name, obj.w + 'x' + obj.h);
    };
    save(result.body, 'player_body.png');
    save(result.arm, 'player_arm.png');
    save(result.footL, 'player_foot_l.png');
    save(result.footR, 'player_foot_r.png');

    await browser.close();
    console.log('DONE');
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
