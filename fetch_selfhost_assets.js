// One-off: self-host Google Fonts (Fredoka, Nunito, Press Start 2P) + Tailwind CDN script.
// Downloads woff2 files -> fonts/, writes fonts/fonts.css, saves lib/tailwind.js
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const CSS_URLS = [
    'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap',
    'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
];
const KEEP_SUBSETS = ['latin', 'latin-ext']; // game text is EN + CJK-fallback-to-system

(async () => {
    fs.mkdirSync('fonts', { recursive: true });
    fs.mkdirSync('lib', { recursive: true });

    let outCss = '/* Self-hosted Google Fonts (downloaded ' + new Date().toISOString().slice(0, 10) + ') — no external requests */\n';
    const seen = new Set();

    for (const cssUrl of CSS_URLS) {
        const res = await fetch(cssUrl, { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error('CSS fetch failed ' + res.status + ' for ' + cssUrl);
        const css = await res.text();

        // Split into subset-labeled @font-face blocks: /* latin */\n@font-face {...}
        const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[\s\S]*?\})/g;
        let m;
        while ((m = re.exec(css)) !== null) {
            const subset = m[1];
            let block = m[2];
            if (!KEEP_SUBSETS.includes(subset)) continue;
            const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1] || 'font';
            const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1] || '400';
            const url = (block.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
            if (!url) continue;
            const fname = (family.replace(/\s+/g, '') + '-' + weight + '-' + subset + '.woff2');
            if (!seen.has(fname)) {
                seen.add(fname);
                const fres = await fetch(url, { headers: { 'User-Agent': UA } });
                if (!fres.ok) throw new Error('woff2 fetch failed ' + fres.status + ' ' + url);
                const buf = Buffer.from(await fres.arrayBuffer());
                fs.writeFileSync(path.join('fonts', fname), buf);
                console.log('font:', fname, Math.round(buf.length / 1024) + 'KB');
            }
            block = block.replace(/url\(https:[^)]+\)/, "url('" + fname + "')");
            outCss += '/* ' + subset + ' */\n' + block + '\n';
        }
    }
    fs.writeFileSync('fonts/fonts.css', outCss);
    console.log('fonts/fonts.css written,', seen.size, 'font files');

    // Tailwind play CDN script
    const t = await fetch('https://cdn.tailwindcss.com', { headers: { 'User-Agent': UA } });
    if (!t.ok) throw new Error('tailwind fetch failed ' + t.status);
    const tbuf = Buffer.from(await t.arrayBuffer());
    fs.writeFileSync('lib/tailwind.js', tbuf);
    console.log('lib/tailwind.js written,', Math.round(tbuf.length / 1024) + 'KB');
    console.log('DONE');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
