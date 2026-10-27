(function () {
  'use strict';
  const data = window.InteractiveNotesData, core = window.InteractiveNotesCore;
  const $ = id => document.getElementById(id);
  const items = data.pairs.flatMap(p => [p.left, p.right]);
  const ids = items.map(x => x.id);
  const state = { pair: 0, item: null, profile: 'a', progress: {}, engine: 'idle', playing: false, phase: 'idle', kind: null, generation: 0, inference: false, activeRecorder: null, studentBlob: null, teacherClips: new Map() };
  let audio = null, utterance = null, playbackToken = 0, playbackUrl = null, playbackTimer = null, recordingTimer = null, meterTimer = null, replayUrl = null, teacherDownloadUrl = null;
  let storageOkay = true, dbPromise = null, loadPromise = null;
  const progressKey = () => 'csInteractiveNotes.' + data.id + '.v1:' + state.profile;
  function feedback(text, kind) { $('feedback').textContent = text; $('feedback').className = 'feedback' + (kind ? ' ' + kind : ''); }
  function entry(item) { return state.progress[item.id] || { listened: false, passed: false, attempts: 0 }; }
  function save() {
    state.progress = core.sanitizeProgress(state.progress, ids);
    try { localStorage.setItem(progressKey(), JSON.stringify(state.progress)); storageOkay = true; }
    catch (_) { storageOkay = false; }
    renderProgress();
  }
  function read() {
    try { state.progress = core.sanitizeProgress(JSON.parse(localStorage.getItem(progressKey()) || '{}'), ids); storageOkay = true; }
    catch (_) { state.progress = {}; storageOkay = false; }
  }
  function renderProgress() {
    const count = items.filter(item => entry(item).passed).length;
    $('progress').value = count;
    $('progressText').textContent = count + ' / 12 句已跟读通过';
    $('storageStatus').textContent = storageOkay ? '进度保存在本机 · 试用 ' + state.profile.toUpperCase() : '本机无法保存进度；本页仍可继续试用';
    renderTabs();
    document.querySelectorAll('.card-state').forEach(el => {
      const item = items.find(x => x.id === el.dataset.id), p = entry(item);
      el.textContent = p.passed ? '✓ 跟读通过' : p.listened ? '已听示范' : '点图听一句';
    });
  }
  function renderTabs() {
    $('pairTabs').replaceChildren();
    data.pairs.forEach((pair, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'pair-tab';
      button.textContent = pair.left.word;
      if (entry(pair.left).passed && entry(pair.right).passed) button.textContent += ' ✓';
      button.setAttribute('aria-current', String(index === state.pair));
      button.addEventListener('click', () => showPair(index));
      $('pairTabs').append(button);
    });
  }
  function scene(item) {
    const pair = data.pairs.find(p => p.left.id === item.id || p.right.id === item.id);
    const crop = pair.crops[pair.left.id === item.id ? 0 : 1];
    let [x, y, w, h] = crop;
    // Inset the illustration's inner edge to exclude the printed arrow
    // between the infographic panels. The raster itself stays unchanged.
    if (pair.left.id === item.id) { x += 5; w -= 40; }
    else { x += 28; w -= 33; }
    const div = document.createElement('div'); div.className = 'scene'; div.style.aspectRatio = w + ' / ' + h;
    const image = document.createElement('img');
    image.src = 'interactive_notes_assets/' + pair.page; image.alt = item.scene; image.draggable = false;
    image.style.width = (1054 / w * 100) + '%';
    image.style.left = (-x / w * 100) + '%'; image.style.top = (-y / h * 100) + '%';
    div.append(image); return div;
  }
  function sentence(el, item) {
    el.replaceChildren();
    const index = item.sentence.toLowerCase().indexOf(item.word);
    el.append(document.createTextNode(item.sentence.slice(0, index)));
    const mark = document.createElement('mark'); mark.textContent = item.sentence.slice(index, index + item.word.length); el.append(mark);
    el.append(document.createTextNode(item.sentence.slice(index + item.word.length)));
  }
  function renderCards() {
    const pair = data.pairs[state.pair];
    $('exampleCards').replaceChildren();
    [pair.left, pair.right].forEach((item, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'example-card ' + (index ? 'ed' : 'ing') + (state.item && state.item.id === item.id ? ' selected' : '');
      button.setAttribute('aria-label', '听示范：' + item.sentence);
      button.setAttribute('aria-pressed', String(!!state.item && state.item.id === item.id));
      const top = document.createElement('div'); top.className = 'card-top';
      const type = document.createElement('span'); type.className = 'card-type'; type.textContent = index ? '-ed · 自己的感受' : '-ing · 引起感受';
      const status = document.createElement('span'); status.className = 'card-state'; status.dataset.id = item.id;
      const p = entry(item); status.textContent = p.passed ? '✓ 跟读通过' : p.listened ? '已听示范' : '点图听一句';
      top.append(type, status);
      const copy = document.createElement('div'); copy.className = 'card-copy';
      [['word', item.word], ['meaning', item.meaning], ['sentence', ''], ['card-translation', item.translation], ['tap-hint', '▶ 点图片，听这句话']].forEach(([cls, text]) => {
        const el = document.createElement('p'); el.className = cls; el.textContent = text;
        if (cls === 'sentence') sentence(el, item);
        copy.append(el);
      });
      button.append(top, scene(item), copy);
      button.addEventListener('click', () => select(item, true, true));
      $('exampleCards').append(button);
    });
    $('pairNote').textContent = pair.note;
    $('pairCounter').textContent = String(state.pair + 1).padStart(2, '0') + ' / 06';
    $('previousPair').disabled = state.pair === 0; $('nextPair').disabled = state.pair === data.pairs.length - 1;
    renderTabs();
  }
  function stopPlayback() {
    playbackToken++;
    clearTimeout(playbackTimer); playbackTimer = null;
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackUrl = null;
    if (audio) { audio.pause(); audio.onended = null; audio.onerror = null; audio.removeAttribute('src'); audio.load(); audio = null; }
    if (utterance && window.speechSynthesis) window.speechSynthesis.cancel();
    utterance = null; state.playing = false;
  }
  function clearStudentAudio() {
    state.studentBlob = null;
    if (replayUrl) URL.revokeObjectURL(replayUrl);
    replayUrl = null;
  }
  function cleanupRecorder(rec) {
    if (!rec) return;
    try { if (rec.stream) rec.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
    try { if (rec.source) rec.source.disconnect(); } catch (_) {}
    try { if (rec.processor) rec.processor.disconnect(); } catch (_) {}
    try { if (rec.audioCtx) Promise.resolve(rec.audioCtx.close()).catch(() => {}); } catch (_) {}
    rec.recording = false; rec.stream = null; rec.audioCtx = null; rec._chunks = [];
  }
  function stopTimers() { clearTimeout(recordingTimer); clearInterval(meterTimer); recordingTimer = null; meterTimer = null; }
  function invalidate() {
    state.generation++;
    stopPlayback(); stopTimers(); cleanupRecorder(state.activeRecorder);
    state.activeRecorder = null; state.phase = 'idle'; state.kind = null;
    clearStudentAudio(); $('heardWrap').hidden = true; $('recordingPanel').hidden = true;
  }
  function isCurrent(generation, id) { return generation === state.generation && state.item && state.item.id === id; }
  function showPair(index) {
    invalidate(); state.pair = Math.max(0, Math.min(index, data.pairs.length - 1));
    select(data.pairs[state.pair].left, false);
  }
  function select(item, autoplay, scroll) {
    invalidate(); state.item = item;
    $('practiceArt').replaceChildren(scene(item));
    const isEd = data.pairs[state.pair].right.id === item.id;
    $('target').className = 'target' + (isEd ? ' ed' : ''); sentence($('target'), item);
    $('translation').textContent = item.translation;
    $('practiceBadge').textContent = isEd ? '-ed · 自己的感受' : '-ing · 引起感受';
    $('teacherTarget').textContent = item.sentence;
    $('teacherStatus').textContent = '';
    renderCards(); updateControls(); updateTeacher();
    feedback(entry(item).passed ? '这句已经跟读通过了，想读还可以再试。' : '先完整听一遍示范，再自己说这句话。');
    if (autoplay) listen();
    if (scroll && matchMedia('(max-width: 760px)').matches) $('practice').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  function updateControls() {
    const item = state.item, busy = state.phase !== 'idle', recording = state.phase === 'recording', p = item ? entry(item) : {};
    $('listenButton').disabled = !item || busy;
    $('listenButton').querySelector('b').textContent = state.playing ? '↻ 正在播放' : '▶ 听示范';
    $('audioSource').textContent = item && state.teacherClips.has(item.id) ? '老师示范 · 本机' : '英语示范';
    $('recordButton').disabled = !item || state.playing || (!recording && (busy || !p.listened || state.inference || state.engine === 'loading')) || (recording && state.kind !== 'student');
    $('recordButton').classList.toggle('recording', recording && state.kind === 'student');
    $('recordLabel').textContent = recording && state.kind === 'student' ? '■ 读完了' : state.phase === 'transcribing' ? '正在检查…' : state.engine !== 'ready' ? '准备跟读检查' : '● 我来读';
    $('recordHint').textContent = recording ? '点击停止 · 最长 15 秒' : !p.listened ? '先完整听一遍' : state.inference ? '正在处理上一段录音' : state.engine === 'ready' ? '点击开始录音' : '首次需准备语音模型';
    $('replayButton').disabled = !state.studentBlob || busy || state.playing;
    $('nextExample').disabled = !item || busy;
    $('engineButton').disabled = state.engine === 'loading' || state.engine === 'ready';
    $('engineDot').className = 'dot ' + state.engine;
    $('teacherRecord').disabled = !item || state.playing || (busy && !(recording && state.kind === 'teacher'));
    $('teacherRecord').textContent = recording && state.kind === 'teacher' ? '■ 完成示范录音' : '● 录制示范';
    $('teacherFile').disabled = !item || busy || state.playing;
    $('teacherClear').disabled = !item || busy || !state.teacherClips.has(item.id);
  }
  function updateTeacher() {
    if (teacherDownloadUrl) URL.revokeObjectURL(teacherDownloadUrl);
    teacherDownloadUrl = null;
    const clip = state.item && state.teacherClips.get(state.item.id);
    $('downloadTeacher').hidden = !clip;
    if (clip) {
      teacherDownloadUrl = URL.createObjectURL(clip.blob);
      $('downloadTeacher').href = teacherDownloadUrl;
      $('downloadTeacher').download = state.item.word + (clip.blob.type.includes('wav') ? '.wav' : clip.blob.type.includes('mpeg') ? '.mp3' : '.audio');
    }
    updateControls();
  }
  function playbackFinished(token, generation, item, countListen, url) {
    if (url) URL.revokeObjectURL(url);
    if (token !== playbackToken || !isCurrent(generation, item.id)) return;
    clearTimeout(playbackTimer); playbackTimer = null; playbackUrl = null;
    state.playing = false; audio = null; utterance = null;
    if (countListen) {
      state.progress[item.id] = Object.assign({}, entry(item), { listened: true }); save();
      feedback('听完啦！点击“' + (state.engine === 'ready' ? '我来读' : '准备跟读检查') + '”，然后自己读一遍。');
    }
    updateControls();
  }
  function playbackFailed(token, generation, item, url) {
    if (url) URL.revokeObjectURL(url);
    if (token !== playbackToken || !isCurrent(generation, item.id)) return;
    stopPlayback();
    feedback('示范没有播放成功。请再点一次，或请老师导入音频。', 'error'); updateControls();
  }
  function speakFallback(token, generation, item) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return playbackFailed(token, generation, item);
    utterance = new SpeechSynthesisUtterance(item.sentence);
    utterance.lang = 'en-GB'; utterance.rate = .85 * Number($('speed').value);
    const voices = speechSynthesis.getVoices(); utterance.voice = voices.find(v => /^en-GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null;
    utterance.onend = () => playbackFinished(token, generation, item, true);
    utterance.onerror = () => playbackFailed(token, generation, item);
    $('audioSource').textContent = '设备英语语音';
    speechSynthesis.speak(utterance);
  }
  function listen() {
    if (!state.item || state.phase !== 'idle') return;
    stopPlayback();
    const item = state.item, generation = state.generation, token = playbackToken;
    const clip = state.teacherClips.get(item.id), url = clip ? URL.createObjectURL(clip.blob) : null;
    playbackUrl = url;
    playbackTimer = setTimeout(() => playbackFailed(token, generation, item, url), 45000);
    state.playing = true; feedback('先听完整的一句话，再轮到你说。'); updateControls();
    audio = new Audio(url || item.audio); audio.playbackRate = Number($('speed').value);
    audio.onended = () => playbackFinished(token, generation, item, true, url);
    let fallbackStarted = false;
    const failure = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      if (url) URL.revokeObjectURL(url);
      if (token !== playbackToken || !isCurrent(generation, item.id)) return;
      audio = null;
      if (clip) playbackFailed(token, generation, item);
      else speakFallback(token, generation, item);
    };
    audio.onerror = failure;
    audio.play().catch(failure);
  }
  async function loadEngine() {
    if (state.engine === 'ready') return true;
    if (loadPromise) return loadPromise;
    const retry = state.engine === 'error';
    state.engine = 'loading'; $('engineLabel').textContent = '正在准备语音模型…'; updateControls();
    $('engineDetail').textContent = '正在准备现有 Whisper 模型。首次可能需要几分钟，可以继续看图、听示范。';
    loadPromise = (async () => {
      try {
        if (!window.LocalEngine || !window.Scorer) throw new Error('engine unavailable');
        if (retry) window.LocalEngine.resetLoad();
        await window.LocalEngine.load((percent) => { $('engineLabel').textContent = '准备语音模型 · ' + percent + '%'; });
        state.engine = 'ready'; $('engineLabel').textContent = '跟读检查已准备好';
        $('engineDetail').textContent = 'Whisper tiny.en 已就绪。录音在本机识别；句子匹配沿用 PU3 评分，并检查目标形容词。';
        return true;
      } catch (_) {
        state.engine = 'error'; $('engineLabel').textContent = '准备失败 · 点击重试';
        $('engineDetail').textContent = '语音模型没有准备成功。请检查网络后点上方重试；看图和听示范仍然可用。';
        return false;
      } finally { loadPromise = null; updateControls(); }
    })();
    return loadPromise;
  }
  window.__speechLog = function (message) {
    if (state.engine !== 'loading') return;
    if (/compil|initializ/i.test(message)) $('engineDetail').textContent = '正在初始化本机语音模型。首次可能较慢，可以继续看图、听示范。';
  };
  async function startRecording(kind) {
    if (!state.item || state.phase !== 'idle' || state.playing || (kind === 'student' && state.inference)) return;
    if (kind === 'student' && !entry(state.item).listened) return;
    if (kind === 'student' && state.engine !== 'ready') {
      const generation = state.generation, id = state.item.id;
      feedback('正在准备跟读检查。准备好后，请再点一次“我来读”。');
      const ready = await loadEngine();
      if (isCurrent(generation, id)) feedback(ready ? '准备好啦！请点击“我来读”，然后说出整句话。' : '暂时不能跟读检查。可以继续听示范，稍后重试。', ready ? '' : 'error');
      return;
    }
    if (!window.isSecureContext || !window.Recorder || !Recorder.isSupported()) {
      feedback('麦克风需要安全网页。请用 HTTPS 或本机 localhost 打开，并允许麦克风。', 'error'); return;
    }
    stopPlayback(); clearStudentAudio();
    const generation = state.generation, item = state.item;
    const rec = new Recorder(); state.activeRecorder = rec; state.phase = 'permission'; state.kind = kind;
    feedback('请允许麦克风，然后读出整句话。'); updateControls();
    try {
      await rec.start();
      if (!isCurrent(generation, item.id)) { cleanupRecorder(rec); return; }
      // Safari may construct a suspended AudioContext after getUserMedia.
      if (rec.audioCtx && rec.audioCtx.state === 'suspended') await rec.audioCtx.resume();
      if (!isCurrent(generation, item.id)) { cleanupRecorder(rec); return; }
      state.phase = 'recording'; $('recordingPanel').hidden = false;
      $('heardWrap').hidden = true; $('recordingTime').textContent = '正在录音 · 0 / 15 秒';
      const start = Date.now();
      meterTimer = setInterval(() => {
        $('micLevel').style.width = Math.min(100, (rec.level || 0) * 220) + '%';
        $('recordingTime').textContent = '正在录音 · ' + Math.floor((Date.now() - start) / 1000) + ' / 15 秒';
      }, 100);
      recordingTimer = setTimeout(finishRecording, 15000);
      feedback(kind === 'teacher' ? '正在录制老师示范。读完后点击“完成示范录音”。' : '正在听你说。读完后点“读完了”。'); updateControls();
    } catch (error) {
      cleanupRecorder(rec);
      if (!isCurrent(generation, item.id)) return;
      state.activeRecorder = null; state.phase = 'idle'; state.kind = null;
      feedback(/NotAllowed|PermissionDenied|Security/.test(error.name || '') ? '没有开启麦克风。请在浏览器的网站设置里允许麦克风，然后再试。' : '麦克风暂时没有工作，请检查麦克风后重试。', 'error');
      updateControls();
    }
  }
  async function finishRecording() {
    if (state.phase !== 'recording') return;
    const rec = state.activeRecorder, kind = state.kind, item = state.item, generation = state.generation;
    let ownsInference = false;
    state.phase = 'processing'; stopTimers(); $('recordingPanel').hidden = true; updateControls();
    try {
      const blob = await rec.stop(); cleanupRecorder(rec);
      if (!isCurrent(generation, item.id)) return;
      state.activeRecorder = null;
      const stats = await core.audioStats(blob);
      if (!isCurrent(generation, item.id)) return;
      if (stats.kind !== 'ok') {
        feedback(stats.kind === 'quiet' || stats.kind === 'empty' ? '声音太轻，还没有听清。靠近麦克风，把整句话说出来。' : '录音有点短。请读完整的一句话，再点停止。', 'retry');
        return;
      }
      if (kind === 'teacher') {
        await saveTeacher(item.id, blob);
        if (isCurrent(generation, item.id)) feedback('老师示范已替换。点击“听示范”试听。', 'pass');
        return;
      }
      state.studentBlob = blob;
      state.phase = 'transcribing'; state.inference = true; ownsInference = true; updateControls(); feedback('正在检查刚才的话，请稍等…');
      const p = entry(item), attempt = p.attempts + 1;
      const result = await window.LocalEngine.transcribe(blob);
      if (!isCurrent(generation, item.id)) return;
      const text = String(result.text || '').slice(0, 500);
      const verdict = core.assess(item, text, attempt, window.Scorer);
      state.progress[item.id] = Object.assign({}, entry(item), { attempts: attempt, passed: p.passed || verdict.pass });
      save();
      $('heardText').textContent = core.junk(text) ? '（还没有清楚地听到句子）' : text;
      $('heardWrap').hidden = false;
      feedback(verdict.message, verdict.pass ? 'pass' : 'retry');
      $('practiceBadge').textContent = verdict.pass ? '✓ 这句跟读通过啦' : '再听，再说';
    } catch (_) {
      cleanupRecorder(rec);
      if (isCurrent(generation, item.id)) feedback(kind === 'teacher' ? '示范录音没有保存成功，请再试一次。' : '这次没有检查成功。可以再听示范，然后重试。', 'error');
    } finally {
      // An older inference must clear its lock without overwriting a new view.
      if (ownsInference) state.inference = false;
      if (isCurrent(generation, item.id)) { state.phase = 'idle'; state.kind = null; state.activeRecorder = null; }
      updateControls();
    }
  }
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('storage unavailable')); return; }
      const request = indexedDB.open('cs-interactive-notes-poc-audio', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('clips', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('storage blocked'));
    });
    return dbPromise;
  }
  async function dbOperation(mode, fn) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('clips', mode), req = fn(tx.objectStore('clips'));
      let result;
      req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  async function saveTeacher(id, blob) {
    if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('file size');
    const clip = { id, blob };
    await dbOperation('readwrite', store => store.put(clip));
    state.teacherClips.set(id, clip);
    if (state.item && state.item.id === id) { $('teacherStatus').textContent = '示范已保存在这台设备。'; updateTeacher(); }
  }
  async function importTeacher(file) {
    if (!state.item || state.phase !== 'idle' || !file) return;
    const id = state.item.id, generation = state.generation;
    if (file.size > 5 * 1024 * 1024) { $('teacherStatus').textContent = '请选择 5 MB 以内的音频。'; return; }
    if (!/^audio\//.test(file.type) && !/\.(mp3|wav|ogg|m4a)$/i.test(file.name)) { $('teacherStatus').textContent = '请选择 MP3、WAV 或 M4A 等音频文件。'; return; }
    $('teacherStatus').textContent = '正在检查音频…';
    const url = URL.createObjectURL(file), probe = new Audio();
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('audio timeout')), 10000);
        probe.onloadedmetadata = () => { clearTimeout(timer); Number.isFinite(probe.duration) && probe.duration > .5 && probe.duration <= 30 ? resolve() : reject(new Error('duration')); };
        probe.onerror = () => { clearTimeout(timer); reject(new Error('audio invalid')); };
        probe.src = url;
      });
      if (!isCurrent(generation, id)) return;
      await saveTeacher(id, file);
    } catch (_) { if (isCurrent(generation, id)) $('teacherStatus').textContent = '无法保存。请选择可播放、0.5–30 秒的音频，并检查本机储存空间。'; }
    finally { probe.removeAttribute('src'); probe.load(); URL.revokeObjectURL(url); }
  }
  $('listenButton').addEventListener('click', listen);
  $('recordButton').addEventListener('click', () => state.phase === 'recording' ? finishRecording() : startRecording('student'));
  $('engineButton').addEventListener('click', loadEngine);
  $('teacherRecord').addEventListener('click', () => state.phase === 'recording' ? finishRecording() : startRecording('teacher'));
  $('cancelRecording').addEventListener('click', () => { invalidate(); feedback('录音已取消，随时可以再试。'); updateControls(); });
  $('teacherFile').addEventListener('change', e => { importTeacher(e.target.files[0]); e.target.value = ''; });
  $('teacherClear').addEventListener('click', async () => {
    if (!state.item || state.phase !== 'idle') return;
    const id = state.item.id;
    try { await dbOperation('readwrite', store => store.delete(id)); state.teacherClips.delete(id); updateTeacher(); $('teacherStatus').textContent = '已恢复原来的示范。'; }
    catch (_) { $('teacherStatus').textContent = '本机储存暂时不可用，请稍后再试。'; }
  });
  $('previousPair').addEventListener('click', () => showPair(state.pair - 1));
  $('nextPair').addEventListener('click', () => showPair(state.pair + 1));
  $('nextExample').addEventListener('click', () => {
    const index = items.findIndex(item => item.id === state.item.id), next = (index + 1) % items.length;
    state.pair = Math.floor(next / 2); select(items[next], false);
  });
  $('replayButton').addEventListener('click', () => {
    if (!state.studentBlob || state.phase !== 'idle') return;
    stopPlayback();
    if (replayUrl) URL.revokeObjectURL(replayUrl);
    replayUrl = URL.createObjectURL(state.studentBlob);
    const url = replayUrl, token = playbackToken, generation = state.generation, item = state.item;
    state.playing = true; updateControls(); audio = new Audio(url);
    audio.onended = () => playbackFinished(token, generation, item, false, url);
    audio.onerror = () => playbackFailed(token, generation, item, url);
    audio.play().catch(() => playbackFailed(token, generation, item, url));
  });
  $('profile').addEventListener('change', () => { invalidate(); state.profile = $('profile').value; read(); renderProgress(); select(state.item || items[0], false); });
  $('resetProgress').addEventListener('click', () => {
    invalidate(); state.progress = {}; save(); if (state.item) select(state.item, false); feedback('当前试用进度已重置。');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { invalidate(); updateControls(); } });
  window.addEventListener('pagehide', () => { invalidate(); if (teacherDownloadUrl) URL.revokeObjectURL(teacherDownloadUrl); });
  // Read-only diagnostics for bounded POC verification, never a pass override.
  window.InteractiveNotesPOC = { snapshot: () => ({ pair: state.pair, itemId: state.item && state.item.id, profile: state.profile, progress: JSON.parse(JSON.stringify(state.progress)), engine: state.engine, phase: state.phase, playing: state.playing, inference: state.inference }) };
  read(); renderCards(); renderProgress(); select(items[0], false);
  dbOperation('readonly', store => store.getAll()).then(clips => {
    clips.filter(clip => ids.includes(clip.id) && clip.blob instanceof Blob && clip.blob.size <= 5 * 1024 * 1024).forEach(clip => state.teacherClips.set(clip.id, clip)); updateTeacher();
  }).catch(() => { $('teacherStatus').textContent = '本机储存不可用，仍可使用原示范。'; });
})();
