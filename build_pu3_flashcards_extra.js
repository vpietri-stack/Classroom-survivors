// The second, teacher-requested PU3 batch. Keeps all 35 approved PNGs intact.
// Set NODE_PATH to the bundled workspace Node modules, then:
// node build_pu3_flashcards_extra.js [local-source-manifest.json]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const sharp = require('sharp');
const { chromium } = require('playwright-core');
const ROOT = __dirname, OUT = path.join(ROOT, 'outputs', 'pu3-flashcards');
const WORDS = ['who','what','when','where','which','why','could',"couldn't",'language','information','topic','want','need'];
const DRAWN = ['when','language','information','topic'];
const sources = JSON.parse(fs.readFileSync(process.argv[2] || path.join(OUT,'extra-sources.local.json'),'utf8').replace(/^\uFEFF/,''));
assert.equal(sources.length,9);
assert.equal(new Set(sources.map(x=>x.word)).size,9);
assert.ok(sources.every(x=>WORDS.includes(x.word)&&!DRAWN.includes(x.word)));
const original = JSON.parse(fs.readFileSync(path.join(OUT,'manifest.json'),'utf8'));
assert.equal(original.length,35);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalHashes = original.map(x=>[x.filename,hash(path.join(ROOT,'images','vocab',x.filename))]);
const rationales = {
    who:'Human identities with a question mark on a blank face; distinguishes person from thing/place/time.',
    what:'Unknown thing in a mystery box; miscellaneous possible objects, with no choice being selected.',
    where:'Question-mark location pin on a folded map; location rather than time or identity.',
    which:'A hand hesitates among three matching backpacks; a choice from a known set, unlike what.',
    why:'Tipped bottle causes a puddle; question mark and cause→effect arrow focus on the reason.',
    could:'Older character remembers the same younger self cycling successfully; memory bubble plus green tick.',
    "couldn't":'Same older/younger characters and bicycle; remembered difficulty balancing, feet down and red cross.',
    want:'Optional desire for a toy is highlighted; essential water is shown beside it for contrast.',
    need:'Essential water for a thirsty child is highlighted; optional toy desire remains beside it.',
};

