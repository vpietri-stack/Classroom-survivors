// Shrink puppet part textures to ~2x their in-game display size.
// The 425px-tall originals were GPU-minified ~11:1 on phones (no mipmaps for
// NPOT textures in WebGL1) -> mushy. Offline two-step downscale keeps quality.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FACTOR = 0.4; // rig scale constant changes 0.18 -> 0.45 to compensate

const FILES = ['player_body.png', 'player_arm.png', 'player_foot_l.png', 'player_foot_r.png'];

(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    for (const f of FILES) {
        const p = 'sprites/vs/' + f;
        const dataUrl = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
        const out = await page.evaluate(async ({ src, factor }) => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
            // two-step downscale for better filtering quality
            const midW = Math.round(img.width * 0.63), midH = Math.round(img.height * 0.63);
            const mid = document.createElement('canvas');
            mid.width = midW; mid.height = midH;
            const mctx = mid.getContext('2d');
            mctx.imageSmoothingQuality = 'high';
            mctx.drawImage(img, 0, 0, midW, midH);
            const w = Math.round(img.width * factor), h = Math.round(img.height * factor);
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            const ctx = cv.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(mid, 0, 0, w, h);
            return { url: cv.toDataURL('image/png'), w, h, ow: img.width, oh: img.height };
        }, { src: dataUrl, factor: FACTOR });
        fs.writeFileSync(p, Buffer.from(out.url.split(',')[1], 'base64'));
        console.log(f, out.ow + 'x' + out.oh, '->', out.w + 'x' + out.h);
    }
    await browser.close();
    console.log('DONE');
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
