// Bake the Ruler slash VFX texture (sprites/vs/fx_slash.png): a glowing blue
// energy crescent modeled on the user's reference — deep-blue outer glow,
// bright blue mid band, cyan-white hot core, tapered to points at both ends,
// plus wispy streak flecks riding the band. Bow bulges toward +x so in-game
// rotation = slash direction. Rendered additively (BlendModes.ADD) in-game.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const url = await page.evaluate(() => {
        const S = 512, C = S / 2, R = 165;
        const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
        const ctx = cv.getContext('2d');

        const A0 = -1.9, A1 = 1.9;              // ~218° bow, opening left
        // Asymmetric taper: long thin wisp at the start, thick belly ~2/3 in,
        // sharp point at the end (matches the reference's swing feel)
        const prof = t => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 1.25);
        const jit = [];
        for (let i = 0; i <= 300; i++) jit.push((Math.random() - 0.5) * 6); // ragged band

        // Each layer drawn ONCE as a filled tapered ribbon => exact colours
        // (the old accumulated 'lighter' stamps clamped to cyan-white and the
        // slash read GREEN over the grass). Glow layer gets a real blur.
        const ribbon = (mult, fill, blur) => {
            ctx.save();
            if (blur) ctx.filter = 'blur(' + blur + 'px)';
            ctx.fillStyle = fill;
            ctx.beginPath();
            const N = 140;
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                const a = A0 + (A1 - A0) * t;
                const r = R + jit[Math.floor(t * 300)] + Math.max(0.6, 40 * prof(t) * mult);
                const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            for (let i = N; i >= 0; i--) {
                const t = i / N;
                const a = A0 + (A1 - A0) * t;
                const r = R + jit[Math.floor(t * 300)] - Math.max(0.6, 40 * prof(t) * mult);
                ctx.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
            }
            ctx.closePath(); ctx.fill();
            ctx.restore();
        };
        ribbon(2.0, 'rgba(45,80,235,0.5)', 16);   // deep-blue outer glow (soft)
        ribbon(1.15, 'rgba(45,105,250,0.96)', 0); // saturated blue band
        ribbon(0.55, 'rgba(120,205,255,0.97)', 0);// cyan inner band
        ribbon(0.22, 'rgba(255,255,255,0.97)', 0);// hot white core

        ctx.globalCompositeOperation = 'lighter';

        // Wispy streaks: short tangent strokes riding the band (energy flecks)
        const cols = ['rgba(110,170,255,ALPHA)', 'rgba(170,230,255,ALPHA)', 'rgba(255,255,255,ALPHA)'];
        for (let i = 0; i < 110; i++) {
            const t = 0.06 + Math.random() * 0.88;
            const a = A0 + (A1 - A0) * t;
            const th = 40 * prof(t);
            const rOff = (Math.random() - 0.5) * th * 3.1;
            const r = R + rOff;
            const segLen = (8 + Math.random() * 26) / r;  // radians along the bow
            const alpha = (0.25 + Math.random() * 0.5).toFixed(2);
            ctx.strokeStyle = cols[(Math.random() * cols.length) | 0].replace('ALPHA', alpha);
            ctx.lineWidth = 1 + Math.random() * 2.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(C, C, r, a - segLen / 2, a + segLen / 2);
            ctx.stroke();
        }
        // A few detached outer specks like the reference
        for (let i = 0; i < 16; i++) {
            const t = Math.random();
            const a = A0 + (A1 - A0) * t;
            const r = R + 40 * prof(t) * (1.6 + Math.random() * 1.4);
            ctx.fillStyle = 'rgba(140,200,255,' + (0.2 + Math.random() * 0.4).toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, 1 + Math.random() * 2.4, 0, Math.PI * 2);
            ctx.fill();
        }
        return cv.toDataURL('image/png');
    });
    fs.writeFileSync('sprites/vs/fx_slash.png', Buffer.from(url.split(',')[1], 'base64'));
    console.log('fx_slash.png written');
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
