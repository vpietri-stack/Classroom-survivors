// One-off: decode a GIF's frames (Chrome ImageDecoder) into a contact sheet
// so the animation can be inspected frame by frame.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const IN = process.argv[2];
const OUT = process.argv[3] || 'gif_frames.png';
(async () => {
    const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('http://localhost:8080/index.html', { waitUntil: 'domcontentloaded' }); // secure ctx for WebCodecs
    const b64 = fs.readFileSync(IN).toString('base64');
    const url = await page.evaluate(async (b64) => {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const dec = new ImageDecoder({ data: bytes, type: 'image/gif' });
        await dec.tracks.ready;
        const n = dec.tracks.selectedTrack.frameCount;
        const first = await dec.decode({ frameIndex: 0 });
        const fw = first.image.displayWidth, fh = first.image.displayHeight;
        // pick up to 12 evenly spaced frames
        const picks = [];
        const count = Math.min(12, n);
        for (let i = 0; i < count; i++) picks.push(Math.round(i * (n - 1) / Math.max(1, count - 1)));
        const cols = 4, rows = Math.ceil(count / cols);
        const cellW = 256, cellH = Math.round(cellW * fh / fw);
        const cv = document.createElement('canvas');
        cv.width = cols * cellW; cv.height = rows * cellH;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#222'; ctx.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < count; i++) {
            const fr = await dec.decode({ frameIndex: picks[i] });
            const x = (i % cols) * cellW, y = ((i / cols) | 0) * cellH;
            ctx.drawImage(fr.image, x, y, cellW, cellH);
            ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
            ctx.fillText('f' + picks[i] + '/' + n, x + 4, y + 16);
            fr.image.close();
        }
        return cv.toDataURL('image/png');
    }, b64);
    fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
    console.log(OUT, 'written');
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
