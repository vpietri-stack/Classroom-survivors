'use strict';

(() => {
  const query = new URLSearchParams(location.search);
  const config = PhonicsContent.letter(query.get('letter') || 'a');
  const base = config.assetBase;
  const words = config.words;
  const capital = config.letter.toUpperCase();
  const labels = [`${capital} ${config.letter}`, ...words.map(word => word[0].toUpperCase() + word.slice(1))];
  const meanings = config.meanings;
  document.title = `Phonics 1 · ${capital} ${config.letter}`;
  document.querySelector('.course span').textContent = `Unit ${config.unit} · Page ${config.page}`;
  const letterPicture = document.querySelector('.letter-card img');
  document.querySelector('.letter-card').setAttribute('aria-label', `听字母 ${capital} 的名称和发音`);
  document.getElementById('pages').setAttribute('aria-label', `${capital} 字母预习`);
  letterPicture.src = base + 'letter-pictures.webp';
  letterPicture.alt = `${capital} ${config.letter}，包含 ${words.join('、')} 的字母图片`;
  PhonicsContent.warm(config.letter).catch(() => {});
  const pages = document.getElementById('pages');
  const status = document.getElementById('playerStatus');
  const fallback = document.getElementById('audio-fallback');
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const tabs = document.getElementById('page-tabs');
  const player = new Audio();
  player.preload = 'auto';
  let pageIndex = 0;
  let activeButton = null;
  let activeScene = null;
  let animationId = 0;
  let playbackToken = 0;
  let rate = 1;
  let silentClock = null;
  const scenes = new Map();
  let selectedButton = null;

  for (const word of words) {
    const section = document.createElement('section');
    section.className = 'page word-page';
    section.hidden = true;
    section.setAttribute('aria-labelledby', 'page-title');
    section.innerHTML = `
      <button class="listen-card" type="button" data-audio="${word}/word.mp3" aria-label="听单词 ${word}">
        <img src="${base}${word}/word.webp" alt="${word}，首字母 ${config.letter} 标为红色" width="600" height="600">
        <span class="card-caption"><span class="play-icon" aria-hidden="true">▶</span> 听单词</span>
      </button>
      <button class="listen-card" type="button" data-audio="${word}/recording.mp3" data-scene="${word}" aria-label="播放 ${word} 的字母和单词动画">
        <canvas width="600" height="600" aria-label="${word} 的字母和单词动画"></canvas>
        <span class="card-caption"><span class="play-icon" aria-hidden="true">▶</span> 听字母和单词</span>
      </button>`;
    pages.append(section);
    const canvas = section.querySelector('canvas');
    const poster = new Image();
    poster.src = `${base}${word}/picture.webp`;
    poster.onload = () => {
      if (activeScene?.word !== word) canvas.getContext('2d').drawImage(poster, 0, 0, 600, 600);
    };
    scenes.set(word, { word, canvas, poster });
  }

  labels.forEach((label, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-label', `第 ${index + 1} 页 ${label}`);
    button.addEventListener('click', () => showPage(index));
    tabs.append(button);
  });

  function stop() {
    playbackToken++;
    player.pause();
    silentClock = null;
    cancelAnimationFrame(animationId);
    if (activeScene?.poster.complete && activeScene.poster.naturalWidth) {
      activeScene.canvas.getContext('2d').drawImage(activeScene.poster, 0, 0, 600, 600);
    }
    activeButton?.classList.remove('playing');
    activeButton?.setAttribute('aria-pressed', 'false');
    activeButton = null;
    activeScene = null;
    document.getElementById('stop').disabled = true;
  }

  function showPage(index) {
    if (index < 0 || index >= labels.length) return;
    stop();
    window.NotesSpeech?.dispose();
    selectedButton = null;
    document.getElementById('replay').disabled = true;
    document.getElementById('nowPlaying').textContent = '点一下，听一听。';
    document.getElementById('meaning').textContent = '点击图片查看中文意思';
    pageIndex = index;
    [...pages.children].forEach((page, i) => { page.hidden = i !== index; });
    [...tabs.children].forEach((button, i) => {
      if (i === index) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.getElementById('page-title').textContent = labels[index];
    previous.disabled = index === 0;
    next.disabled = index === labels.length - 1;
    document.getElementById('start-practice').hidden = index !== labels.length - 1;
    status.textContent = '点击图片听一听';
    fallback.hidden = true;
  }

  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片暂时无法加载，请重试'));
      image.src = base + path;
    });
  }

  // Keep one clock for the recording and its pictures, including slower replay.
  let shared = null;
  function loadShared() {
    if (shared) return shared;
    shared = Promise.all([
    Promise.resolve(config.timing),
    loadImage('letters.webp'), loadImage('capital.webp'), loadImage('lowercase.webp')
    ]).catch(error => { shared = null; throw error; });
    return shared;
  }
  loadShared().catch(() => {});

  function loadScene(scene) {
    if (!scene.ready) {
      scene.ready = Promise.all([
        loadShared(),
        ...['picture', 'illustration', 'initial', 'ending'].map(name => loadImage(`${scene.word}/${name}.webp`))
      ]).then(([common, picture, illustration, initial, ending]) => {
        const [timing, letters, capital, lowercase] = common;
        Object.assign(scene, { timing: timing[scene.word], capitalRect: timing.capital,
          lowercaseRect: timing.lowercase, letters, capital, lowercase, picture, illustration, initial, ending });
        scene.tint = document.createElement('canvas');
        scene.tint.width = lowercase.width;
        scene.tint.height = lowercase.height;
      }).catch(error => { scene.ready = null; throw error; });
    }
    return scene.ready;
  }

  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

  function paint(scene, time) {
    const context = scene.canvas.getContext('2d');
    const timing = scene.timing;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 600, 600);
    if (time < timing.letters) {
      context.drawImage(scene.picture, 0, 0, 600, 600);
      context.globalAlpha = ease((time - timing.letters + 0.65) / 0.65);
      context.drawImage(scene.letters, 0, 0, 600, 600);
      context.globalAlpha = 1;
      return;
    }
    if (time < timing.move) {
      context.drawImage(scene.letters, 0, 0, 600, 600);
      return;
    }
    const t = ease((time - timing.move) / (timing.ready - timing.move));
    context.globalAlpha = t;
    context.drawImage(scene.illustration, 0, 0, 600, 600);
    context.globalAlpha = 1 - t;
    context.drawImage(scene.capital, ...scene.capitalRect);
    context.globalAlpha = 1;
    const start = scene.lowercaseRect;
    const end = timing.initial;
    if (t < 1) {
      const tint = scene.tint.getContext('2d');
      tint.clearRect(0, 0, scene.tint.width, scene.tint.height);
      tint.globalCompositeOperation = 'source-over';
      tint.drawImage(scene.lowercase, 0, 0);
      tint.globalCompositeOperation = 'source-in';
      tint.fillStyle = `rgb(${Math.round(35 + 220 * t)}, ${Math.round(35 * (1 - t))}, ${Math.round(35 * (1 - t))})`;
      tint.fillRect(0, 0, scene.tint.width, scene.tint.height);
      const rect = start.map((value, i) => value + (end[i] - value) * t);
      context.drawImage(scene.tint, ...rect);
    } else {
      context.drawImage(scene.initial, ...end);
    }
    const reveal = clamp((time - timing.write) / (timing.end - timing.write));
    const [x, y, width, height] = timing.ending;
    context.save();
    context.beginPath();
    context.rect(x, y, width * reveal, height);
    context.clip();
    context.drawImage(scene.ending, x, y, width, height);
    context.restore();
  }

  function animate() {
    if (!activeScene) return;
    if (silentClock) {
      const elapsed = silentClock.offset + (performance.now() - silentClock.started) / 1000 * rate;
      paint(activeScene, Math.min(elapsed, activeScene.timing.end));
      if (elapsed < activeScene.timing.end) animationId = requestAnimationFrame(animate);
      return;
    }
    paint(activeScene, player.currentTime);
    if (!player.paused && !player.ended) animationId = requestAnimationFrame(animate);
  }

  function audioError(message) {
    cancelAnimationFrame(animationId);
    activeButton?.classList.remove('playing');
    activeButton?.setAttribute('aria-pressed', 'false');
    status.textContent = message;
    fallback.href = player.src;
    fallback.target = '_blank';
    fallback.rel = 'noopener';
    fallback.hidden = false;
  }

  function audioSource(path) {
    return PhonicsContent.audioURL(config.letter, path);
  }

  async function playButton(button) {
    const word = button.dataset.audio.split('/')[0];
    const letterSequence = `${config.letterName}, ${config.letterName}, ${config.soundText}, ${config.soundText}, ${config.soundText}.`;
    const wordSequence = `${config.letterName}, ${config.soundText}`;
    let text = letterSequence;
    if (meanings[word]) {
      text = button.dataset.scene
        ? `${word}. ${letterSequence} ${wordSequence}. ${word}.`
        : word;
    }
    const letterDisplay = `"${capital}" - "${capital}" - "${config.ipa}" - "${config.ipa}" - "${config.ipa}"`;
    let displayText = letterDisplay;
    if (meanings[word]) {
      displayText = button.dataset.scene
        ? `${word}\n${letterDisplay}\n"${capital}" - "${config.ipa}" - ${word}`
        : word;
    }
    window.dispatchEvent(new CustomEvent('notes-select', { detail: { id: button.dataset.audio, text, displayText, assessmentProfile: 'phonics1' } }));
    stop();
    selectedButton = button;
    document.getElementById('nowPlaying').textContent = displayText;
    document.getElementById('meaning').textContent = meanings[word] || `字母 ${capital} 的名称和发音`;
    document.getElementById('replay').disabled = false;
    document.getElementById('stop').disabled = false;
    const token = playbackToken;
    activeButton = button;
    activeScene = scenes.get(button.dataset.scene) || null;
    player.src = audioSource(button.dataset.audio);
    player.playbackRate = rate;
    fallback.hidden = true;
    status.textContent = '正在加载音频…';
    button.classList.add('playing');
    button.setAttribute('aria-pressed', 'true');
    // Start in the tap gesture so iOS can grant audio playback immediately.
    const playback = player.play();
    playback.catch(() => {});
    try {
      const scene = activeScene;
      await Promise.all([playback, scene ? loadScene(scene) : Promise.resolve()]);
      if (token !== playbackToken) return;
      status.textContent = '正在播放 · 点击图片可重听';
      if (scene) animate();
    } catch (error) {
      if (token === playbackToken) {
        player.pause();
        audioError(error.message || '音频暂时无法播放，请重试');
      }
    }
  }
  pages.addEventListener('click', event => {
    const button = event.target.closest('[data-audio]');
    if (button) playButton(button);
  });
  player.addEventListener('ended', () => {
    cancelAnimationFrame(animationId);
    if (activeScene?.timing) paint(activeScene, activeScene.timing.end);
    activeButton?.classList.remove('playing');
    activeButton?.setAttribute('aria-pressed', 'false');
    document.getElementById('stop').disabled = true;
    status.textContent = '点击图片再听一次';
  });
  player.addEventListener('error', () => {
    if (activeButton) audioError('音频暂时无法播放，请重试或打开音频');
  });
  player.addEventListener('waiting', () => { if (activeButton) status.textContent = '正在缓冲音频…'; });
  player.addEventListener('playing', () => { if (activeButton) status.textContent = '正在播放 · 点击图片可重听'; });
  document.getElementById('speed').addEventListener('click', event => {
    if (silentClock) {
      silentClock.offset += (performance.now() - silentClock.started) / 1000 * rate;
      silentClock.started = performance.now();
    }
    rate = rate === 1 ? 0.75 : 1;
    player.playbackRate = rate;
    event.currentTarget.textContent = `${rate}×`;
  });
  document.getElementById('replay').addEventListener('click', () => {
    if (selectedButton) playButton(selectedButton);
  });
  document.getElementById('stop').addEventListener('click', () => {
    stop();
    status.textContent = '已停止。可以继续点读或试读。';
  });
  window.InteractiveNotesPOC = {
    pause: stop,
    prepareRecording() {
      playbackToken++;
      player.pause();
      cancelAnimationFrame(animationId);
      silentClock = null;
      status.textContent = '示范声音已停止';
    },
    async recordingStarted() {
      const scene = activeScene;
      if (!scene) return;
      const token = playbackToken;
      try {
        await loadScene(scene);
        if (token !== playbackToken || activeScene !== scene) return;
        cancelAnimationFrame(animationId);
        silentClock = { started: performance.now(), offset: 0 };
        status.textContent = '跟着无声动画读一读';
        document.getElementById('stop').disabled = false;
        animate();
      } catch (_) {
        status.textContent = '动画暂时无法加载，仍可继续录音';
      }
    }
  };
  const startPractice = document.getElementById('start-practice');
  startPractice.href = './';
  if (query.get('embed') === '1' && parent !== window) {
    const review = query.get('mode') === 'review';
    startPractice.textContent = review ? '返回主界面' : '开始练习';
    startPractice.addEventListener('click', event => {
      event.preventDefault(); stop();
      parent.postMessage({ action: review ? 'close-note' : 'start-note-study', request: query.get('request') }, location.origin);
    });
    window.addEventListener('message', event => {
      if (event.source === parent && event.origin === location.origin && event.data?.request === query.get('request') && event.data.action === 'note-study-error') {
        status.textContent = '暂时无法开始练习，请再试一次。';
      }
    });
  }
  window.addEventListener('pagehide', () => {
    stop();
  });
  previous.addEventListener('click', () => showPage(pageIndex - 1));
  next.addEventListener('click', () => showPage(pageIndex + 1));
  document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showPage(pageIndex - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showPage(pageIndex + 1); }
  });
  let touchStart = null;
  pages.addEventListener('touchstart', event => { touchStart = event.touches[0].clientX; }, { passive: true });
  pages.addEventListener('touchend', event => {
    if (touchStart === null) return;
    const delta = event.changedTouches[0].clientX - touchStart;
    touchStart = null;
    if (Math.abs(delta) > 65) showPage(pageIndex + (delta < 0 ? 1 : -1));
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  showPage(new URLSearchParams(location.search).get('page') === '5' ? 4 : 0);
})();
