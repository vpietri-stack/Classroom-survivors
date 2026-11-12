(function () {
  'use strict';
  const lesson = parent !== window && parent.WorkYourBody || window.WorkYourBody, $ = id => document.getElementById(id);
  if (parent === window || !parent.PreviewNotes?.isReader(window)) { location.replace('index.html'); return; }
  const q = new URLSearchParams(location.search), request = q.get('request'), review = q.get('mode') === 'review';
  const action = $('reader-study-start'); action.textContent = review ? '返回主界面' : '开始学习';
  let audio, clipUrl, current, bundle, index, generation=0;
  action.onclick = () => { stop(); if (!review) action.disabled = true; parent.postMessage({action:review?'close-note':'start-note-study',request},location.origin); };
  window.addEventListener('message', e => { if(e.source===parent && e.origin===location.origin && e.data?.request===request && e.data.action==='note-study-error') action.disabled=false; });
  function fetchAsset(path) { const direct=fetch(path).then(r=>{if(!r.ok)throw Error('unavailable');return r.arrayBuffer()}); const cache=parent.AssetCache; if(!cache)return direct; return new Promise((resolve,reject)=>{let fails=0;const fail=()=>{if(++fails===2)reject(Error('unavailable'))};direct.then(resolve,fail);cache.getBlobUrl(path).then(url=>{if(!url)throw Error('unavailable');return fetch(url).then(r=>r.arrayBuffer())}).then(resolve,fail)}); }
  async function prefetch() { if(!bundle)bundle=fetchAsset('pu3_u3_p36_story_assets/sentences-v2.bin').catch(error=>{bundle=null;throw error}); if(!index)index=fetchAsset('pu3_u3_p36_story_assets/sentence-index-v2.json').then(bytes=>JSON.parse(new TextDecoder().decode(bytes))).catch(error=>{index=null;throw error}); return Promise.all([bundle,index]); }
  function stop(){generation++;if(audio){audio.pause();audio=null}if(clipUrl){URL.revokeObjectURL(clipUrl);clipUrl=null}$('stop').disabled=true;}
  async function play(text,zh,source,clip){ stop(); const ticket=generation; current={text,zh,source,clip}; window.dispatchEvent(new CustomEvent('notes-select',{detail:{id:source||String(clip),text}})); $('nowPlaying').textContent=text; $('playerStatus').textContent=zh; $('stop').disabled=false; $('replay').disabled=false;
    try {
      if (clip) {
        const [bytes,map] = await prefetch();
        if (ticket !== generation) return;
        const [offset,length] = map[clip];
        source = clipUrl = URL.createObjectURL(new Blob([bytes.slice(offset,offset+length)],{type:'audio/mpeg'}));
      }
      audio = new Audio(source);
      audio.playbackRate = Number($('speed').value);
      const cached = clip ? null : parent.AssetCache?.getBlobUrl(source).catch(() => null);
      try {
        await audio.play();
      } catch (error) {
        if (ticket !== generation) return;
        const fallback = await cached;
        if (ticket !== generation) return;
        if (!fallback) throw error;
        audio.src = fallback;
        await audio.play();
      }
    } catch (_) {
      if (ticket === generation) $('playerStatus').textContent = '音频正在加载，请再试一次。';
    }
  }
  $('stop').onclick=stop; $('replay').onclick=()=>{if(current)play(current.text,current.zh,current.source,current.clip)}; $('speed').onchange=()=>{if(audio)audio.playbackRate=Number($('speed').value)}; window.InteractiveNotesPOC={pause:stop};
  function setImage(img, path) {
    img.dataset.path = path;
    img.src = path;
    parent.AssetCache?.getBlobUrl(path).then(url => {
      if (url && (!img.complete || !img.naturalWidth)) img.src = url;
    }).catch(() => {});
  }
  const vocabularyObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(({target, isIntersecting}) => {
      if (!isIntersecting) return;
      vocabularyObserver.unobserve(target);
      setImage(target, target.dataset.path);
    });
  }, {rootMargin: '350px'}) : null;
  for (const [text, zh, , path] of lesson.words) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.onclick = () => play(text, zh, lesson.wordAudio(text));
    const img = document.createElement('img');
    img.alt = '';
    img.width = 320;
    img.height = 236;
    if (vocabularyObserver) {
      img.dataset.path = path;
      vocabularyObserver.observe(img);
    } else setImage(img, path);
    const en = document.createElement('strong');
    en.textContent = text;
    const cn = document.createElement('span');
    cn.textContent = zh;
    card.append(img, en, cn);
    $('cards').append(card);
  }
  function loadStory(img){const path=img.dataset.path;img.src=path;try{parent.AssetCache?.getBlobUrl(path).then(url=>{if(url&&(!img.complete||!img.naturalWidth))img.src=url})}catch(_){}}
  const storyObserver='IntersectionObserver' in window ? new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){storyObserver.unobserve(e.target);loadStory(e.target)}}),{rootMargin:'500px'}) : null;

  lesson.sections.forEach((part,i) => {
    const box = document.createElement('section'); box.className = i > 1 ? 'race-part pose-part' : 'race-part';
    const scan = document.createElement('div'); scan.className = 'story-scan';
    const img = document.createElement('img'); [img.width,img.height] = part.dimensions;
    img.dataset.path = 'pu3_u3_p36_story_assets/story-' + (i+1) + '.webp';
    img.alt = part.title; img.loading = 'lazy'; scan.append(img);
    part.sentences.forEach(s => s.hotspots.forEach(([x,y,w,h], j) => {
      const tap = document.createElement('button'); tap.type = 'button'; tap.className = 'story-tap';
      tap.setAttribute('aria-label',s.text); if(j) tap.tabIndex = -1;
      const [width,height] = part.dimensions;
      Object.assign(tap.style,{left:100*x/width+'%',top:100*y/height+'%',width:100*w/width+'%',height:100*h/height+'%'});
      tap.onclick = () => {
        scan.closest('#parts').querySelectorAll('.story-tap.active').forEach(b => b.classList.remove('active'));
        scan.querySelectorAll('[data-clip="'+s.clip+'"]').forEach(b => b.classList.add('active'));
        play(s.text,s.zh,null,s.clip);
      };
      tap.dataset.clip = s.clip; scan.append(tap);
    }));
    box.append(scan); $('parts').append(box);
    if(storyObserver) storyObserver.observe(img); else loadStory(img);
  });
  if('IntersectionObserver'in window){const o=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){prefetch().catch(()=>{});o.disconnect()}},{rootMargin:'500px'});o.observe($('article'));}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
})();
