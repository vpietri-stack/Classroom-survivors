const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright-core');
const ROOT=__dirname;
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.bin':'application/octet-stream'};
const files=new Set(['handwriting_preview.html','handwriting_preview.css','handwriting_preview.js','handwriting_preview_sw.js','handwriting.js','study_mode.js','style.css','handwriting_recognition.js',...fs.readdirSync(path.join(ROOT,'handwriting_model')).map(f=>'handwriting_model/'+f),...fs.readdirSync(path.join(ROOT,'fonts')).map(f=>'fonts/'+f)]);
function server(){return http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.replace(/^\/sub\//,'');if(!files.has(name)){res.writeHead(404);return res.end();}const body=fs.readFileSync(path.join(ROOT,name));res.writeHead(200,{'Content-Type':TYPES[path.extname(name)]||'application/octet-stream'});res.end(body);});}
async function loadWord(page,word){await page.evaluate(word=>{STUDY_STATE.active=true;STUDY_STATE.round='D';STUDY_STATE.words=[word,'dog'];STUDY_STATE.currentWordIndex=0;STUDY_STATE.isTransitioning=false;previewEvents=[];nextRoundDWord();roundDGapOrder.forEach(i=>roundDSlots[i].gap=false);roundDGapOrder=[0];roundDSlots[0].gap=true;roundDCursor=0;roundDShowTarget();},word);}
async function draw(page,strokes){await page.evaluate(strokes=>{const cv=document.querySelector('.hw-trace-canvas'),r=cv.getBoundingClientRect();const fire=(type,p)=>cv.dispatchEvent(new PointerEvent(type,{clientX:r.x+p[0]*r.width/128,clientY:r.y+p[1]*r.height/128,pointerId:7,bubbles:true,pointerType:'touch'}));for(const s of strokes){fire('pointerdown',s[0]);for(const p of s.slice(1))fire('pointermove',p);fire('pointerup',s[s.length-1]);}},strokes);}
(async()=>{
 const app=server();await new Promise(r=>app.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.address().port+'/sub/handwriting_preview.html';
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let checks=0;const errors=[],external=[];
 function check(condition,message){assert.ok(condition,message);checks++;console.log('PASS: '+message);}
 try{
  let modelDownloads=0;
  const context=await browser.newContext({viewport:{width:390,height:844}});context.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());if(r.url().includes('/letters-v2.bin?'))modelDownloads++;});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>HWRecognition.isReady());
  check(await page.evaluate(()=>HWRecognition.isReady()),'Neural worker and checked model initialize under a repository subpath');
  check(await page.evaluate(()=>HWDecision.decide(Array(26).fill(1/26),'7',{minimal:false,rawInkCount:500,baselineAccepted:true},{}).accepted),'Unsupported characters retain their font-checker fallback');
  await page.locator('#preview-start').click();await page.waitForSelector('.hw-trace-canvas');
  check(await page.locator('#handwriting-hint').isDisabled(),'Hint starts locked before writing effort');
  await page.evaluate(()=>showRoundDHint());check(await page.evaluate(()=>!roundDGuided&&!roundDHadHelp),'Direct hint handler cannot bypass the initial lock');
  await loadWord(page,'i');
  await draw(page,[[[40,70]]]);await page.waitForTimeout(900);
  await draw(page,[[[70,70]]]);await page.waitForTimeout(900);
  check(await page.evaluate(()=>roundDEffortAttempts===0&&!roundDGuided)&&await page.locator('#handwriting-hint').isDisabled(),'Two taps do not unlock or show guides');
  await page.evaluate(()=>clearRoundD());
  await draw(page,[[[64,55],[64,65],[64,75],[64,90],[64,102]]]);await page.waitForTimeout(900);
  check(await page.locator('#handwriting-hint').isDisabled(),'One genuine failed attempt keeps hints locked');
  await page.evaluate(()=>clearRoundD());
  await draw(page,[[[64,55],[64,65],[64,75],[64,90],[64,102]]]);await page.waitForTimeout(900);
  check(await page.locator('#handwriting-hint').isEnabled()&&await page.evaluate(()=>!roundDGuided),'Two genuine attempts unlock optional help without showing it automatically');
  await page.locator('#handwriting-hint').click();check(await page.evaluate(()=>roundDGuided&&roundDHadHelp),'Unlocked hint marks the word assisted');
  await loadWord(page,'i');
  await draw(page,[[[64,55],[64,65],[64,75],[64,90],[64,102]]]);await page.waitForTimeout(900);
  check(await page.evaluate(()=>roundDCursor===0&&roundDTrace.takeTrace().s.length===1),'Uncertain stem stays visible and cannot pass as a dotted i');
  const before=await page.evaluate(()=>roundDAttempts);await page.evaluate(()=>undoRoundD());check(await page.evaluate(()=>roundDTrace.takeTrace().s.length===0&&roundDAttempts===1),'Undo removes a stroke without another attempt');
  await draw(page,[[[64,55],[64,65],[64,75],[64,90],[64,102]]]);await page.waitForTimeout(400);
  check(await page.evaluate(()=>roundDCursor===0),'A normal inter-stroke pause does not advance an unfinished i');
  await draw(page,[[[64,33]]]);await page.waitForTimeout(400);
  check(await page.evaluate(()=>roundDCursor===1),'Adding the dot completes the retained letter');
  await loadWord(page,'o');await draw(page,[[[50,70]]]);await page.waitForTimeout(950);
  check(await page.evaluate(()=>roundDCursor===0&&roundDTrace.takeTrace().s.length===1),'A single dot never passes after normalization');
  await loadWord(page,'i');
  await page.evaluate(()=>{const cv=document.querySelector('.hw-trace-canvas'),r=cv.getBoundingClientRect();for(const [type,y] of [['pointerdown',30],['pointerup',100]])cv.dispatchEvent(new PointerEvent(type,{clientX:r.x+r.width/2,clientY:r.y+y*r.height/128,pointerId:8,bubbles:true}));});
  check(await page.evaluate(()=>roundDTrace.takeTrace().s[0].length===4),'Fast down/up movement retains its endpoint without a pointermove event');
  await loadWord(page,'o');
  await page.evaluate(()=>{window.__oldVerify=HWRecognition.verify;HWRecognition.verify=()=>new Promise(resolve=>window.__lateRecognition=resolve);});
  await draw(page,[[[40,60],[50,65],[60,70],[70,80]]]);await page.waitForTimeout(220);await page.locator('#handwriting-skip').click();
  await page.evaluate(()=>window.__lateRecognition({accepted:true,model:'delayed-test'}));await page.waitForTimeout(400);
  check(await page.evaluate(()=>STUDY_STATE.currentWordIndex===1&&roundDCursor===0&&previewEvents.length===0),'A late neural result after skip cannot fill the next word or award completion');
  await page.evaluate(()=>HWRecognition.verify=window.__oldVerify);
  await loadWord(page,'o');await page.evaluate(()=>{HWRecognition.verify=()=>new Promise(resolve=>window.__lateRecognition=resolve);});await draw(page,[[[40,60],[50,65],[60,70],[70,80]]]);await page.waitForTimeout(220);
  await page.evaluate(()=>{roundDTrace.destroy();roundDTrace=null;STUDY_STATE.active=false;window.__lateRecognition({accepted:true});});await page.waitForTimeout(200);
  check(await page.evaluate(()=>roundDCursor===0&&previewEvents.length===0),'Destroyed canvas ignores a late inference result');
  await page.evaluate(()=>HWRecognition.verify=window.__oldVerify);
  await page.setViewportSize({width:320,height:760});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Phone layout fits 320 pixels');
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);check(modelDownloads===1,'First visit downloads the model once; offline setup reuses the checked cache');await context.setOffline(true);await page.reload();await page.waitForFunction(()=>HWRecognition.isReady());
  check(await page.evaluate(()=>HWRecognition.isReady()),'Preview reloads and recognizes with the network offline');await context.setOffline(false);
  check(external.length===0,'No external scripts, fonts or recognition requests');check(errors.length===0,'No browser runtime errors');
  await context.close();
  const unavailable=await browser.newContext();await unavailable.route('**/handwriting_model/letters-v2.bin*',r=>r.abort());const fallback=await unavailable.newPage();await fallback.goto(url);await fallback.waitForFunction(()=>document.getElementById('model-status').textContent.includes('暂未加载'),{timeout:15000});await fallback.locator('#preview-start').click();await fallback.waitForSelector('#handwriting-skip');check(await fallback.locator('#handwriting-skip').isEnabled()&&await fallback.locator('#handwriting-hint').isDisabled(),'Failed first download keeps skip usable and preserves the guide lock');await unavailable.close();
  console.log(checks+' neural/browser checks passed');
 }finally{await browser.close();await new Promise(r=>app.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
