// PU3 flashcards: accurate diagrams + size-limited copies of imagegen originals.
// node build_pu3_flashcards.js [outputs/pu3-flashcards/sources.local.json]
// Original generated files stay in Codex's generated_images folder. The local
// source manifest is deliberately not part of the published prompt/QA manifest.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
// Authoring-only image encoder; available in the bundled workspace Node runtime.
// If needed, set NODE_PATH to that runtime's node_modules directory.
const sharp = require('sharp');
const ROOT = __dirname;
const OUT = path.join(ROOT, 'outputs', 'pu3-flashcards');
const sourcesFile = process.argv[2] || path.join(OUT, 'sources.local.json');
const generated = JSON.parse(fs.readFileSync(sourcesFile, 'utf8').replace(/^\uFEFF/, ''));
const EXPECTED = ['plastic','timetable','tent','pyjamas','suitcase','sandcastle','postcard','stamp','pack','tour','holiday','forget','remember','frightening','surprising','worrying','often','sometimes','never','once','twice','before','after','yesterday','last night','last week','better','worse','more','most','least','one of the','as','not as','made of'];
const GENERATED_WORDS = EXPECTED.filter(w => !['timetable','often','sometimes','never','once','twice','before','after','yesterday','last night','last week','better','worse','more','most','least','one of the','as','not as','made of'].includes(w));
if(generated.length!==GENERATED_WORDS.length||new Set(generated.map(s=>s.word)).size!==GENERATED_WORDS.length||generated.some(s=>!GENERATED_WORDS.includes(s.word)))throw Error('Source manifest must contain exactly the fifteen approved illustration words');
const notes = {
    plastic: 'Several molded plastic containers indicate the shared material, not just bottle.',
    tent: 'Poles, pegs and open flap identify a camping tent.',
    pyjamas: 'Matching top/trousers with moon motifs distinguish bedtime clothing.',
    suitcase: 'Wheels and extended handle distinguish travel luggage from a backpack.',
    sandcastle: 'Bucket, spade and loose sand distinguish it from a stone castle.',
    postcard: 'Picture side plus address side distinguish a postcard from a photograph/envelope.',
    stamp: 'Perforated edge and a small stamped envelope show postal use.',
    pack: 'Downward arrow and clothes entering a suitcase distinguish packing from unpacking.',
    tour: 'Circus bus visits several cities; distinct from a single holiday destination.',
    holiday: 'Family leisure at the seaside plus luggage provide holiday context.',
    forget: 'Bag left at home, child at school without it; distinct from remembering before leaving.',
    remember: 'Recalled bag in thought bubble and collection at the door show successful recall.',
    frightening: 'The threatening dog is dominant; the child only explains its effect.',
    surprising: 'An unexpected pop-out event is dominant; the child explains its effect.',
    worrying: 'Approaching storm threatens a future trip; concern about what may happen.',
};

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
    try {
        const page = await browser.newPage();
        const diagrams = await page.evaluate(() => {
            const S = 512, INK = '#3d3029', RED = '#e14343', BLUE = '#3f92d1', TEAL = '#1d9e8f', GOLD = '#ffc44e';
            const results = [];
            let c, o;
            function begin() {
                c = document.createElement('canvas'); c.width = c.height = S; o = c.getContext('2d');
                o.fillStyle = '#fff'; o.fillRect(0, 0, S, S); o.lineCap = o.lineJoin = 'round';
            }
            function box(x, y, w, h, fill = '#fff', stroke = INK, lw = 5, r = 15) {
                o.beginPath(); o.roundRect(x, y, w, h, r); o.fillStyle = fill; o.fill();
                if (stroke) { o.strokeStyle = stroke; o.lineWidth = lw; o.stroke(); }
            }
            function line(x, y, x2, y2, color = INK, w = 6) {
                o.beginPath(); o.moveTo(x, y); o.lineTo(x2, y2); o.strokeStyle = color; o.lineWidth = w; o.stroke();
            }
            function circle(x, y, r, fill, stroke = INK, w = 4) {
                o.beginPath(); o.arc(x, y, r, 0, Math.PI * 2); o.fillStyle = fill; o.fill();
                if (stroke) { o.strokeStyle = stroke; o.lineWidth = w; o.stroke(); }
            }
            function text(s, x, y, size = 30, color = INK) {
                o.font = 'bold ' + size + 'px Arial, sans-serif'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = color; o.fillText(s, x, y);
            }
            function arrow(x, y, x2, y2, color = RED, w = 9) {
                line(x, y, x2, y2, color, w); const a = Math.atan2(y2 - y, x2 - x);
                line(x2, y2, x2 - 21 * Math.cos(a - .6), y2 - 21 * Math.sin(a - .6), color, w);
                line(x2, y2, x2 - 21 * Math.cos(a + .6), y2 - 21 * Math.sin(a + .6), color, w);
            }
            function tick(x, y, s = 16, color = TEAL) { line(x - s, y, x - s / 4, y + s, color, 8); line(x - s / 4, y + s, x + s, y - s, color, 8); }
            function apple(x, y, s = 1) {
                o.save(); o.translate(x, y); o.scale(s, s);
                circle(-9, 3, 21, '#ef6553'); circle(9, 3, 21, '#ef6553');
                o.fillStyle = '#ef6553'; o.fillRect(-12, -15, 24, 35);
                line(0, -15, 4, -29, INK, 5);
                o.beginPath(); o.ellipse(14, -26, 12, 6, -.45, 0, 7); o.fillStyle = '#58ab62'; o.fill();
                o.restore();
            }
            function sun(x, y, r = 22) {
                circle(x, y, r * .7, GOLD, '#e8a62c', 3);
                for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, '#e8a62c', 4); }
            }
            function moon(x, y, r = 25) { circle(x, y, r, '#637bad', null); circle(x + 12, y - 9, r * .8, '#fff', null); }
            function ring(x, y, w, h) { box(x, y, w, h, 'rgba(255,230,165,.3)', RED, 9, 18); }
            function save(word, rationale) { results.push({ word, rationale, png: c.toDataURL('image/png') }); }

            // Same seven opportunities. Large repetition/frequency cues survive 80px.
            for (const [word, selected] of [['often', [0,1,2,4,5]], ['sometimes', [1,5]], ['never', []], ['once', [3]], ['twice', [1,5]]]) {
                begin();
                box(26, 36, 460, 428, '#fff9ec', INK, 6, 22);
                const exact = word === 'once' || word === 'twice';
                text(exact ? selected.length + '×' : word === 'never' ? '0%' : word === 'often' ? '≈70%' : '≈30%', 256, 107, 67, word === 'never' ? RED : TEAL);
                for (let i = 0; i < 7; i++) {
                    const x = 50 + (i%4)*107+(i>3?53:0), y=177+Math.floor(i/4)*116;
                    box(x, y, 87, 95, selected.includes(i) ? '#ffefcf' : '#f0f2f4', '#d5c8b8', 3, 9);
                    text(String(i + 1), x + 16, y + 16, 18, '#8794a1');
                    if (selected.includes(i)) apple(x + 44, y + 53, 1.02); else text('–', x + 44, y + 53, 28, '#a5aeb6');
                }
                box(72, 423, 368, 19, '#e4e8ec', null, 0, 9);
                if (selected.length) box(72, 423, 368 * selected.length / 7, 19, TEAL, null, 0, 9);
                save(word, 'Seven opportunities with larger apple symbols. 1×/2× indicate exact repetition; approximate percentages illustrate often/sometimes, not fixed definitions.');
            }

            for (const word of ['before', 'after']) {
                begin();
                box(30, 130, 190, 245, '#f8fafb', '#c7cdd3', 4);
                box(292, 130, 190, 245, '#f8fafb', '#c7cdd3', 4);
                apple(125, 255, 2.3);
                // A bitten apple stays recognisable; a tiny core resembled an hourglass.
                apple(387, 255, 2.3);
                for(const y of [243,276]) {
                    circle(451,y,24,'#f8fafb',null);
                    o.beginPath();o.arc(451,y,24,Math.PI*.5,Math.PI*1.5);o.strokeStyle=INK;o.lineWidth=6;o.stroke();
                }
                arrow(234, 254, 277, 254, '#8794a1', 7);
                ring(word === 'before' ? 25 : 287, 123, 200, 259);
                text('1', 125, 418, 35, '#8794a1'); text('2', 387, 418, 35, '#8794a1');
                save(word, 'Same whole-apple → bitten-apple timeline; red frame identifies the earlier/later state. Revised to avoid an hourglass-like core.');
            }

            for (const word of ['yesterday', 'last night', 'last week']) {
                begin();
                if (word === 'last week') {
                    box(38, 72, 436, 350, '#fff', INK, 6, 20);
                    for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) {
                        const x = 58 + col * 57, y = 106 + row * 94;
                        box(x, y, 47, 68, row === 1 ? '#eaf6ff' : '#f2f4f5', '#ced7df', 2, 7);
                        text(String(1 + row * 7 + col), x + 23, y + 34, 21);
                    }
                    ring(47, 97, 415, 87);
                    circle(252, 234, 26, '#329b8d', null); text('11', 252, 235, 23, '#fff');
                    text('TODAY', 256, 460, 32, TEAL); arrow(256, 433, 256, 283, TEAL, 5);
                } else {
                    for (let i = 0; i < 3; i++) {
                        const x = 31 + i * 161;
                        box(x, 142, 128, 226, '#fff', INK, 5, 15); box(x, 142, 128, 48, '#e46a58', null, 0, 12);
                        text(String(14 + i), x + 64, 236, 44);
                        if (word === 'last night' && i === 0) moon(x + 64, 312, 27); else sun(x + 64, 312, 22);
                    }
                    ring(24, 135, 142, 241);
                    text('TODAY', 256, 417, 30, TEAL); arrow(256, 391, 256, 370, TEAL, 5);
                }
                save(word, 'Past date/week outlined relative to TODAY; moon distinguishes last night from yesterday.');
            }

            for (const word of ['better', 'worse']) {
                begin();
                for (let i = 0; i < 2; i++) {
                    const x = 36 + i * 250;
                    box(x, 112, 188, 256, '#fffaf0', '#b9c8d1', 5, 18);
                    // Two copies of the same drawing task, not two different objects.
                    o.strokeStyle = '#5d9abd'; o.lineWidth = 7;
                    if (!i) {
                        o.beginPath(); o.moveTo(x+30, 255); o.lineTo(x+45, 196); o.lineTo(x+98, 171); o.lineTo(x+145, 206); o.lineTo(x+137, 288); o.lineTo(x+43, 276); o.lineTo(x+45, 206); o.stroke();
                        line(x+70, 281, x+87, 243, '#5d9abd', 7); line(x+87, 243, x+110, 282, '#5d9abd', 7);
                    } else {
                        o.beginPath(); o.moveTo(x+27, 222); o.lineTo(x+94, 164); o.lineTo(x+161, 222); o.stroke();
                        box(x+44, 222, 103, 76, '#e3f4ff', '#5d9abd', 5, 2); box(x+83, 257, 29, 41, '#ffe39c', '#5d9abd', 4, 1); box(x+56, 235, 23, 21, '#fff', '#5d9abd', 3, 1);
                    }
                    for (let j=0;j<(i?3:1);j++) text('★', x+57+j*36, 330, 27, '#e5a52b');
                }
                ring(word === 'better' ? 279 : 29, 105, 202, 270);
                save(word, 'Same house-drawing task: rough versus accurate, with one versus three stars. Red frame chooses the quality.');
            }

            for (const word of ['more', 'most', 'least']) {
                begin(); const counts = word === 'more' ? [2, 5] : [1, 3, 5];
                const width = counts.length === 2 ? 205 : 144;
                counts.forEach((count, i) => {
                    const x = counts.length === 2 ? 35+i*239 : 24+i*160;
                    box(x, 98, width, 310, '#f3f8fc', '#b9c8d1', 4, 18);
                    for (let j=0;j<count;j++) apple(x+width/2+(j%2?25:-25), 355-Math.floor(j/2)*78, .77);
                    text(String(count), x+width/2, 143, 34, BLUE);
                    if ((word === 'least' && i === 0) || (word !== 'least' && i === counts.length-1)) ring(x-5, 91, width+10, 324);
                });
                save(word, 'More compares two piles; most/least compare three. Highlighted pile encodes the target without printing it.');
            }

            begin();
            box(40,100,432,300,'#f2f8fc','#b9c8d1',5,22);
            for(let i=0;i<6;i++)apple(121+(i%3)*135,204+Math.floor(i/3)*116,1.15);
            circle(256,320,51,'rgba(255,220,130,.2)',RED,9);
            arrow(256,462,256,381,RED,8);
            save('one of the','One highlighted apple remains inside a group of six identical apples; not the largest or a separate object.');

            begin();
            box(44, 58, 424, 388, '#f0f9ff', INK, 6, 25);
            for (let i=0;i<5;i++) {
                text(['Mon','Tue','Wed','Thu','Fri'][i], 147+i*65, 96, 23, BLUE);
                for (let j=0;j<3;j++) {
                    const x=117+i*65,y=130+j*94; box(x,y,60,85,'#fff','#bdcfda',2,7);
                    const type=(i+j)%3;
                    if(type===0) text('123',x+30,y+43,22,INK);
                    else if(type===1) { box(x+11,y+24,38,36,'#ffe0a1',INK,3,2); line(x+30,y+24,x+30,y+60,INK,3); }
                    else {circle(x+30,y+43,20,'#fff',INK,3);circle(x+30,y+43,7,INK,null);for(let a=0;a<5;a++){let rad=a*1.256;line(x+30+Math.cos(rad)*7,y+43+Math.sin(rad)*7,x+30+Math.cos(rad)*17,y+43+Math.sin(rad)*17,INK,2);}}
                }
            }
            ['8:00','9:00','10:00'].forEach((t,i)=>text(t,79,173+i*94,19,INK));
            save('timetable','School subjects against weekdays and lesson times; subject icons distinguish it from a plain calendar.');

            for (const word of ['as', 'not as']) {
                begin();
                line(45, 405, 467, 405, '#a8b6c1', 5);
                const tops = word === 'as' ? [140,140] : [235,140];
                for(let i=0;i<2;i++){
                    const x=90+i*260;box(x,tops[i],70,405-tops[i],i?'#ffd76d':'#76bddb',INK,6,7);
                    for(let y=385;y>tops[i]+10;y-=30)line(x+8,y,x+23,y,INK,3);
                    o.setLineDash([9,9]);line(x-23,tops[i],x+93,tops[i],RED,5);o.setLineDash([]);
                }
                text(word==='as'?'=':'≠',256,280,84,TEAL);
                save(word,'Two rulers share a baseline: equal heights for as, visibly unequal heights for not as.');
            }

            begin();
            // Material callouts, not transformation arrows: composition, not making.
            box(45,105,132,105,'#c98d58',INK,5,8);
            for(let y=126;y<199;y+=26){o.beginPath();o.ellipse(103,y,39,8,0,0,7);o.strokeStyle='#9e643d';o.lineWidth=3;o.stroke();}
            o.setLineDash([9,9]);line(181,162,299,162,RED,6);o.setLineDash([]);
            box(319,80,108,88,'#c98d58',INK,5,5);box(307,176,132,28,'#c98d58',INK,5,5);line(322,204,319,239);line(425,204,429,239);
            box(45,307,132,86,'#bdc9d1',INK,5,8);line(60,325,160,325,'#f4f8fa',8);
            o.setLineDash([9,9]);line(181,351,325,351,RED,6);o.setLineDash([]);
            o.beginPath();o.ellipse(375,322,34,45,0,0,7);o.fillStyle='#bdc9d1';o.fill();o.strokeStyle=INK;o.lineWidth=5;o.stroke();box(365,363,20,84,'#bdc9d1',INK,5,8);
            save('made of','Wood/chair and metal/spoon pairs use dotted material callouts. No transformation arrows that suggest make/build.');
            return results;
        });
        const manifest = [];
        async function persist(word, source, meta) {
            const original=Buffer.from(source.split(',')[1],'base64');
            let output;
            // Only resize/re-encode; generated content is never repainted.
            for(const size of [512,448,384,320,288,256]) {
                const bytes=await sharp(original).resize(size,size,{fit:'contain',background:'#fff'})
                    .png({palette:true,colours:256,dither:0,effort:10,compressionLevel:9}).toBuffer();
                if(bytes.length<100000){output={size,bytes};break;}
            }
            if(!output)throw Error('Cannot meet the 100 KB cap: '+word);
            const filename = word.trim().toLowerCase().replace(/ /g,'-')+'.png';
            const bytes=output.bytes;
            if(bytes.length>=100000)throw Error('Oversized '+word);
            fs.writeFileSync(path.join(ROOT,'images','vocab',filename),bytes);
            manifest.push({word,filename,bytes:bytes.length,size:output.size,...meta});
        }
        for(const src of generated) await persist(src.word,'data:image/png;base64,'+fs.readFileSync(src.source).toString('base64'),{method:'built-in image_gen',prompt:src.prompt,rationale:notes[src.word]});
        for(const d of diagrams)await persist(d.word,d.png,{method:'canvas diagram',rationale:d.rationale});
        if(manifest.length!==EXPECTED.length||EXPECTED.some(w=>!manifest.some(m=>m.word===w)))throw Error('Incomplete approved flashcard set');
        fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
        const tiles=manifest.map(m=>`<article data-word="${m.word}"><h2>${m.word}</h2><div class="sizes"><figure><img src="../../images/vocab/${m.filename}" width="80" height="80"><figcaption>80 px</figcaption></figure><figure><img src="../../images/vocab/${m.filename}" width="140" height="140"><figcaption>140 px</figcaption></figure></div><p>${m.rationale}</p><small>${(m.bytes/1000).toFixed(1)} KB · ${m.size}×${m.size}</small></article>`).join('\n');
        fs.writeFileSync(path.join(OUT,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PU3 flashcard review</title><style>body{font:16px system-ui;margin:24px;background:#edf2f7;color:#243449}h1{margin:0 0 10px}button{padding:12px 18px;border:0;border-radius:10px;background:#216d91;color:white;font:inherit;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:16px;margin-top:20px}article{background:white;padding:18px;border-radius:16px;box-shadow:0 3px 12px #24344912}h2{font-size:20px;margin:0 0 12px}.sizes{display:flex;gap:14px;align-items:center;justify-content:center;height:165px}figure{margin:0;text-align:center}img{object-fit:contain}figcaption,small{color:#667788;font-size:12px}p{font-size:14px;min-height:52px}body.blind h2,body.blind p,body.blind small{visibility:hidden}</style><h1>PU3 flashcards · 35 cards</h1><p>Inspect at the real app sizes. Hide labels to judge the picture before reading its intended meaning.</p><button onclick="document.body.classList.toggle('blind')">Hide / show meanings</button><main class="grid">${tiles}</main></html>`);
        console.log(JSON.stringify({count:manifest.length,maxBytes:Math.max(...manifest.map(x=>x.bytes)),cards:manifest.map(x=>({word:x.word,bytes:x.bytes,size:x.size}))},null,2));
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
