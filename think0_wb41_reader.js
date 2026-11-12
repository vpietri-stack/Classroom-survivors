(function () {
  'use strict';

  const embedded = parent !== window;
  const local = /^(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(location.hostname);
  if (embedded ? !parent.PreviewNotes?.isReader(window) : !local) {
    location.replace('index.html');
    return;
  }

  const lesson = window.ThinkWorkbook41;
  const $ = id => document.getElementById(id);
  const cache = (embedded ? parent.AssetCache : null) || window.AssetCache;
  const packs = new Map();
  const assetRoot = 'think0_wb41_assets/';
  let generation = 0;
  let audio, objectUrl, selection;

  const action = $('reader-study-start');
  const params = new URLSearchParams(location.search);
  const request = params.get('request');
  const review = params.get('mode') === 'review';
  action.textContent = embedded ? (review ? '返回主界面' : '开始学习') : '登录后开始学习';
  action.onclick = () => {
    stop();
    if (!embedded) {
      location.assign('index.html');
      return;
    }
    if (!review) action.disabled = true;
    parent.postMessage({ action: review ? 'close-note' : 'start-note-study', request }, location.origin);
  };
  window.addEventListener('message', event => {
    if (embedded && event.source === parent && event.origin === location.origin
        && event.data?.request === request && event.data.action === 'note-study-error') {
      action.disabled = false;
      $('playerStatus').textContent = '暂时无法开始学习，请再试一次。';
    }
  });

  async function readPack(path) {
    if (!packs.has(path)) {
      const load = async () => {
        const url = await cache?.getBlobUrl(path, { race: true });
        const response = await fetch(url || path);
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      };
      packs.set(path, load().catch(error => {
        packs.delete(path);
        throw error;
      }));
    }
    return packs.get(path);
  }

  function stop() {
    generation++;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio = null;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    $('stop').disabled = true;
  }

  async function play(item) {
    stop();
    const ticket = generation;
    selection?.buttons.forEach(button => button.classList.remove('active'));
    selection = item;
    item.buttons.forEach(button => button.classList.add('active'));
    $('nowPlaying').textContent = item.text;
    $('nowTranslation').textContent = item.zh;
    $('playerStatus').textContent = '';
    $('stop').disabled = false;
    $('replay').disabled = false;
    window.dispatchEvent(new CustomEvent('notes-select', {
      detail: { id: item.clip ? item.path + ':' + item.clip[0] : item.path, text: item.text }
    }));

    try {
      let source;
      if (item.clip) {
        const bytes = await readPack(item.path);
        if (ticket !== generation) return;
        const [offset, length] = item.clip;
        source = objectUrl = URL.createObjectURL(new Blob([bytes.slice(offset, offset + length)], { type: 'audio/mpeg' }));
      } else {
        source = await cache?.getBlobUrl(item.path, { race: true }) || item.path;
        if (ticket !== generation) return;
      }
      audio = new Audio(source);
      audio.playbackRate = Number($('speed').value);
      audio.onended = () => { if (ticket === generation) stop(); };
      await audio.play();
    } catch (_) {
      if (ticket !== generation) return;
      stop();
      $('playerStatus').textContent = '音频暂时无法播放，请再试一次。';
    }
  }

  function buttonFor(item, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    (item.buttons ||= []).push(button);
    button.onclick = () => play(item);
    return button;
  }

  async function loadPicture(picture) {
    const path = picture.dataset.path;
    picture.src = await cache?.getBlobUrl(path, { race: true }) || path;
  }

  const pictures = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      pictures.unobserve(entry.target);
      loadPicture(entry.target);
    }
  }, { rootMargin: '350px' }) : null;

  for (const [text, zh, image] of lesson.words) {
    const slug = image.slice(3, -5);
    const card = buttonFor({ text, zh, path: assetRoot + 'audio/word-' + slug + '.mp3' }, 'card');
    const picture = document.createElement('img');
    picture.alt = '';
    picture.width = picture.height = 432;
    picture.loading = 'lazy';
    picture.dataset.path = assetRoot + image;
    if (pictures) pictures.observe(picture);
    else loadPicture(picture);
    const en = document.createElement('strong');
    en.lang = 'en';
    en.textContent = text;
    const cn = document.createElement('span');
    cn.textContent = zh;
    card.append(picture, en, cn);
    $('cards').append(card);
  }

  lesson.sections.forEach((part, index) => {
    const section = document.createElement('section');
    section.className = 'race-part';
    section.lang = 'en';
    const scan = document.createElement('div');
    scan.className = 'workbook-scan';
    const picture = document.createElement('img');
    const [width, height] = part.size;
    picture.width = width;
    picture.height = height;
    picture.alt = part.sentences[0][0];
    picture.loading = 'lazy';
    picture.dataset.path = assetRoot + part.image;
    scan.append(picture);

    const path = assetRoot + 'reading-' + (index + 1) + '.bin';
    for (const [text, offset, length, zh, hotspots] of part.sentences) {
      const item = { text, zh, path, clip: [offset, length] };
      hotspots.forEach(([x, y, w, h], line) => {
        const button = buttonFor(item, 'workbook-hotspot');
        button.setAttribute('aria-label', text);
        if (line) button.tabIndex = -1;
        Object.assign(button.style, {
          left: x / width * 100 + '%',
          top: y / height * 100 + '%',
          width: w / width * 100 + '%',
          height: h / height * 100 + '%'
        });
        scan.append(button);
      });
    }
    section.append(scan);
    $('parts').append(section);
    if (pictures) pictures.observe(picture);
    else loadPicture(picture);
  });

  $('stop').onclick = stop;
  $('replay').onclick = () => { if (selection) play(selection); };
  $('speed').onchange = () => { if (audio) audio.playbackRate = Number($('speed').value); };
  window.InteractiveNotesPOC = { pause: stop };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
})();
