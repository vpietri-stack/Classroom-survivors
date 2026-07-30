// Compose character-select portraits: body + weapon arm, using the SAME
// layout as the in-game puppet (arm pivot at (16,-1)/PS with origin
// (0.12,0.18), rotated to the 15° base angle, drawn BEHIND the body which
// sits at (0,-10)/PS). Output: sprites/vs/portrait_monitor.png / _skippy.png
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const JOBS = [
    { body: 'sprites/vs/player_body.png', arm: 'sprites/vs/player_arm.png', out: 'sprites/vs/portrait_monitor.png' },
    { body: 'sprites/vs/skippy_body.png', arm: 'sprites/vs/skippy_arm.png', out: 'sprites/vs/portrait_skippy.png' }
];
(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    for (const job of JOBS) {
        const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
        const url = await page.evaluate(async ({ bodySrc, armSrc }) => {
            const load = (src) => new Promise((res, rej) => {
                const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
            });
            const body = await load(bodySrc), arm = await load(armSrc);
            const POS = 1 / 0.45;               // game offsets -> part-pixel units
            const W = 230, H = 215;
            const ox = 78, oy = 108;            // puppet container origin on canvas
            const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            const ctx = cv.getContext('2d');
            // Arm first (in-game it's behind the body): pivot + 15° base angle
            ctx.save();
            ctx.translate(ox + 16 * POS, oy + -1 * POS);
            ctx.rotate(15 * Math.PI / 180);
            ctx.drawImage(arm, -0.12 * arm.width, -0.18 * arm.height);
            ctx.restore();
            // Body on top, centered at (0,-10)
            ctx.drawImage(body, ox - body.width / 2, oy + -10 * POS - body.height / 2);
            return cv.toDataURL('image/png');
        }, { bodySrc: b64(job.body), armSrc: b64(job.arm) });
        fs.writeFileSync(job.out, Buffer.from(url.split(',')[1], 'base64'));
        console.log(job.out, 'written');
    }
    await browser.close();
    console.log('DONE');
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
