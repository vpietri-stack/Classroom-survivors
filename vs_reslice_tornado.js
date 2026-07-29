// Re-slice ONLY the tornado cell with a TIGHT checker key so the grey vortex
// survives. Root cause of the lost sprite: the old key removed any low-sat
// pixel with brightness >= 95, which includes the tornado's mid-grey swirl.
// Here we only flood-remove near-white checker (brightness >= 210); the darker
// swirl body then blocks the fill and is preserved. Exported larger (~240px)
// since it's displayed big in-game (avoids upscaling blur).
const { chromium } = require('playwright-core');
const fs = require('fs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const p = await b.newPage();
    const dataUrl = 'data:image/png;base64,' + fs.readFileSync('sprites/vs/item_sheet_raw.png').toString('base64');
    const out = await p.evaluate(async (src) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
        const W = img.width, H = img.height;
        // Crop the tornado cell (4x3 grid, col 3 idx, row 1 idx)
        const cw = W / 4, ch = H / 3;
        const cx = Math.floor(3 * cw), cy = Math.floor(1 * ch), CW = Math.floor(cw), CH = Math.floor(ch);
        const cell = document.createElement('canvas'); cell.width = CW; cell.height = CH;
        const cx2 = cell.getContext('2d', { willReadFrequently: true });
        cx2.drawImage(img, cx, cy, CW, CH, 0, 0, CW, CH);
        const id = cx2.getImageData(0, 0, CW, CH); const d = id.data;
        // Tight checker predicate: near-white/light-gray, low saturation
        const isChecker = (i) => {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            return (mx - mn) <= 14 && mn >= 210;
        };
        const vis = new Uint8Array(CW * CH); const q = [];
        const seed = (x, y) => { const pp = y * CW + x; if (!vis[pp] && isChecker(pp * 4)) { vis[pp] = 1; q.push(pp); } };
        for (let x = 0; x < CW; x++) { seed(x, 0); seed(x, CH - 1); }
        for (let y = 0; y < CH; y++) { seed(0, y); seed(CW - 1, y); }
        let h = 0;
        while (h < q.length) {
            const pp = q[h++]; const x = pp % CW, y = (pp / CW) | 0;
            if (x > 0) { const t = pp - 1; if (!vis[t] && isChecker(t * 4)) { vis[t] = 1; q.push(t); } }
            if (x < CW - 1) { const t = pp + 1; if (!vis[t] && isChecker(t * 4)) { vis[t] = 1; q.push(t); } }
            if (y > 0) { const t = pp - CW; if (!vis[t] && isChecker(t * 4)) { vis[t] = 1; q.push(t); } }
            if (y < CH - 1) { const t = pp + CW; if (!vis[t] && isChecker(t * 4)) { vis[t] = 1; q.push(t); } }
        }
        for (let pp = 0; pp < CW * CH; pp++) if (vis[pp]) d[pp * 4 + 3] = 0;
        cx2.putImageData(id, 0, 0);
        // Opaque bbox
        let minX = CW, minY = CH, maxX = 0, maxY = 0, found = false;
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
            if (d[(y * CW + x) * 4 + 3] > 8) { found = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        if (!found) return null;
        const pad = 6;
        const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
        const sw = Math.min(CW, maxX + pad) - sx, sh = Math.min(CH, maxY + pad) - sy;
        const outMax = 240;
        const scale = Math.min(1, outMax / Math.max(sw, sh));
        const ow = Math.round(sw * scale), oh = Math.round(sh * scale);
        const pc = document.createElement('canvas'); pc.width = ow; pc.height = oh;
        const pctx = pc.getContext('2d'); pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high';
        pctx.drawImage(cell, sx, sy, sw, sh, 0, 0, ow, oh);
        // Report how much survived (opaque %) as a sanity metric
        const od = pc.getContext('2d').getImageData(0, 0, ow, oh).data;
        let op = 0; for (let i = 3; i < od.length; i += 4) if (od[i] > 8) op++;
        return { url: pc.toDataURL('image/png'), w: ow, h: oh, opaquePct: Math.round(100 * op / (ow * oh)) };
    }, dataUrl);
    await b.close();
    if (!out) { console.log('EMPTY'); process.exit(1); }
    fs.writeFileSync('sprites/vs/item_tornado.png', Buffer.from(out.url.split(',')[1], 'base64'));
    console.log('item_tornado.png', out.w + 'x' + out.h, 'opaque%', out.opaquePct);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
