(() => {
  'use strict';
  const base='media/phonics/p1-u1-picture-book/';
  const $=id=>document.getElementById(id),audio=new Audio(),cache=new Map();
  const papers=Array.from({length:5},(_,i)=>{const sound=new Audio(base+`paper-turn-soft-${i+1}.mp3`);sound.preload='auto';return sound});
  let paper=null,paperBag=[],lastPaper=-1;
  function rustle(duration){
    if(paper){paper.pause();paper.currentTime=0}
    if(!paperBag.length){
      paperBag=papers.map((_,i)=>i);
      for(let i=paperBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[paperBag[i],paperBag[j]]=[paperBag[j],paperBag[i]]}
      if(paperBag.at(-1)===lastPaper)[paperBag[0],paperBag[paperBag.length-1]]=[paperBag.at(-1),paperBag[0]];
    }
    lastPaper=paperBag.pop();paper=papers[lastPaper];paper.volume=.42+Math.random()*.08;paper.playbackRate=1800/duration;
    paper.play().catch(()=>{});
  }
  const sheet=$('sheet'),book=$('book'),art=$('art'),caption=$('text');
  let pages=[],index=0,turning=false,continuous=false,epoch=0,reachedEnd=false;
  const query=new URLSearchParams(location.search),startPractice=$('start-practice');
  const embedded=query.get('embed')==='1'&&parent!==window,review=query.get('mode')==='review';
  window.InteractiveNotesPOC={pause:stop};
  if(embedded){
    startPractice.textContent=review?'返回主界面':'开始练习';
    startPractice.onclick=event=>{event.preventDefault();if(!reachedEnd||turning)return;stop();parent.postMessage({action:review?'close-note':'start-note-study',request:query.get('request')},location.origin);};
    window.addEventListener('message',event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.request===query.get('request')&&event.data.action==='note-study-error')$('status').textContent='暂时无法开始练习，请返回主界面再试一次。';});
  }else startPractice.textContent='返回完整应用，开始练习';
  function preload(i){
    if(!pages[i])return Promise.resolve();
    const src=base+pages[i].image;
    if(!cache.has(src))cache.set(src,new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>{cache.delete(src);resolve(false)};image.src=src}));
    return cache.get(src);
  }
  function buttons(){
    $('previous').disabled=turning||index===0;$('next').disabled=turning||index===pages.length-1;
    $('listen').disabled=$('read-all').disabled=turning||!pages.length;
    $('read-all').setAttribute('aria-pressed',String(continuous));
    $('replay').disabled=turning||!pages.length;
    startPractice.hidden=!reachedEnd;startPractice.setAttribute('aria-disabled',String(turning));
    $('stop').disabled=audio.paused&&!continuous;
  }
  function draw(i){
    index=i;const page=pages[i];art.src=base+page.image;art.alt=page.text;caption.textContent=page.text;
    if(i===pages.length-1)reachedEnd=true;
    $('nowPlaying').textContent=page.text;$('meaning').textContent=page.meaning;
    window.dispatchEvent(new CustomEvent('notes-select',{detail:{id:'picture-book-'+page.page,text:page.text,pictureBookPage:page.page}}));
    $('position').textContent=`${i+1} / ${pages.length}`;preload(i+1);preload(i-1);buttons();
  }
  function stop(){epoch++;continuous=false;audio.pause();if(paper){paper.pause();paper.currentTime=0}buttons();$('status').textContent='点图片或句子，听故事。';}
  async function play(){
    if(!pages[index]||turning)return;
    if(paper){paper.pause();paper.currentTime=0}
    window.dispatchEvent(new CustomEvent('notes-select',{detail:{id:'picture-book-'+pages[index].page,text:pages[index].text,pictureBookPage:pages[index].page}}));
    const ticket=++epoch;audio.pause();audio.src=base+pages[index].narration;audio.playbackRate=1;
    $('status').textContent='正在播放故事…';
    try{await audio.play();if(ticket===epoch)buttons()}
    catch(_){if(ticket===epoch){continuous=false;$('status').textContent='请点“听这一页”播放故事。';buttons()}}
  }
  async function turn(i,fromReading=false){
    if(turning||i<0||i>=pages.length||i===index)return;
    window.NotesSpeech?.dispose();turning=true;if(!fromReading){epoch++;continuous=false}audio.pause();buttons();
    const motion=window.PictureBookTurn?.chooseMotion()||{duration:1800};
    rustle(motion.duration);
    const ready=await preload(i);
    if(!ready){turning=false;draw(index);$('status').textContent='图片暂时无法加载，请再翻一次。';buttons();return}
    const forward=i>index;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!reduced&&window.PictureBookTurn){
      try{
        const captured=await PictureBookTurn.capture(sheet,forward?null:{src:base+pages[i].image,text:pages[i].text});
        if(forward)draw(i);
        await PictureBookTurn.animate(book,captured,!forward,motion);
        if(!forward)draw(i);
      }catch(_){book.querySelectorAll('.paper-curl').forEach(element=>element.remove());draw(i)}
    }else{
      if(sheet.animate)try{await sheet.animate([{opacity:1},{opacity:.3}],{duration:100}).finished}catch(_){}
      draw(i);
    }
    turning=false;buttons();$('status').textContent='点图片或句子，听故事。';
    if(fromReading&&continuous)play();
  }
  $('previous').onclick=()=>turn(index-1);$('next').onclick=()=>turn(index+1);
  $('replay').onclick=()=>{continuous=false;play()};
  $('listen').onclick=()=>{continuous=false;play()};$('read-all').onclick=()=>{continuous=true;play()};$('stop').onclick=stop;
  art.onclick=caption.onclick=()=>{continuous=false;play()};
  audio.addEventListener('ended',()=>{if(continuous&&index<pages.length-1)turn(index+1,true);else{continuous=false;buttons();$('status').textContent='这一页读完了。可以再听一次。'}});
  audio.addEventListener('error',()=>{continuous=false;buttons();$('status').textContent='录音暂时无法加载，请再点一次试听。'});
  document.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();turn(index+1)}if(event.key==='ArrowLeft'){event.preventDefault();turn(index-1)}});
  let start=null;art.addEventListener('touchstart',event=>{start=event.touches[0].clientX},{passive:true});art.addEventListener('touchend',event=>{if(start===null)return;const delta=event.changedTouches[0].clientX-start;start=null;if(Math.abs(delta)>55)turn(index+(delta<0?1:-1))},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',stop);
  Promise.resolve().then(async()=>{pages=PhonicsPictureBookContent.pages;await preload(0);draw(0)}).catch(()=>{caption.textContent='Please reload to open the story.'});
})();
