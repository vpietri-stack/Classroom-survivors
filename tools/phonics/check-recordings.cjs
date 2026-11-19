const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const {execFileSync} = require('child_process');
const {chromium} = require('playwright-core');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(root, '.checks/phonics-recordings');
process.chdir(root);
fs.mkdirSync(out, {recursive:true});
const sandbox = {window:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync('phonics_content.js','utf8'), sandbox);
const pages = Object.values(sandbox.window.PhonicsContent.pages), cases = [];
const rates = [0.8, 1, 1.2];
function recorderWav(file) {
 const input=fs.readFileSync(file);let format,data;
 for(let i=12;i+8<=input.length;){const tag=input.toString('ascii',i,i+4),size=input.readUInt32LE(i+4);if(i+8+size>input.length)throw Error('Truncated WAV');if(tag==='fmt ')format=input.subarray(i+8,i+8+size);if(tag==='data')data=input.subarray(i+8,i+8+size);i+=8+size+(size%2);}
 if(!data||!format||format.readUInt16LE(0)!==1||format.readUInt16LE(2)!==1||format.readUInt32LE(4)!==16000||format.readUInt16LE(14)!==16)throw Error('Unexpected PCM fixture');
 const output=Buffer.alloc(44+data.length);output.write('RIFF',0);output.writeUInt32LE(36+data.length,4);output.write('WAVEfmt ',8);output.writeUInt32LE(16,16);format.copy(output,20,0,16);output.write('data',36);output.writeUInt32LE(data.length,40);data.copy(output,44);fs.writeFileSync(file,output);
}
for (const config of pages) {
  for (const word of config.words) {
    for (const rate of word === 'bag' ? [0.65, ...rates, 1.4] : rates) {
      const file = `${word}-${rate}.wav`, source = config.assetBase + word + '/sequence.mp3';
      if (!fs.existsSync(path.join(out,file)) || fs.statSync(source).mtimeMs > fs.statSync(path.join(out,file)).mtimeMs) execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',source,'-af',`atempo=${rate}`,'-ar','16000','-ac','1','-c:a','pcm_s16le',path.join(out,file)]);
      cases.push({id:`${word}@${rate}`,file,target:`${config.letterName} ${config.soundText} ${word}`,expected:true});
    }
  }
  for (const rate of rates) {
    const file = `letter-${config.letter}-${rate}.wav`;
    if (!fs.existsSync(path.join(out,file)) || fs.statSync(config.assetBase+'letter-sounds.mp3').mtimeMs > fs.statSync(path.join(out,file)).mtimeMs) execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',config.assetBase+'letter-sounds.mp3','-af',`atempo=${rate}`,'-ar','16000','-ac','1','-c:a','pcm_s16le',path.join(out,file)]);
    cases.push({id:`letter-${config.letter}@${rate}`,file,target:`${config.letterName} ${config.letterName} ${config.soundText} ${config.soundText} ${config.soundText}`,expected:true});
  }
}
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','anullsrc=r=16000:cl=mono','-t','3','-c:a','pcm_s16le',path.join(out,'silence.wav')]);
for (const config of pages) {
  const target=`${config.letterName} ${config.soundText} ${config.words[0]}`;
  cases.push({id:`silence-${config.letter}`,file:'silence.wav',target,expected:false});
  const wrong=pages.find(p=>p.letter!==config.letter).words[0];
  cases.push({id:`unrelated-${config.letter}`,file:`${wrong}-1.wav`,target,expected:false});
}
let selected = process.env.PHONICS_CASES ? cases.filter(c=>new RegExp(process.env.PHONICS_CASES).test(c.id)) : cases;
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/harness') {res.setHeader('Content-Type','text/html');return res.end('<script>var SPEECH_PRACTICE_ENABLED=true;</script><script src="/speech_adaptive_app.js"></script>');}
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');
  const range=req.headers.range?.match(/bytes=(\d+)-(\d+)/);let start=0,end=stat.size-1;
  if(range){start=+range[1];end=Math.min(+range[2],end);res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`);}
  res.setHeader('Content-Length',end-start+1);fs.createReadStream(file,{start,end}).pipe(res);
 });
});
(async()=>{
 const sources=JSON.parse(fs.readFileSync('media/phonics/p1-u1/bcd-audio-sources.json'));
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','anoisesrc=r=16000:d=3:c=pink:a=0.02','-ac','1','-c:a','pcm_s16le',path.join(out,'noise.wav')]);
 for(const config of pages){
  const target=`${config.letterName} ${config.soundText} ${config.words[0]}`;
  cases.push({id:`noise-${config.letter}`,file:'noise.wav',target,expected:false,expectedWord:false});
  // Use reviewed source boundaries, not the final energy island (which can be
  // just a word's final consonant and accidentally leave its initial in place).
  // Apple source: ah ends at1.73s; apple begins at2.63s in sequence.mp3.
  const source=sources[config.words[0]];
  const end=source?source.blocks.at(-1)[0]-source.sequenceClip[0]-0.12:2.2;
  for(const other of pages.filter(p=>p.letter!==config.letter)){
   const file=`wrong-initial-${config.letter}-${other.letter}.wav`;
   execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(out,config.words[0]+'-1.wav'),'-i',other.assetBase+other.words[0]+'/word.mp3','-filter_complex',`[0:a]atrim=end=${end},asetpts=PTS-STARTPTS[p];[1:a]aresample=16000,aformat=sample_fmts=s16:channel_layouts=mono[w];[p][w]concat=n=2:v=0:a=1[o]`,'-map','[o]','-ar','16000','-ac','1','-c:a','pcm_s16le',path.join(out,file)]);
   cases.push({id:`wrong-initial-${config.letter}-${other.letter}`,file,target,prefixEnd:end,replacement:other.words[0],expected:false,expectedWord:false});
  }
 }
 selected=process.env.PHONICS_CASES?cases.filter(c=>new RegExp(process.env.PHONICS_CASES).test(c.id)):cases;
 // ffmpeg includes optional metadata chunks; Recorder emits a44-byte PCM header.
 // Match it exactly so the application sees samples, never file metadata as audio.
 for(const file of new Set(selected.map(c=>c.file)))recorderWav(path.join(out,file));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const results=[];let blocked=0;
 try {
  const context=await browser.newContext();
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():(blocked++,r.abort()));
  const page=await context.newPage();page.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await page.goto(base+'/harness');
  console.log('Loading real local WASM worker');
  await page.evaluate(()=>AdaptiveSpeech.load());console.log('READY');
  for(const c of selected){
   const started=Date.now();
   const r=await page.evaluate(async c=>{try{const blob=await(await fetch('/.checks/phonics-recordings/'+c.file)).blob();return await AdaptiveSpeech.transcribe(blob,{target:c.target,assessmentProfile:'phonics1-initial'});}catch(e){return {error:e.message,code:e.code};}},c);
   const all=!!r.targetWords?.length&&r.targetWords.every(w=>w.heardClear===true);
   const row={...c,all,pass:all===c.expected&&!r.error&&(c.expectedWord!==false||r.targetWords?.at(-1)?.heardClear===false),ms:Date.now()-started,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(out,c.file))).digest('hex'),...r};results.push(row);
   console.log(JSON.stringify({id:c.id,pass:row.pass,green:r.targetWords?.map(w=>w.heardClear),text:r.text,error:r.error,ms:row.ms}));
   fs.writeFileSync(path.join(out,process.env.PHONICS_REPORT||'baseline.json'),JSON.stringify({createdAt:new Date().toISOString(),blocked,results},null,2));
  }
  console.log('SUMMARY',JSON.stringify({cases:results.length,passed:results.filter(r=>r.pass).length,blocked,report:path.join(out,process.env.PHONICS_REPORT||'baseline.json')}));
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
