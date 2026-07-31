// Bake the Ruler slash VFX SPRITE SHEET (sprites/vs/fx_slash_sheet.png):
// 12 frames (4x3 grid of 512px cells) of a glowing blue sword-slash crescent
// modeled on the user's CyclicSlash GIF:
//  - shape: THIN start, thickest belly just past the middle, tapered end;
//    spans +-117deg (~65% of a full circle) so the tips reach slightly BEHIND
//    the character; belly bulges toward +x (in-game rotation = facing).
//  - f0-f2: full crescent, bright.
//  - f3-f11: dissolve — the tail recedes along the arc toward the leading end,
//    the band thins + ERODES into dashes/wisps (fixed noise -> coherent across
//    frames), specks fling off the receding edge, alpha eases down.
// Calibration: forward reach (cell center -> outer edge at angle 0) ≈
// R + th(0.5) ≈ 150 + 37 = 187px at scale 1. In-game scale = len/187.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const url = await page.evaluate(() => {
        const CELL = 512, COLS = 4, ROWS = 3, FRAMES = 12;
        const R = 150, H = 2.04;   // ±117° span — 65% of a full circle
        const MAXT = 40;           // thinner band than the old bake
        const N = 220;             // steps along the arc
        const cv = document.createElement('canvas');
        cv.width = CELL * COLS; cv.height = CELL * ROWS;
        const ctx = cv.getContext('2d');

        // Sword profile: thin start, belly just past middle, tapered end
        const th = t => t < 0.55
            ? MAXT * Math.pow(t / 0.55, 0.7)
            : MAXT * (1 - 0.72 * Math.pow((t - 0.55) / 0.45, 1.4));
        // Fixed noise => erosion happens at the SAME arc spots frame after
        // frame (coherent breakup instead of random flicker)
        const jit = [], erode = [];
        for (let i = 0; i <= N; i++) { jit.push((Math.random() - 0.5) * 5); erode.push(Math.random()); }
        const wisps = [];
        for (let i = 0; i < 70; i++) {
            wisps.push({ t: 0.08 + Math.random() * 0.9, rOff: (Math.random() - 0.5) * 2.4, len: 8 + Math.random() * 22, w: 1 + Math.random() * 2, c: (Math.random() * 3) | 0, a: 0.25 + Math.random() * 0.45 });
        }
        const specks = [];
        for (let i = 0; i < 26; i++) specks.push({ dt: Math.random() * 0.12, rOff: (Math.random() - 0.5) * 1.6, fling: 14 + Math.random() * 30, sz: 1.5 + Math.random() * 2.2, a: 0.3 + Math.random() * 0.4 });
        const wispCols = ['rgba(110,170,255,A)', 'rgba(170,230,255,A)', 'rgba(255,255,255,A)'];

        const angOf = t => -H + 2 * H * t;
        for (let f = 0; f < FRAMES; f++) {
            const ox = (f % COLS) * CELL + CELL / 2, oy = ((f / COLS) | 0) * CELL + CELL / 2;
            const dis = Math.max(0, (f - 2) / (FRAMES - 3));       // 0 on f0-f2
            const cutT = Math.pow(dis, 0.9) * 1.06;                // tail recedes
            const bandM = 1 - dis * 0.45;                          // thinner as it dies
            const alphaM = 1 - dis * 0.5;

            // visible, non-eroded steps -> contiguous runs
            const alive = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                alive.push(t >= cutT && th(t) * bandM > 0.6 && !(dis > 0 && erode[i] < dis * 1.2 - 0.06));
            }
            const runs = [];
            let s = -1;
            for (let i = 0; i <= N; i++) {
                if (alive[i] && s === -1) s = i;
                if ((!alive[i] || i === N) && s !== -1) { if (i - s >= 3) runs.push([s, Math.min(i, N)]); s = -1; }
            }
            const ribbon = (mult, fill, blur) => {
                ctx.save();
                if (blur) ctx.filter = 'blur(' + blur + 'px)';
                ctx.fillStyle = fill;
                for (const [a, b] of runs) {
                    ctx.beginPath();
                    for (let i = a; i <= b; i++) {
                        const t = i / N, an = angOf(t);
                        const r = R + jit[i] + Math.max(0.5, th(t) * mult * bandM);
                        const x = ox + Math.cos(an) * r, y = oy + Math.sin(an) * r;
                        if (i === a) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    for (let i = b; i >= a; i--) {
                        const t = i / N, an = angOf(t);
                        const r = R + jit[i] - Math.max(0.5, th(t) * mult * bandM);
                        ctx.lineTo(ox + Math.cos(an) * r, oy + Math.sin(an) * r);
                    }
                    ctx.closePath(); ctx.fill();
                    // rounded caps at both run ends
                    for (const e of [a, b]) {
                        const t = e / N, an = angOf(t);
                        const rr = Math.max(0.5, th(t) * mult * bandM);
                        ctx.beginPath();
                        ctx.arc(ox + Math.cos(an) * (R + jit[e]), oy + Math.sin(an) * (R + jit[e]), rr, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                ctx.restore();
            };
            ctx.save();
            ctx.globalAlpha = alphaM;
            ribbon(1.9, 'rgba(45,80,235,0.5)', 13);    // deep-blue glow
            ribbon(1.10, 'rgba(45,105,250,0.96)', 0);  // saturated blue band
            ribbon(0.55, 'rgba(120,205,255,0.97)', 0); // cyan
            ribbon(0.22, 'rgba(255,255,255,0.97)', 0); // white core

            // wisp streaks riding the surviving band
            ctx.globalCompositeOperation = 'lighter';
            for (const wsp of wisps) {
                if (wsp.t < cutT) continue;
                const an = angOf(wsp.t);
                const r = R + wsp.rOff * th(wsp.t) * bandM;
                const seg = wsp.len / r;
                ctx.strokeStyle = wispCols[wsp.c].replace('A', (wsp.a * alphaM).toFixed(2));
                ctx.lineWidth = wsp.w; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(ox, oy, r, an - seg / 2, an + seg / 2); ctx.stroke();
            }
            // specks flung off the receding edge
            if (dis > 0 && cutT < 1) {
                for (const sp of specks) {
                    const t = Math.min(1, cutT + sp.dt);
                    const an = angOf(t);
                    const r = R + sp.rOff * th(t) + sp.fling * dis;
                    ctx.fillStyle = 'rgba(190,228,255,' + (sp.a * (1 - dis)).toFixed(2) + ')';
                    ctx.beginPath();
                    ctx.arc(ox + Math.cos(an) * r, oy + Math.sin(an) * r, sp.sz, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }
        return cv.toDataURL('image/png');
    });
    fs.writeFileSync('sprites/vs/fx_slash_sheet.png', Buffer.from(url.split(',')[1], 'base64'));
    const kb = Math.round(fs.statSync('sprites/vs/fx_slash_sheet.png').size / 1024);
    console.log('fx_slash_sheet.png written (12 frames, 4x3 x 512px, ' + kb + 'KB)');
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
