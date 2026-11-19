'use strict';

(() => {
  const base = 'media/phonics/p1-u1/';
  const storageKey = 'phonics1-a-study-trial-v1';
  const wordIds = ['alligator', 'apple', 'astronaut', 'axe'];
  const bank = {
    alligator: { initial: 'a', meaning: '短吻鳄' },
    apple: { initial: 'a', meaning: '苹果' },
    astronaut: { initial: 'a', meaning: '宇航员' },
    axe: { initial: 'a', meaning: '斧头' },
    banana: { initial: 'b', emoji: '🍌' }, bear: { initial: 'b', emoji: '🐻' }, ball: { initial: 'b', emoji: '⚽' },
    cat: { initial: 'c', emoji: '🐈' }, cup: { initial: 'c', emoji: '☕' }, cactus: { initial: 'c', emoji: '🌵' },
    'letter-a': { letter: 'A a', initial: 'a' },
    'letter-b': { letter: 'B b', initial: 'b', emoji: '🍌 🐻 ⚽' },
    'letter-c': { letter: 'C c', initial: 'c', emoji: '🐈 ☕ 🌵' }
  };
  const aliases = { 'exercise': 'study-game-area', 'round-title': 'study-title', 'instruction': 'study-instruction' };
  const $ = id => document.getElementById(aliases[id] || id);
  const audio = new Audio();
  const audioURLs = new Map();
  let currentPrompt = null;
  let state;
  let revision = 0;
  let recordButton = null;
  let practiceGate = null;

  function freshState() {
    const sr = { vocab: {}, sentences: {}, sentencePairs: {} };
    const pool = wordIds.map(word => ({ key: `phonics1:word:${word}`, word, pageIndex: 0 }));
    const selected = sortPoolBySR(pool, sr.vocab, 0, 0).slice(0, 4).map(item => item.word);
    const letters = [...new Set(selected.map(word => bank[word].initial))].sort().map(letter => `letter-${letter}`);
    return { version: 1, runId: crypto.randomUUID(), words: selected, letters, stage: 'A', index: 0,
      queue: [], turn: 0, question: null, first: {}, speechFailures: {}, speechPassed: {}, technical: {},
      handwriting: {}, skipWriting: false, sr, completed: false, speechMode: 'full-sequence-v2' };
  }

  function save() {
    if (!state) return;
    if (practiceGate?.isConnected && state.stage === 'A') {
      state.nativeSpeech = { id: targets()[state.index], snapshot: practiceGate.studyResumeState() };
    }
    if (state.stage === 'D') state.nativeAdvancePending = STUDY_STATE._resumePending?.action === 'handwriting_word';
    if (state.stage === 'D' && roundDTrace && roundDWord === [...state.words].sort()[state.index]) {
      state.nativeWriting = {
        slots: roundDSlots, gaps: roundDGapOrder, cursor: roundDCursor,
        attempts: roundDAttempts, effort: roundDEffortAttempts, guided: roundDGuided,
        help: roundDHadHelp, skip: roundDSkipUnlocked, trace: roundDTrace.exportRecovery(),
        targetElapsedMs: Date.now() - roundDTargetShownAt,
        status: document.getElementById('handwriting-status')?.textContent || ''
      };
    }
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (_) { $('feedback').textContent = '本设备暂时无法保存，请保持此页打开。'; }
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.version === 1 && saved.words?.length === 4 && saved.words.every(word => wordIds.includes(word)) &&
          ['A', 'B', 'C', 'D', 'done'].includes(saved.stage)) {
        if (saved.speechMode !== 'full-sequence-v2') {
          saved.speechFailures = {}; saved.speechPassed = {}; saved.technical = {};
          saved.speechMode = 'full-sequence-v2';
        }
        return saved;
      }
    } catch (_) {}
    return freshState();
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function targets() { return [...state.letters, ...[...state.words].sort()]; }

  function stopAudio() {
    audio.pause();
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  function source(path) {
    if (!audioURLs.has(path)) {
      const bytes = Uint8Array.from(atob(window.PhonicsPlaybackData.audio[path]), char => char.charCodeAt(0));
      audioURLs.set(path, URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })));
    }
    return audioURLs.get(path);
  }

  function playPrompt() {
    if (!currentPrompt) return;
    stopAudio();
    audio.src = source(currentPrompt.path);
    audio.playbackRate = 1;
    audio.play().catch(() => { $('playerStatus').textContent = '请点“再听一次”播放。'; });
  }

  function selectPrompt(id, mode) {
    const item = bank[id];
    const letter = !!item.letter;
    let displayText = letter ? '"A" - "A" - "/æ/" - "/æ/" - "/æ/"' : id;
    let path = letter ? 'letter-sounds.mp3' : `${id}/word.mp3`;
    if (!letter && (mode === 'A' || mode === 'D')) {
      displayText = `"A" - "/æ/" - ${id}`;
      path = `${id}/sequence.mp3`;
    }
    const practice = mode === 'A';
    currentPrompt = { path };
    $('nowPlaying').textContent = practice ? displayText : '听一听';
    $('meaning').textContent = practice ? item.meaning || '字母 A 的名称和短元音发音' : '';
    $('speech-controls').hidden = !practice;
    $('meaning').hidden = !practice;
    $('replay').disabled = false;
    $('playerStatus').textContent = '点击“再听一次”可重听。';
  }

  function picture(id, textOnly = false) {
    const item = bank[id];
    const fragment = document.createDocumentFragment();
    if (!textOnly && (id === 'letter-a' || wordIds.includes(id))) {
      const image = new Image();
      image.src = base + (id === 'letter-a' ? 'letter-pictures.webp' : `${id}/word.webp`);
      image.alt = item.letter || id;
      fragment.append(image);
    } else {
      if (!textOnly && item.emoji) {
        const emoji = document.createElement('span'); emoji.className = 'emoji'; emoji.textContent = item.emoji;
        fragment.append(emoji);
      }
      const label = document.createElement('span'); label.className = 'label'; label.textContent = item.letter || id;
      fragment.append(label);
    }
    return fragment;
  }

  function cleanup() {
    revision++;
    stopAudio();
    recordButton?.disposeSpeech(); recordButton = null;
    practiceGate = null;
    studyRuntimeEpoch++;
    studyCancelPending();
    clearTimeout(roundDTimer);
    if (roundDTrace) { roundDTrace.destroy(); roundDTrace = null; }
    currentPrompt = null;
    $('exercise').replaceChildren();
    $('feedback').textContent = '';
    document.querySelector('.study-actions').hidden = false;
    $('continue').hidden = false;
    $('continue').disabled = true;
    $('continue').textContent = '继续';
  }

  function render() {
    cleanup();
    save();
    const names = { A: '听一听，读一读', B: '看图选答案', C: '听音认字', D: '写首字母', done: '练习完成' };
    STUDY_STATE.phonics = { labels: names };
    STUDY_STATE.round = state.stage;
    STUDY_STATE.active = state.stage === 'D';
    updateStudyUI(state.stage === 'done' ? names.done : `Round ${state.stage}: ${names[state.stage]}`, '');
    $('round-progress').textContent = state.stage === 'done' ? '完成' : `Round ${state.stage} / D`;
    if (state.stage === 'done') return renderSummary();
    $('replay').hidden = false;
    if (state.stage === 'A') renderSpeaking();
    if (state.stage === 'B' || state.stage === 'C') renderRecognition();
    if (state.stage === 'D') renderHandwriting();
  }

  function renderSpeaking() {
    const id = targets()[state.index];
    $('instruction').textContent = `先听示范，再点麦克风跟读。${state.index + 1} / ${targets().length}`;
    const button = document.createElement('button');
    button.type = 'button'; button.className = `target-card ${bank[id].letter ? 'letter-target' : ''}`;
    button.append(picture(id)); button.onclick = playPrompt;
    $('exercise').append(button);
    selectPrompt(id, 'A');
    if (!Recorder.isSupported()) {
      state.technical[id] = true;
      state.microphoneUnavailable = true;
      $('feedback').textContent = '麦克风不可用，本次跳过跟读，下次练习会重新尝试。';
      $('continue').disabled = false;
      $('continue').textContent = '进入 Round B';
      save();
    }
    mountStudyRecorder(id);
  }

  function mountStudyRecorder(id) {
    const isLetter = !!bank[id].letter;
    const target = isLetter ? 'Ay ay ah ah ah' : `Ay ah ${id}`;
    const display = isLetter ? ['"A"', '"A"', '/æ/', '/æ/', '/æ/'] : ['"A"', '/æ/', id];
    const tokens = target.split(' ');
    const tiles = display.map((label, index) => {
      const tile = document.createElement('span');
      tile.className = 'study-word-tile speech-reading-tile speech-reading-neutral';
      tile.dataset.word = tokens[index];
      tile.textContent = label;
      return tile;
    });
    $('nowPlaying').replaceChildren(...tiles);
    const ticket = revision;
    const previous = state.nativeSpeech?.id === id ? state.nativeSpeech.snapshot : {
      recordings: state.speechFailures[id] || 0,
      gradedTries: state.speechFailures[id] || 0,
      errors: state.technical[id] ? 1 : 0,
      hintedWords: state.speechPassed[id] ? display.length : 0,
      continueHidden: !(state.speechPassed[id] || state.technical[id] || (state.speechFailures[id] || 0) >= 3),
      transcriptHidden: true
    };
    practiceGate = SpeechUI.makeSentenceGate({
      target, wordTiles: tiles, book: 'Phonics1', mode: 'study', level: 1,
      requireAllHeard: true, resumeState: previous,
      resolveTargetWords: (text, meta) => {
        const heard = String(text).toLowerCase().match(/[\p{L}]+/gu) || [];
        // The recogniser can spell the complete spoken axe prompt as A, a, x.
        // Match all three slots in order, and only on an assessed recording.
        const axeAlias = id === 'axe' && meta.targetStatus === 'checked' && heard.length === 3 &&
          ['a', 'ay'].includes(heard[0]) && ['a', 'ah', 'ae', 'æ'].includes(heard[1]) &&
          ['axe', 'ax', 'x'].includes(heard[2]);
        return axeAlias ? tokens.map(text => ({ text, heardClear: true, basis: 'phonics-transcript-alias' })) : meta.targetWords;
      },
      onStateChange: phase => { if (phase === 'recording') stopAudio(); },
      onAssessment: (_text, meta) => {
        if (ticket !== revision) return;
        const passed = meta.targetWords?.length === tokens.length && meta.targetWords.every(word => word.heardClear === true);
        state.speechPassed[id] = passed;
        if (!passed) state.speechFailures[id] = (state.speechFailures[id] || 0) + 1;
        save();
      },
      onTechnicalError: (_error, permission) => {
        if (ticket !== revision) return;
        if (permission || !Recorder.isSupported()) state.microphoneUnavailable = true;
        state.technical[id] = true;
        save();
      },
      onDone: () => {
        if (ticket !== revision) return;
        $('continue').disabled = false;
        advance();
      }
    });
    $('speech-buttons').replaceChildren(practiceGate);
    recordButton = practiceGate.querySelector('.speech-rec-btn');
    document.querySelector('.study-actions').hidden = true;
  }

  function enterRound(stage) {
    state.stage = stage;
    state.index = 0;
    state.question = null;
    state.turn = 0;
    state.queue = stage === 'B' || stage === 'C' ? shuffle(targets()).map(id => ({ id, after: 0, lastPosition: -1 })) : [];
    render();
  }

  function newQuestion() {
    const eligible = state.queue.findIndex(item => item.after <= state.turn);
    const index = eligible >= 0 ? eligible : 0;
    const entry = state.queue.splice(index, 1)[0];
    const target = bank[entry.id];
    let candidates = Object.keys(bank).filter(id => id !== entry.id);
    if (state.stage === 'C') {
      candidates = candidates.filter(id => !!bank[id].letter === !!target.letter &&
        (target.letter || bank[id].initial !== target.initial));
    }
    const options = shuffle([entry.id, ...shuffle(candidates).slice(0, 2)]);
    const position = options.indexOf(entry.id);
    if (position === entry.lastPosition) {
      const other = (position + 1 + Math.floor(Math.random() * 2)) % 3;
      [options[position], options[other]] = [options[other], options[position]];
    }
    return { id: entry.id, options, failed: false, answered: false };
  }

  function renderRecognition() {
    if (!state.question) state.question = newQuestion();
    save();
    const question = state.question;
    $('instruction').textContent = '听声音，点选正确答案。';
    const grid = document.createElement('div'); grid.className = 'choice-grid';
    question.options.forEach(id => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `choice game-btn bg-indigo-500 hover:bg-indigo-400 text-xl sm:text-2xl px-4 py-4 rounded-xl shadow-lg ${state.stage === 'C' ? 'text-only' : ''}`;
      button.append(picture(id, state.stage === 'C'));
      button.onclick = () => {
        if (question.answered) return;
        const correct = id === question.id;
        if (state.stage === 'C' && !bank[question.id].letter && !(question.id in state.first)) {
          state.first[question.id] = correct;
        }
        if (!correct) {
          question.failed = true;
          button.classList.add('wrong');
          $('feedback').textContent = '再听一听，试试另一个答案。';
        } else {
          question.answered = true;
          button.classList.add('correct');
          $('feedback').textContent = question.failed ? '选对了！稍后会再练一次。' : '选对了！';
          $('continue').disabled = false;
        }
        save();
      };
      if (question.answered && id === question.id) button.classList.add('correct');
      grid.append(button);
    });
    $('exercise').append(grid);
    $('continue').disabled = !question.answered;
    selectPrompt(question.id, state.stage);
    playPrompt();
  }

  function renderHandwriting() {
    if (state.nativeAdvancePending || (state.nativeWriting && state.nativeWriting.cursor >= state.nativeWriting.gaps.length)) {
      state.index++;
      delete state.nativeWriting;
      state.nativeAdvancePending = false;
      if (state.index >= state.words.length) complete();
      else render();
      return;
    }
    const ticket = revision;
    STUDY_STATE.words = [...state.words].sort();
    STUDY_STATE.currentWordIndex = state.index;
    STUDY_STATE.isTransitioning = false;
    $('instruction').textContent = '听一听，写出缺少的首字母，大写或小写都可以。';
    $('speech-controls').hidden = true;
    hwEnsureFont().then(() => {
      if (ticket !== revision) return;
      nextRoundDWord(state.nativeWriting || undefined);
    });
  }

  function complete() {
    const results = state.words.map(word => ({ type: 'vocab', key: `phonics1:word:${word}`, firstAttempt: state.first[word] === true }));
    state.sr = updateSRStateForSession(state.sr, results, 0, state.runId);
    state.completed = true;
    state.stage = 'done';
    render();
  }

  function renderSummary() {
    $('instruction').textContent = 'A–D 四轮已完成，以下是本次 Round C 的 SR 结果。';
    $('continue').hidden = true;
    $('speech-controls').hidden = true;
    $('replay').hidden = true;
    $('meaning').hidden = true;
    const summary = document.createElement('div'); summary.className = 'summary';
    const rows = state.words.map(word => {
      const record = state.sr.vocab[`phonics1:word:${word}`];
      return `<tr><td>${word}</td><td>${record.lastResult === 'success' ? '首次选对' : '首次选错'}</td><td>${record.interval} 次练习后</td></tr>`;
    }).join('');
    summary.innerHTML = `<p>本次试用完成 1 次 Study</p><table><thead><tr><th>单词</th><th>Round C 首次结果</th><th>再次到期</th></tr></thead><tbody>${rows}</tbody></table><p>正式下一步会按词池进入 B b 并先显示它的预习。当前试用包含 A 页完整练习。</p><button type="button">清除试用记录，再试一次</button>`;
    summary.querySelector('button').className = 'game-btn bg-green-500 py-3 px-6';
    summary.querySelector('button').onclick = () => { state = freshState(); render(); };
    $('exercise').append(summary);
  }

  function advance() {
    if ($('continue').disabled) return;
    if (state.stage === 'A') {
      if (state.microphoneUnavailable || ++state.index >= targets().length) enterRound('B');
      else render();
    } else if (state.stage === 'B' || state.stage === 'C') {
      const question = state.question;
      if (!question?.answered) return;
      state.turn++;
      if (question.failed) state.queue.push({ id: question.id, after: state.turn + 2, lastPosition: question.options.indexOf(question.id) });
      state.question = null;
      if (!state.queue.length) enterRound(state.stage === 'B' ? 'C' : 'D');
      else render();
    }
  }

  const nativeNextHandwritingWord = nextRoundDWord;
  window.currentTTSWord = '';
  window.playTTS = playPrompt;
  window.showTranslation = elementId => { const element = $(elementId); if (element) element.classList.add('hidden'); };
  window.showVocabImage = (elementId, word) => {
    const image = $(elementId);
    image.src = `${base}${word}/picture.webp`;
    image.alt = bank[word].meaning;
    image.classList.remove('hidden');
  };
  window.startExerciseTracking = () => {};
  window.incrementExerciseAttempts = save;
  window.initAudio = () => {};
  window.synthGem = () => {};
  window.synthError = () => {};
  window.queueExerciseEvent = (type, _mode, word) => {
    if (type !== 'handwriting' && type !== 'handwritingAssisted') return;
    state.handwriting[word] = { done: true, assisted: type === 'handwritingAssisted' };
    save();
  };
  window.StudyRecovery = { capture: save };
  window.nextRoundDWord = saved => {
    state.index = STUDY_STATE.currentWordIndex;
    if (state.index >= state.words.length) { complete(); return; }
    selectPrompt(STUDY_STATE.words[state.index], 'D');
    nativeNextHandwritingWord(saved);
    save();
  };
  window.finishRoundD = complete;
  $('replay').onclick = playPrompt;
  $('continue').onclick = advance;
  window.addEventListener('pagehide', () => {
    stopAudio();
    save();
    recordButton?.disposeSpeech();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAudio(); save(); } });
  document.addEventListener('DOMContentLoaded', () => {
    try { document.body.classList.toggle('kid-friendly', localStorage.getItem('theme-kid-friendly') === 'true'); } catch (_) {}
    state = restore();
    hwEnsureFont();
    HWRecognition.load();
    render();
  });
})();
