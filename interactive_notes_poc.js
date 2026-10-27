(function () {
  'use strict';
  const lesson = window.InteractiveNotesData;
  const $ = id => document.getElementById(id);
  let current = null, audio = null, generation = 0, playing = false, timer = null;
  function updateActive(id) {
    document.querySelectorAll('.hotspot').forEach(button => {
      button.classList.toggle('active', !!id && button.dataset.clip === id);
      button.setAttribute('aria-pressed', String(!!id && button.dataset.clip === id));
    });
  }
  function stop() {
    generation++; clearTimeout(timer); timer = null;
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
    playing = false; $('stop').disabled = true; updateActive(null);
  }
  function play(id) {
    const clip = lesson.clips[id];
    if (!clip) return;
    stop(); current = id; const token = generation;
    $('nowPlaying').textContent = clip.text;
    $('playerStatus').textContent = '正在播放 · ' + clip.translation;
    $('replay').disabled = false; $('stop').disabled = false;
    playing = true; updateActive(id);
    audio = new Audio(clip.audio); audio.playbackRate = Number($('speed').value);
    function failed() {
      if (token !== generation) return;
      stop(); $('playerStatus').textContent = '这段音频暂时没能播放，请点“再听一次”重试。';
    }
    audio.onended = () => {
      if (token !== generation) return;
      stop(); $('playerStatus').textContent = clip.translation + ' · 还想听就再点一次。';
    };
    audio.onerror = failed;
    timer = setTimeout(failed, 45000);
    audio.play().catch(failed);
  }
  lesson.pages.forEach((page, index) => {
    const article = document.createElement('article'); article.className = 'note-page'; article.id = 'page-' + (index + 1);
    const label = document.createElement('div'); label.className = 'page-label';
    const number = document.createElement('b'); number.textContent = String(index + 1).padStart(2, '0') + ' / 04';
    const title = document.createElement('span'); title.textContent = page.title; label.append(number, title);
    const viewport = document.createElement('div'); viewport.className = 'paper-viewport';
    const paper = document.createElement('div'); paper.className = 'paper'; paper.style.aspectRatio = page.width + ' / ' + page.height;
    const image = document.createElement('img'); image.className = 'page-image'; image.src = 'interactive_notes_assets/' + page.file;
    image.alt = 'PU3 Unit 9 p.111 预习图，第 ' + (index + 1) + ' 页：' + page.title;
    image.width = page.width; image.height = page.height; image.draggable = false;
    if (index > 0) image.loading = 'lazy';
    paper.append(image);
    page.hotspots.forEach(spot => {
      const clip = lesson.clips[spot.clip];
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hotspot ' + spot.kind;
      button.dataset.clip = spot.clip; button.setAttribute('aria-label', '听' + (clip.kind === 'word' ? '单词' : '例句') + '：' + clip.text);
      button.setAttribute('aria-pressed', 'false'); button.title = '♪ ' + clip.text;
      const [x, y, w, h] = spot.rect;
      Object.assign(button.style, { left: x / page.width * 100 + '%', top: y / page.height * 100 + '%', width: w / page.width * 100 + '%', height: h / page.height * 100 + '%' });
      button.addEventListener('click', () => play(spot.clip)); paper.append(button);
    });
    viewport.append(paper); article.append(label, viewport); $('pages').append(article);
  });
  $('showAreas').addEventListener('change', () => document.body.classList.toggle('show-areas', $('showAreas').checked));
  $('zoom').addEventListener('change', () => document.documentElement.style.setProperty('--zoom', $('zoom').value));
  $('speed').addEventListener('change', () => { if (audio) audio.playbackRate = Number($('speed').value); });
  $('stop').addEventListener('click', () => { stop(); $('playerStatus').textContent = '已停止。点单词、图片或句子继续听。'; });
  $('replay').addEventListener('click', () => { if (current) play(current); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  window.InteractiveNotesPOC = { snapshot: () => ({ pageCount: lesson.pages.length, currentClip: current, playing, mode: 'listening-only' }) };
})();
