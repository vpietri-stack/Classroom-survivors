// Bake the Ruler slash VFX (sprites/vs/fx_slash3.png): a glowing blue energy
// crescent matching the user's CyclicSlash reference — THIN at the swing's
// start, THICKEST just past the middle, slightly tapered (not pointed) at the
// end, closed with a small rounded cap. Spans ±80° around +x (belly bulges
// toward +x) so in-game rotation = facing and it never wraps behind the player.
//
// Calibration: forward reach (center → outer edge at angle 0) ≈ R + th(0.5)
// ≈ 135 + 52 = 187px on the 512 canvas. drawSlashCrescent scales by len/187.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const url = await page.evaluate(() => {
        const S = 512, C = S / 2, R = 135, H = 1.40; // ±80° span, centreline radius
        const MAXT = 56;                              // belly half-thickness
        const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
        const ctx = cv.getContext('2d');

        // Sword-slash profile: pointed thin START (t=0), thickest belly just
        // past the middle (t≈0.55), easing down to ~25% at the END (slightly
        // tapered, closed by the rounded cap below) — NOT a fat comma blob.
        const th = t => t < 0.55
            ? MAXT * Math.pow(t / 0.55, 0.7)
            : MAXT * (1 - 0.75 * Math.pow((t - 0.55) / 0.45, 1.4));
        const jit = [];
        for (let i = 0; i <= 200; i++) jit.push((Math.random() - 0.5) * 5);
        const ribbon = (mult, fill, blur) => {
            ctx.save();
            if (blur) ctx.filter = 'blur(' + blur + 'px)';
            ctx.fillStyle = fill;
            ctx.beginPath();
            const N = 120;
            for (let i = 0; i <= N; i++) {                 // outer edge forward
                const t = i / N, a = -H + 2 * H * t;
                const r = R + jit[Math.floor(t * 200)] + Math.max(0.5, th(t) * mult);
                const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            // ROUNDED cap on the fat end — the straight polygon close read as
            // the VFX being "cut off in a straight line" in-game
            const thEnd = Math.max(0.5, th(1) * mult);
            ctx.arc(C + Math.cos(H) * R, C + Math.sin(H) * R, thEnd, H, H + Math.PI, false);
            for (let i = N; i >= 0; i--) {                 // inner edge back
                const t = i / N, a = -H + 2 * H * t;
                const r = R + jit[Math.floor(t * 200)] - Math.max(0.5, th(t) * mult);
                ctx.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
            }
            ctx.closePath(); ctx.fill();
            ctx.restore();
        };
        ribbon(1.9, 'rgba(45,80,235,0.5)', 16);    // deep-blue outer glow (soft)
        ribbon(1.10, 'rgba(45,105,250,0.96)', 0);  // saturated blue band
        ribbon(0.55, 'rgba(120,205,255,0.97)', 0); // cyan inner band
        ribbon(0.22, 'rgba(255,255,255,0.97)', 0); // hot white core

        // Wispy energy streaks riding the band (fade toward the narrow tip)
        ctx.globalCompositeOperation = 'lighter';
        const cols = ['rgba(110,170,255,ALPHA)', 'rgba(170,230,255,ALPHA)', 'rgba(255,255,255,ALPHA)'];
        for (let i = 0; i < 90; i++) {
            const t = 0.12 + Math.random() * 0.85;
            const a = -H + 2 * H * t;
            const rOff = (Math.random() - 0.5) * th(t) * 2.6;
            const r = R + rOff;
            const segLen = (8 + Math.random() * 24) / r;
            const alpha = (0.2 + Math.random() * 0.5 * t).toFixed(2);
            ctx.strokeStyle = cols[(Math.random() * cols.length) | 0].replace('ALPHA', alpha);
            ctx.lineWidth = 1 + Math.random() * 2.2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(C, C, r, a - segLen / 2, a + segLen / 2); ctx.stroke();
        }
        return cv.toDataURL('image/png');
    });
    fs.writeFileSync('sprites/vs/fx_slash3.png', Buffer.from(url.split(',')[1], 'base64'));
    console.log('fx_slash3.png written (crescent: thin start / thick middle / tapered end, +-80deg, reach ~187px)');
    // NOTE: renamed again (fx_slash2 -> fx_slash3): in-place re-bakes get served
    // STALE by HTTP/proxy caches; a new filename misses every cache layer.
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