(async()=>{
    const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
    try{
        const page=await browser.newPage();
        const diagrams=await page.evaluate(()=>{
            const cards=[],INK='#3d3029',BLUE='#388cc9',ORANGE='#f4ad47',TEAL='#279d8f';
            let c,o;
            function start(){c=document.createElement('canvas');c.width=c.height=512;o=c.getContext('2d');o.fillStyle='#fff';o.fillRect(0,0,512,512);o.lineCap=o.lineJoin='round';}
            function box(x,y,w,h,fill='#fff',stroke=INK,lw=6,r=18){o.beginPath();o.roundRect(x,y,w,h,r);o.fillStyle=fill;o.fill();if(stroke){o.strokeStyle=stroke;o.lineWidth=lw;o.stroke();}}
            function line(x,y,x2,y2,col=INK,lw=6){o.beginPath();o.moveTo(x,y);o.lineTo(x2,y2);o.strokeStyle=col;o.lineWidth=lw;o.stroke();}
            function circle(x,y,r,fill,stroke=INK,lw=5){o.beginPath();o.arc(x,y,r,0,Math.PI*2);o.fillStyle=fill;o.fill();if(stroke){o.strokeStyle=stroke;o.lineWidth=lw;o.stroke();}}
            function text(s,x,y,size=40,col=INK){o.font='bold '+size+'px Arial,"Yu Gothic","Microsoft YaHei",sans-serif';o.textAlign='center';o.textBaseline='middle';o.fillStyle=col;o.fillText(s,x,y);}
            function clock(x,y,r){circle(x,y,r,'#fff',BLUE,8);for(let a=0;a<12;a++){const t=a*Math.PI/6;line(x+Math.sin(t)*r*.79,y-Math.cos(t)*r*.79,x+Math.sin(t)*r*.88,y-Math.cos(t)*r*.88,INK,4);}line(x,y,x-r*.39,y-r*.24,INK,8);line(x,y,x+r*.39,y-r*.46,INK,7);circle(x,y,6,INK,null);}
            function bubble(x,y,w,h,fill,side='left'){box(x,y,w,h,fill,INK,5,22);o.beginPath();const tx=side==='left'?x+w*.25:x+w*.75;o.moveTo(tx-15,y+h-3);o.lineTo(tx-9,y+h+24);o.lineTo(tx+21,y+h-3);o.fillStyle=fill;o.fill();o.strokeStyle=INK;o.lineWidth=5;o.stroke();}
            function planet(x,y,r,col=ORANGE){circle(x,y,r,col,INK,4);o.save();o.translate(x,y);o.rotate(-.45);o.beginPath();o.ellipse(0,0,r*1.5,r*.38,0,0,Math.PI*2);o.strokeStyle=INK;o.lineWidth=5;o.stroke();o.restore();}
            function person(x,y,color){circle(x,y,24,'#ffd5b3');o.beginPath();o.arc(x,y-4,24,Math.PI,Math.PI*2);o.fillStyle='#524037';o.fill();box(x-34,y+29,68,55,color,INK,4,18);circle(x-8,y+1,2,INK,null);circle(x+8,y+1,2,INK,null);o.beginPath();o.arc(x,y+7,7,0,Math.PI);o.fillStyle='#a15443';o.fill();}
            function save(word,rationale){cards.push({word,png:c.toDataURL('image/png'),rationale});}

            start();box(47,48,310,350,'#fff8ec',INK,8,24);box(47,48,310,78,'#e66b58',null,0,22);
            line(113,24,113,79,'#8c9ba7',13);line(288,24,288,79,'#8c9ba7',13);
            text('?',202,258,180,BLUE);clock(367,366,103);
            save('when','A question on a calendar plus a clock asks about time; distinct from a map/location question.');

            start();bubble(30,22,410,121,'#e7f4ff');text('Bonjour',235,83,64,BLUE);
            bubble(166,185,310,115,'#fff0cd','right');text('Hola',321,244,72,'#ae6b21');
            bubble(20,350,470,119,'#e3f7ee');text('こんにちは',255,411,63,TEAL);
            save('language','Speech bubbles say hello in French, Spanish and Japanese; no English or Chinese greetings, target word or translation.');

            start();box(47,42,418,430,'#f7fbff',INK,7,24);
            circle(122,115,50,BLUE,null);text('i',122,115,78,'#fff');
            line(203,93,418,93,'#aac6d9',10);line(203,123,367,123,'#c9dce8',8);
            // Three useful facts, not a blank question or a single clock/calendar.
            o.beginPath();o.moveTo(119,258);o.bezierCurveTo(104,243,88,229,88,212);o.bezierCurveTo(88,171,150,171,150,212);o.bezierCurveTo(150,229,134,243,119,258);o.fillStyle='#70ba90';o.fill();o.strokeStyle=INK;o.lineWidth=5;o.stroke();circle(119,212,9,'#fff',null);text('1 km',304,226,48,TEAL);
            clock(119,323,34);text('9:00',304,325,48,BLUE);
            circle(119,414,20,'#ffcb58','#d9a337',4);for(let a=0;a<8;a++){const t=a*Math.PI/4;line(119+Math.cos(t)*28,414+Math.sin(t)*28,119+Math.cos(t)*36,414+Math.sin(t)*36,'#d9a337',4);}text('24°C',304,417,48,'#b4781c');
            save('information','A recognisable blue information symbol and a facts display with distance, time and weather. Supports the abstract idea of useful facts.');

            start();box(37,24,438,181,'#fff9ef',INK,6,20);
            circle(112,114,57,'#ffe0a5','#df9740',6);planet(112,114,27);
            circle(257,114,46,'#edf1f4','#bac6cf',4);
            // Cat topic icon.
            o.beginPath();o.moveTo(232,112);o.lineTo(232,82);o.lineTo(250,95);o.lineTo(267,95);o.lineTo(282,82);o.lineTo(283,112);o.quadraticCurveTo(257,144,232,112);o.fillStyle='#afc5b7';o.fill();o.strokeStyle=INK;o.lineWidth=4;o.stroke();circle(248,110,3,INK,null);circle(268,110,3,INK,null);
            circle(401,114,46,'#edf1f4','#bac6cf',4);circle(401,114,26,'#e7c19c',INK,4);line(375,114,427,114,INK,3);line(401,88,401,140,INK,3);
            o.setLineDash([8,9]);line(112,177,112,238,ORANGE,6);line(112,222,374,222,ORANGE,6);line(374,222,374,238,ORANGE,6);o.setLineDash([]);
            bubble(35,246,180,110,'#fff0d2');planet(125,297,26);
            bubble(297,246,180,110,'#fff0d2','right');planet(387,297,26);
            person(116,404,'#8cc8df');person(390,404,'#a3d4b5');
            save('topic','A selected subject (space, among animals/sport) is repeated in both speakers’ bubbles: the thing their conversation is about.');
            return cards;
        });
        const newCards=[];
        async function write(word,buffer,meta){
            assert.ok(WORDS.includes(word));let chosen;
            for(const size of [512,448,384,320,288,256]){
                const png=await sharp(buffer).resize(size,size,{fit:'contain',background:'#fff'}).png({palette:true,colours:256,dither:0,effort:10,compressionLevel:9}).toBuffer();
                if(png.length<100000){chosen={png,size};break;}
            }
            assert.ok(chosen,'Cannot meet byte cap: '+word);
            const filename=word.trim().toLowerCase().replace(/ /g,'-')+'.png';
            fs.writeFileSync(path.join(ROOT,'images','vocab',filename),chosen.png);
            newCards.push({word,filename,bytes:chosen.png.length,size:chosen.size,...meta});
        }
        for(const s of sources)await write(s.word,fs.readFileSync(s.source),{method:'built-in image_gen',prompt:s.prompt,rationale:rationales[s.word]});
        for(const d of diagrams)await write(d.word,Buffer.from(d.png.split(',')[1],'base64'),{method:'canvas diagram',rationale:d.rationale});
        assert.equal(newCards.length,13);
        const sorted=WORDS.map(w=>newCards.find(c=>c.word===w));assert.ok(sorted.every(Boolean));
        for(const [file,sha]of originalHashes)assert.equal(hash(path.join(ROOT,'images','vocab',file)),sha,'Preserved approved card '+file);
        fs.writeFileSync(path.join(OUT,'extra-manifest.json'),JSON.stringify(sorted,null,2)+'\n');
        const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
        const all=[...original.map(x=>({...x,batch:'first'})),...sorted.map(x=>({...x,batch:'new'}))];
        const tiles=all.map(m=>`<article data-word="${esc(m.word)}" data-batch="${m.batch}"><h2>${esc(m.word)}</h2><div class="sizes"><figure><img src="../../images/vocab/${esc(m.filename)}" width="80" height="80"><figcaption>80 px</figcaption></figure><figure><img src="../../images/vocab/${esc(m.filename)}" width="140" height="140"><figcaption>140 px</figcaption></figure></div><p>${esc(m.rationale)}</p><small>${(m.bytes/1000).toFixed(1)} KB · ${m.size}×${m.size}</small></article>`).join('\n');
        fs.writeFileSync(path.join(OUT,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PU3 flashcard review</title><style>body{font:16px system-ui;margin:24px;background:#edf2f7;color:#243449}h1{margin:0 0 10px}nav{display:flex;flex-wrap:wrap;gap:8px}button{padding:12px 16px;border:0;border-radius:10px;background:#d6e4ec;color:#243449;font:inherit;cursor:pointer}button[aria-pressed=true],#blind{background:#216d91;color:white}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:16px;margin-top:20px}article{background:white;padding:18px;border-radius:16px;box-shadow:0 3px 12px #24344912}h2{font-size:20px;margin:0 0 12px}.sizes{display:flex;gap:14px;align-items:center;justify-content:center;height:165px}figure{margin:0;text-align:center}img{object-fit:contain}figcaption,small{color:#667788;font-size:12px}p{font-size:14px;min-height:52px}body.blind article h2,body.blind article p,body.blind article small{visibility:hidden}[hidden]{display:none!important}</style><h1>PU3 flashcards · 48 cards</h1><p>13 new cards and the 35 approved cards. Hide meanings to judge the pictures without labels.</p><nav><button data-filter="new">New 13</button><button data-filter="first">First 35</button><button data-filter="all">All 48</button><button id="blind" onclick="document.body.classList.toggle('blind')">Hide / show meanings</button></nav><main class="grid">${tiles}</main><script>function filter(kind){document.querySelectorAll('article').forEach(a=>a.hidden=kind!=='all'&&a.dataset.batch!==kind);document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===kind)));}document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>filter(b.dataset.filter));filter(new URLSearchParams(location.search).get('batch')==='all'?'all':'new');</script></html>`);
        console.log(JSON.stringify({newCards:sorted.length,allCards:all.length,maxNewBytes:Math.max(...sorted.map(x=>x.bytes)),approved35Unchanged:true,cards:sorted.map(x=>({word:x.word,bytes:x.bytes,size:x.size}))},null,2));
    }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
