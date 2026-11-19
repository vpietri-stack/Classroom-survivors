(function () {
    'use strict';
    const content = window.PhonicsContent;
    const labels = { A: '听一听，读一读', B: '看图选答案', C: '听音认字', D: '写首字母' };
    const rounds = { A: 'A', B: 'C', C: 'E', D: 'D' };
    const audio = new Audio();
    let current = null, gate = null, generation = 0, choiceResize = null;
    const state = () => STUDY_STATE.phonics;
    const area = () => document.getElementById('study-game-area');

    function shuffled(items) {
        const result = [...items];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    function assigned() {
        return typeof authActiveUser !== 'undefined' && authActiveUser?.book === 'Phonics1';
    }
    function requirePreview() {
        if (!assigned()) return false;
        window.PhonicsPictureBookStudy?.retryAdvance();
        if (!window.StudyRecovery?.hasPendingFor(authActiveUser)) checkAndAdvancePageIfAllOnCooldown();
        const note = PreviewNotesState.atPage(authActiveUser);
        if (!note || !PreviewNotes.blocksAdvance(authActiveUser, authActiveUser)) return false;
        selectedClassContent = { ...selectedClassContent, book: 'Phonics1', unit: String(authActiveUser.unit), page: String(authActiveUser.page) };
        PreviewNotes.openNote(note.id, false);
        return true;
    }
    function prepare(options) {
        if (selectedClassContent?.book !== 'Phonics1') return null;
        if (!options.previewNoteId && requirePreview()) return null;
        const page = String(selectedClassContent.page);
        const note = PreviewNotesState.atPage(selectedClassContent);
        if (options.previewNoteId && note?.id !== options.previewNoteId) return null;
        const sr = authActiveUser?.srState?.vocab || {};
        const sorted = sortPoolBySR(content.pool(page), sr, getCurrentSession(), Number(page) - 1);
        const picked = pickWithNewQuota(sorted, 4);
        if (picked.length < 4 && page === '5') {
            const cooldown = [...(sorted._cooldown || [])].sort((a, b) => a.priority.dueAfterSession - b.priority.dueAfterSession);
            picked.push(...cooldown.slice(0, 4 - picked.length));
        }
        const words = picked.map(item => item.word);
        if (words.length !== 4) { showStudyNotice('这一页的字母练习暂未准备好。'); return null; }
        const letters = [...new Set(words.map(word => content.entry(word).letter))].sort().map(letter => 'letter-' + letter);
        return {
            words,
            context: options.previewNoteId ? { id: note.id, owner: authActiveUser.id, book: 'Phonics1', unit: String(selectedClassContent.unit), page, version: note.version } : null,
            state: { schema: 1, stage: 'A', index: 0, words, letters, labels, turn: 0, queue: [], question: null,
                first: {}, speech: null, microphoneUnavailable: false, completed: false }
        };
    }
    function targets() { return [...state().letters, ...[...state().words].sort()]; }
    function info(id) {
        if (id.startsWith('letter-')) {
            const config = content.letter(id.slice(7));
            return { letter: config.letter, config, text: config.letter.toUpperCase() + ' ' + config.letter, isLetter: true };
        }
        const entry = content.entry(id);
        return { ...entry, config: content.letter(entry.letter), text: id, isLetter: false };
    }
    function capture() {
        if (state() && gate?.isConnected) state().speech = { id: current?.id, snapshot: gate.studyResumeState() };
    }
    function save() { capture(); window.StudyRecovery?.capture(); }
    function cancel() {
        generation++; audio.pause();
        choiceResize?.disconnect(); choiceResize = null;
        studyCancelPending('recognition_next');
        document.getElementById('studyModeOverlay').classList.remove('phonics-study-active');
        if (gate) gate.querySelector('.speech-rec-btn')?.disposeSpeech?.();
        gate = null; current = null;
    }
    function setAudio(id, mode) {
        const item = info(id);
        current = { id, letter: item.letter, clip: item.isLetter ? 'letter-sounds.mp3' : `${id}/${mode === 'A' || mode === 'D' ? 'sequence' : 'word'}.mp3` };
        currentTTSWord = item.text;
        content.warm(item.letter).catch(() => {});
    }
    function playAudio() {
        if (!current) return;
        audio.pause(); audio.src = content.audioURL(current.letter, current.clip);
        audio.play().catch(() => showStudyNotice('请再点一次喇叭播放录音。'));
    }
    function speaker() {
        const button = document.createElement('button');
        button.className = 'audio-play-btn'; button.type = 'button'; button.setAttribute('aria-label', '听示范');
        button.innerHTML = '<i class="fas fa-volume-up" aria-hidden="true"></i>'; button.onclick = playAudio;
        return button;
    }
    function image(id, pictureOnly) {
        const item = info(id), art = new Image();
        art.src = item.config.assetBase + (item.isLetter ? 'letter-pictures.webp' : `${id}/${pictureOnly ? 'picture' : 'word'}.webp`);
        art.alt = item.isLetter ? item.text : item.meaning;
        art.className = item.isLetter ? 'phonics-letter-picture' : 'phonics-word-picture';
        return art;
    }
    function render(resuming) {
        cancel();
        const s = state(); if (!s || s.completed) return;
        document.getElementById('studyModeOverlay').classList.add('phonics-study-active');
        STUDY_STATE.round = rounds[s.stage];
        STUDY_STATE.currentWordIndex = s.index;
        STUDY_STATE.isTransitioning = false;
        updateStudyUI(`Round ${s.stage}: ${labels[s.stage]}`, s.stage === 'A' ? '听示范，再录音跟读。' : '听声音，选择正确答案。');
        area().replaceChildren();
        if (s.stage === 'D') {
            updateStudyUI('Round D: 写首字母', '写出缺少的首字母，大写或小写都可以。');
            STUDY_STATE.currentWordIndex = s.index;
            const ticket = generation;
            hwEnsureFont().then(() => {
                if (ticket !== generation) return;
                nextRoundDWord(resuming?.handwriting || undefined);
                if (resuming?.handwriting?.cursor >= resuming?.handwriting?.gaps?.length) {
                    studyLater('handwriting_letter', roundDShowTarget, 140);
                }
            });
            return;
        }
        const wrapper = document.createElement('div'); wrapper.className = 'flex flex-col items-center gap-3 w-full';
        wrapper.append(speaker()); area().append(wrapper);
        if (s.stage === 'A') speaking(wrapper);
        else recognition(wrapper, resuming);
        save();
    }
    function speaking(wrapper) {
        const s = state(), id = targets()[s.index], item = info(id), config = item.config;
        setAudio(id, 'A');
        const art = image(id); art.onclick = playAudio; wrapper.append(art);
        const meaning = document.createElement('div'); meaning.className = 'translation-hint';
        meaning.textContent = item.isLetter ? item.text + ' 字母与发音' : item.meaning;
        wrapper.append(meaning);
        const expected = item.isLetter
            ? [config.letterName, config.letterName, config.soundText, config.soundText, config.soundText]
            : [config.letterName, config.soundText, id];
        const display = item.isLetter
            ? ['"' + config.letter.toUpperCase() + '"', '"' + config.letter.toUpperCase() + '"', config.ipa, config.ipa, config.ipa]
            : ['"' + config.letter.toUpperCase() + '"', config.ipa, id];
        const tiles = display.map((text, index) => {
            const tile = document.createElement('span'); tile.className = 'study-word-tile';
            tile.dataset.word = expected[index]; tile.textContent = text; return tile;
        });
        const row = document.createElement('div'); row.className = 'flex flex-wrap justify-center gap-3'; row.append(...tiles); wrapper.append(row);
        const ticket = generation;
        const previous = s.speech?.id === id ? s.speech.snapshot : null;
        gate = SpeechUI.makeSentenceGate({
            target: expected.join(' '), wordTiles: tiles, book: 'Phonics1', mode: 'study', level: 1,
            requireAllHeard: true, resumeState: previous,
            assessmentProfile: 'phonics1-initial',
            resolveTargetWords: (text, meta) => content.axeResults(text, meta, expected.join(' ')),
            onStateChange: phase => { if (phase === 'recording') audio.pause(); },
            onAssessment: () => { if (ticket === generation) save(); },
            onTechnicalError: (_error, permission) => {
                if (ticket !== generation) return;
                if (permission || !Recorder.isSupported()) s.microphoneUnavailable = true;
                save();
            },
            onDone: () => {
                if (ticket !== generation) return;
                s.speech = null;
                if (s.microphoneUnavailable || ++s.index === targets().length) enter('B');
                else render();
            }
        });
        wrapper.append(gate);
        if (!Recorder.isSupported()) {
            s.microphoneUnavailable = true;
            enter('B');
        }
    }
    function enter(stage) {
        const s = state(); s.stage = stage; s.index = 0; s.turn = 0; s.question = null; s.speech = null;
        s.queue = stage === 'B' || stage === 'C' ? shuffled(targets()).map(id => ({ id, after: 0, lastPosition: -1 })) : [];
        if (stage === 'D') { roundDSkipUnlocked = false; STUDY_STATE.words = [...s.words].sort(); }
        render();
    }
    function nextQuestion() {
        const s = state();
        const ready = s.queue.findIndex(entry => entry.after <= s.turn);
        const entry = s.queue.splice(ready < 0 ? 0 : ready, 1)[0];
        const target = info(entry.id);
        const bank = Object.values(content.pages).flatMap(config => ['letter-' + config.letter, ...config.words]);
        let distractors = bank.filter(id => id !== entry.id && info(id).config.page !== target.config.page);
        if (s.stage === 'C') distractors = distractors.filter(id => {
            const option = info(id);
            return option.isLetter === target.isLetter && (target.isLetter || option.letter !== target.letter);
        });
        const options = shuffled([entry.id, ...shuffled(distractors).slice(0, 2)]);
        const position = options.indexOf(entry.id);
        if (position === entry.lastPosition) [options[position], options[(position + 1) % 3]] = [options[(position + 1) % 3], options[position]];
        return { id: entry.id, options, failed: false, answered: false };
    }
    function recognition(wrapper, resuming) {
        const s = state();
        s.question ||= nextQuestion();
        const question = s.question;
        STUDY_STATE.currentWordIndex = s.turn;
        setAudio(question.id, s.stage);
        const grid = document.createElement('div'); grid.className = 'phonics-options flex flex-wrap justify-center gap-3 w-full';
        if (s.stage === 'C') grid.classList.add('phonics-text-options');
        const feedback = document.createElement('p'); feedback.className = 'hw-status'; feedback.setAttribute('role', 'status');
        const ticket = generation;
        function advance() {
            if (ticket !== generation || state() !== s || s.question !== question || !question.answered) return;
            s.turn++;
            if (question.failed) s.queue.push({ id: question.id, after: s.turn + 2, lastPosition: question.options.indexOf(question.id) });
            s.question = null; startExerciseTracking();
            if (!s.queue.length) enter(s.stage === 'B' ? 'C' : 'D'); else render();
        }
        function scheduleAdvance(delay = 650) {
            STUDY_STATE.isTransitioning = true;
            studyLater('recognition_next', advance, delay);
        }
        question.options.forEach(id => {
            const button = document.createElement('button'); button.type = 'button';
            button.className = 'game-btn bg-indigo-500 hover:bg-indigo-400 text-xl sm:text-2xl px-4 py-4 rounded-xl shadow-lg phonics-option';
            if (s.stage === 'C') button.classList.add('phonics-text-option');
            if (s.stage === 'C' && info(id).isLetter) button.classList.add('phonics-letter-option');
            if (s.stage === 'B') button.append(image(id));
            else {
                const option = info(id), initial = document.createElement('span');
                initial.className = 'phonics-focus-letter';
                initial.textContent = option.isLetter ? option.letter : option.text[0];
                if (option.isLetter) button.append(document.createTextNode(option.letter.toUpperCase() + ' '), initial);
                else button.append(initial, document.createTextNode(option.text.slice(1)));
            }
            if (question.answered && id === question.id) button.classList.add('correct');
            button.onclick = () => {
                if (question.answered) return;
                const correct = id === question.id;
                if (s.stage === 'C' && !info(question.id).isLetter && !(question.id in s.first)) {
                    s.first[question.id] = correct;
                    srStudyResults.push({ type: 'vocab', key: 'phonics1:word:' + question.id, firstAttempt: correct });
                }
                if (!correct) {
                    question.failed = true; incrementExerciseAttempts(); synthError();
                    button.classList.add('shake'); setTimeout(() => button.classList.remove('shake'), 500);
                    feedback.textContent = '再听一听，试试另一个答案。'; playAudio();
                } else {
                    question.answered = true; playHappySound(); button.classList.add('correct');
                    queueExerciseEvent('wordRecognition', 'study', info(question.id).text);
                    feedback.textContent = question.failed ? '选对了，稍后再练一次。' : '选对了！';
                    audio.pause();
                    scheduleAdvance();
                }
                save();
            };
            grid.append(button);
        });
        wrapper.append(grid, feedback);
        if (s.stage === 'C') {
            const fit = () => {
                if (ticket !== generation) return;
                grid.querySelectorAll('button').forEach(button => {
                    button.style.removeProperty('font-size');
                    let size = parseFloat(getComputedStyle(button).fontSize);
                    while (button.scrollWidth > button.clientWidth && size > 24) {
                        size -= 2; button.style.fontSize = size + 'px';
                    }
                });
            };
            let lastWidth = -1;
            choiceResize = new ResizeObserver(entries => {
                const width = entries[0].contentRect.width;
                if (width !== lastWidth) { lastWidth = width; fit(); }
            });
            choiceResize.observe(grid);
            document.fonts.ready.then(fit);
        }
        if (question.answered) scheduleAdvance(resuming?.pending?.remainingMs ?? 650);
        if (!resuming) playAudio();
    }
    function beforeHandwriting() {
        const s = state(); if (!s || s.stage !== 'D') return;
        s.index = STUDY_STATE.currentWordIndex;
        if (s.index < STUDY_STATE.words.length) setAudio(STUDY_STATE.words[s.index], 'D');
    }
    function handwritingAssets() {
        const word = STUDY_STATE.words[STUDY_STATE.currentWordIndex], entry = content.entry(word);
        const art = document.getElementById('roundD-image');
        if (art) {
            delete art.dataset.pendingVocab;
            art.src = entry.assetBase + word + '/picture.webp'; art.alt = entry.meaning; art.classList.remove('hidden');
        }
        const button = area().querySelector('.audio-play-btn');
        if (button) { button.removeAttribute('onclick'); button.onclick = playAudio; }
        save();
    }
    function complete() {
        if (!state() || state().completed) return;
        state().completed = true; cancel();
        if (roundDTrace) { roundDTrace.destroy(); roundDTrace = null; }
        finishStudySession();
    }
    function restore(saved) {
        if (!state()?.words?.every(word => content.entry(word))) return false;
        if (saved.speech && state().stage === 'A') state().speech = { id: targets()[state().index], snapshot: saved.speech };
        if (state().stage === 'D' && saved.pending?.action === 'handwriting_word') {
            state().index++;
            if (state().index === state().words.length) { complete(); return true; }
            render(); return true;
        }
        render(saved); return true;
    }
    window.PhonicsStudy = { prepare, render, capture, restore, cancel, complete, requirePreview, beforeHandwriting, handwritingAssets, playAudio };
})();
