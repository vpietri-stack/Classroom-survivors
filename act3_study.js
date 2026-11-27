// Act3 5-round Study Mode sequence:
//   Round A: Listen & Repeat (5 vocab items)
//   Round B: Handwriting (first letter of each syllable; 2 letters for 1-syllable; guide visible)
//   Round C: Missing Letters (only the missing syllable-start letters in a depleting bank)
//   Round D: Word Recognition (Phonics1-style 3-choice audio recognition with re-queue on miss)
//   Round E: Sentence Scramble with listening available
(function () {
    'use strict';

    const PUNCTUATION = [' ', "'", '-', '.', '?', '!', ','];

    function state() {
        return STUDY_STATE.act3;
    }

    function area() {
        return document.getElementById('study-game-area');
    }

    function shuffled(items) {
        const arr = [...items];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function createState() {
        return {
            stage: 'A',
            index: 0,
            recQueue: [],
            recTurn: 0,
            recQuestion: null,
            recFirst: {},
            missingFrozen: false,
            missingGaps: null,
            labels: {
                A: 'Listen',
                B: 'Write',
                C: 'Missing',
                D: 'Recognize',
                E: 'Sentence'
            }
        };
    }

    function start() {
        if (!state()) STUDY_STATE.act3 = createState();
        enter('A');
    }

    function cancel() {
        studyCancelPending('act3_c_next');
        studyCancelPending('act3_c_reset');
        studyCancelPending('act3_d_next');
        const host = area();
        if (host) {
            host.querySelectorAll('.speech-rec-btn').forEach(btn => {
                if (typeof btn.disposeSpeech === 'function') btn.disposeSpeech();
            });
        }
    }

    function enter(stage) {
        const s = state();
        if (!s) return;
        s.stage = stage;
        s.index = 0;
        s.missingFrozen = false;
        STUDY_STATE.isTransitioning = false;

        if (stage === 'A') {
            STUDY_STATE.round = 'A';
            updateStudyUI('Round A: Listen & Repeat', 'Listen and repeat the word.');
            startExerciseTracking();
            renderA();
        } else if (stage === 'B') {
            startRoundD();
        } else if (stage === 'C') {
            STUDY_STATE.round = 'C';
            updateStudyUI('Round C: Missing Letters', 'Fill in the missing letters.');
            startExerciseTracking();
            renderC();
        } else if (stage === 'D') {
            STUDY_STATE.round = 'F';
            s.recTurn = 0;
            s.recQuestion = null;
            s.recFirst = {};
            s.recQueue = shuffled(STUDY_STATE.words).map(word => ({
                word,
                after: 0,
                lastPosition: -1
            }));
            updateStudyUI('Round D: Word Recognition', 'Listen and tap the matching word.');
            startExerciseTracking();
            renderD();
        } else if (stage === 'E') {
            startRoundE();
        }
    }

    // --- Round A: Listen & Repeat ---
    function renderA(savedSpeech) {
        const s = state();
        if (!s || !STUDY_STATE.active) return;
        if (s.index >= STUDY_STATE.words.length) {
            enter('B');
            return;
        }
        STUDY_STATE.round = 'A';
        s.stage = 'A';
        STUDY_STATE.currentWordIndex = s.index;

        const word = STUDY_STATE.words[s.index];
        currentTTSWord = word;

        const host = area();
        host.innerHTML = `
            <div class="flex flex-col items-center gap-3 w-full max-w-2xl mx-auto px-2">
                <div class="text-sm text-gray-300">${s.index + 1} / ${STUDY_STATE.words.length}</div>
                <button onclick="playTTS()" aria-label="Play Audio" class="audio-play-btn"><i class="fas fa-volume-up"></i></button>
                <div id="act3-a-translation" class="translation-hint hidden"></div>
                <img id="act3-a-image" class="vocab-image hidden" alt="Vocabulary Image">
                <div id="act3-a-word" class="flex flex-wrap justify-center gap-2"></div>
                <div id="act3-a-controls" class="flex flex-col items-center gap-3 w-full mt-2"></div>
            </div>
        `;
        showTranslation('act3-a-translation', word, 'Act3');
        showVocabImage('act3-a-image', word, 'Act3');

        const wordRow = document.getElementById('act3-a-word');
        const tiles = word.split(' ').map(token => {
            const tile = document.createElement('span');
            tile.className = 'study-word-tile';
            tile.dataset.word = token;
            tile.textContent = token;
            wordRow.appendChild(tile);
            return tile;
        });

        const advanceA = () => {
            if (!STUDY_STATE.active || !state() || state().stage !== 'A') return;
            queueExerciseEvent('listenRepeat', 'study', word);
            s.index++;
            startExerciseTracking();
            renderA();
        };

        const controls = document.getElementById('act3-a-controls');
        const speechReady = Boolean(
            window.SpeechUI &&
            typeof SpeechUI.makeSentenceGate === 'function' &&
            typeof SpeechUI.isReady === 'function' &&
            SpeechUI.isReady() &&
            (!window.Recorder || typeof Recorder.isSupported !== 'function' || Recorder.isSupported())
        );

        if (speechReady) {
            const gate = SpeechUI.makeSentenceGate({
                target: word,
                wordTiles: tiles,
                book: 'Act3',
                mode: 'study',
                level: 1,
                resumeState: savedSpeech || null,
                onDone: advanceA
            });
            controls.appendChild(gate);
        } else {
            const nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.id = 'act3-a-next';
            nextBtn.className = 'game-btn bg-green-500 py-3 px-8 text-lg';
            nextBtn.textContent = s.index + 1 >= STUDY_STATE.words.length ? '开始写字母' : '下一个';
            nextBtn.onclick = advanceA;
            controls.appendChild(nextBtn);
        }

        if (!savedSpeech) playTTS();
    }

    // --- Round C: Missing Letters ---
    function missingSlots() {
        return Array.from(document.querySelectorAll('#act3-missing-slots .study-slot'));
    }

    function createMissingBankButton(char) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'study-letter-btn';
        btn.innerText = char;
        btn.dataset.char = char;
        btn.onclick = () => placeMissingLetter(char, btn);
        return btn;
    }

    function renderC() {
        const s = state();
        if (!s || !STUDY_STATE.active) return;
        if (s.index >= STUDY_STATE.words.length) {
            enter('D');
            return;
        }
        STUDY_STATE.round = 'C';
        s.stage = 'C';
        STUDY_STATE.currentWordIndex = s.index;
        s.missingFrozen = false;
        STUDY_STATE.isTransitioning = false;

        const word = STUDY_STATE.words[s.index];
        currentTTSWord = word;

        const host = area();
        host.innerHTML = `
            <div class="flex flex-col items-center gap-3 w-full">
                <button onclick="playTTS()" aria-label="Play Audio" class="audio-play-btn"><i class="fas fa-volume-up"></i></button>
                <div id="act3-c-translation" class="translation-hint hidden"></div>
                <img id="act3-c-image" class="vocab-image hidden" alt="Vocabulary Image">

                <div id="act3-missing-slots" class="flex flex-wrap justify-center gap-[var(--gap-sm)] min-h-[54px] w-full px-2"></div>

                <div id="act3-missing-bank" class="flex flex-wrap justify-center gap-[var(--gap-sm)] w-full px-2"></div>

                <div id="act3-c-actions" class="flex gap-3 w-full justify-center">
                    <button id="act3-c-check" type="button" class="game-btn bg-green-500 py-3 px-6 flex-1 max-w-[160px]">CHECK</button>
                    <button id="act3-c-clear" type="button" class="game-btn bg-gray-500 py-3 px-6 flex-1 max-w-[160px]">CLEAR</button>
                </div>
            </div>
        `;
        showTranslation('act3-c-translation', word, 'Act3');
        showVocabImage('act3-c-image', word, 'Act3');

        const gapIndices = s.missingGaps ||= getAct3MissingLetterIndices(word);
        const gapSet = new Set(gapIndices);
        const slotsDiv = document.getElementById('act3-missing-slots');
        slotsDiv.innerHTML = '';

        let groupEl = null;
        const flushGroup = () => {
            if (groupEl && groupEl.children.length) slotsDiv.appendChild(groupEl);
            groupEl = null;
        };

        for (let i = 0; i < word.length; i++) {
            const ch = word[i];
            if (PUNCTUATION.includes(ch)) {
                flushGroup();
                const slot = document.createElement('div');
                slot.className = 'study-slot hw-slot-fixed select-none';
                slot.style.color = '#94a3b8';
                slot.innerText = ch;
                slot.dataset.fixed = 'true';
                slotsDiv.appendChild(slot);
                continue;
            }
            if (!groupEl) {
                groupEl = document.createElement('div');
                groupEl.className = 'word-group';
            }
            const slot = document.createElement('div');
            if (gapSet.has(i)) {
                slot.className = 'study-slot bg-gray-800';
                slot.dataset.gap = 'true';
                slot.dataset.expected = ch;
                slot.dataset.index = String(i);
                slot.onclick = () => removeMissingSlot(slot);
            } else {
                slot.className = 'study-slot hw-slot-given select-none';
                slot.innerText = ch;
                slot.dataset.given = 'true';
            }
            groupEl.appendChild(slot);
        }
        flushGroup();
        if (typeof fitAnswerArea === 'function') fitAnswerArea(slotsDiv);

        const bankDiv = document.getElementById('act3-missing-bank');
        bankDiv.innerHTML = '';
        const missingLetters = shuffled(gapIndices.map(i => word[i]));
        missingLetters.forEach(char => {
            bankDiv.appendChild(createMissingBankButton(char));
        });

        document.getElementById('act3-c-check').onclick = checkMissing;
        document.getElementById('act3-c-clear').onclick = clearMissing;

        playTTS();
    }

    function placeMissingLetter(char, btnEl) {
        const s = state();
        if (!s || STUDY_STATE.isTransitioning || s.missingFrozen) return;
        const slots = missingSlots();
        const empty = slots.find(slot => slot.dataset.gap === 'true' && !slot.innerText);
        if (!empty) return;
        empty.innerText = char;
        if (btnEl && btnEl.parentElement) btnEl.remove();
    }

    function removeMissingSlot(slot) {
        const s = state();
        if (!s || STUDY_STATE.isTransitioning || s.missingFrozen) return;
        if (!slot || slot.dataset.gap !== 'true' || !slot.innerText) return;
        const char = slot.innerText;
        slot.innerText = '';
        const bank = document.getElementById('act3-missing-bank');
        if (bank) bank.appendChild(createMissingBankButton(char));
        resetMissingSlotColors();
    }

    function resetMissingSlotColors() {
        missingSlots().forEach(slot => {
            if (slot.dataset.gap !== 'true') return;
            slot.classList.remove('bg-green-500', 'bg-red-500');
            slot.classList.add('bg-gray-800');
        });
    }

    function clearMissing() {
        studyCancelPending('act3_c_reset');
        const s = state();
        if (!s || STUDY_STATE.isTransitioning) return;
        const bank = document.getElementById('act3-missing-bank');
        missingSlots().forEach(slot => {
            if (slot.dataset.gap !== 'true') return;
            if (slot.innerText) {
                const char = slot.innerText;
                slot.innerText = '';
                if (bank) bank.appendChild(createMissingBankButton(char));
            }
        });
        resetMissingSlotColors();
        s.missingFrozen = false;
    }

    function checkMissing() {
        const s = state();
        if (!s || STUDY_STATE.isTransitioning || s.missingFrozen) return;
        const gapSlots = missingSlots().filter(slot => slot.dataset.gap === 'true');
        if (gapSlots.some(slot => !slot.innerText)) {
            synthError();
            return;
        }

        let allCorrect = true;
        gapSlots.forEach(slot => {
            const ok = slot.innerText.toLowerCase() === (slot.dataset.expected || '').toLowerCase();
            slot.classList.remove('bg-gray-800', 'bg-green-500', 'bg-red-500');
            slot.classList.add(ok ? 'bg-green-500' : 'bg-red-500');
            if (!ok) allCorrect = false;
        });

        const word = STUDY_STATE.words[s.index];
        if (allCorrect) {
            STUDY_STATE.isTransitioning = true;
            s.missingFrozen = true;
            playHappySound();
            const game = window.Act3Game?.active();
            queueExerciseEvent('missingLetters', game ? 'game' : 'study', word);
            if (game) { Act3Game.wordSpeech(word, 'act3-missing-slots', 'act3-c-actions'); return; }
            studyLater('act3_c_next', advanceMissingWord, 900);
            return;
        }

        s.missingFrozen = true;
        synthError();
        incrementExerciseAttempts();
        studyLater('act3_c_reset', clearMissing, 5000);
    }

    function advanceMissingWord() {
        const s = state();
        if (!STUDY_STATE.active || !s) return;
        s.index++;
        s.missingGaps = null;
        s.missingFrozen = false;
        STUDY_STATE.isTransitioning = false;
        startExerciseTracking();
        renderC();
    }

    function handleKeyDown(key) {
        const s = state();
        if (!s || s.stage !== 'C') return;
        if (key === 'Backspace') {
            const gapSlots = missingSlots().filter(slot => slot.dataset.gap === 'true');
            for (let i = gapSlots.length - 1; i >= 0; i--) {
                if (gapSlots[i].innerText) {
                    removeMissingSlot(gapSlots[i]);
                    break;
                }
            }
        } else if (key.length === 1 && /[a-z0-9]/i.test(key)) {
            const bank = document.getElementById('act3-missing-bank');
            if (!bank) return;
            for (const btn of bank.children) {
                if (btn.innerText.toLowerCase() === key.toLowerCase()) {
                    placeMissingLetter(btn.innerText, btn);
                    break;
                }
            }
        } else if (key === 'Enter') {
            checkMissing();
        }
    }

    // --- Round D: Word Recognition (Phonics1 style) ---
    function distractorPool(targetWord) {
        const selected = typeof selectedClassContent !== 'undefined' && selectedClassContent ? selectedClassContent : {};
        const book = selected.book || 'Act3';
        const unit = String(selected.unit || '1');
        const page = String(selected.page || '3');
        const pageVocab = (typeof TEACHING_CONTENT !== 'undefined' && TEACHING_CONTENT[book]?.[unit]?.[page]?.vocab) || STUDY_STATE.words || [];
        const seen = new Set([targetWord]);
        const candidates = [];
        for (const w of pageVocab) {
            if (!seen.has(w)) {
                seen.add(w);
                candidates.push(w);
            }
        }
        if (candidates.length < 2 && typeof TEACHING_CONTENT !== 'undefined' && TEACHING_CONTENT[book]?.[unit]) {
            for (const pData of Object.values(TEACHING_CONTENT[book][unit])) {
                for (const w of (pData.vocab || [])) {
                    if (!seen.has(w)) {
                        seen.add(w);
                        candidates.push(w);
                    }
                }
            }
        }
        return candidates;
    }

    function nextRecognitionQuestion() {
        const s = state();
        const readyIdx = s.recQueue.findIndex(entry => entry.after <= s.recTurn);
        const entry = s.recQueue.splice(readyIdx < 0 ? 0 : readyIdx, 1)[0];
        return recognitionQuestion(entry.word, [], entry.lastPosition);
    }

    function recognitionQuestion(word, previous = [], lastPosition = previous.indexOf(word)) {
        const pool = shuffled(distractorPool(word));
        const distractors = [...pool.filter(w => !previous.includes(w)), ...pool.filter(w => previous.includes(w))].slice(0, 2);
        const options = shuffled([word, ...distractors]);
        const pos = options.indexOf(word);
        if (options.length > 1 && pos === lastPosition) {
            const nextPos = (pos + 1) % options.length;
            [options[pos], options[nextPos]] = [options[nextPos], options[pos]];
        }
        return { word, options, failed: false, answered: false };
    }

    function renderD(resuming) {
        const s = state();
        if (!s || !STUDY_STATE.active) return;
        if (!s.recQuestion && !s.recQueue.length) {
            enter('E');
            return;
        }
        STUDY_STATE.round = 'F';
        s.stage = 'D';
        STUDY_STATE.currentWordIndex = s.recTurn;
        if (!s.recQuestion) s.recQuestion = nextRecognitionQuestion();
        const question = s.recQuestion;
        currentTTSWord = question.word;

        const host = area();
        host.innerHTML = `
            <div class="flex flex-col items-center gap-3 w-full max-w-2xl mx-auto px-2">
                <button onclick="playTTS()" aria-label="Play Audio" class="audio-play-btn"><i class="fas fa-volume-up"></i></button>
                <div id="act3-d-translation" class="translation-hint hidden"></div>
                <img id="act3-d-image" class="vocab-image hidden" alt="Vocabulary Image">
                <div id="act3-d-options" class="flex flex-wrap justify-center gap-3 w-full px-2"></div>
                <p id="act3-d-feedback" class="hw-status" role="status"></p>
            </div>
        `;
        showTranslation('act3-d-translation', question.word, 'Act3');
        showVocabImage('act3-d-image', question.word, 'Act3');

        const optionsDiv = document.getElementById('act3-d-options');
        const feedback = document.getElementById('act3-d-feedback');

        question.options.forEach(optWord => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'game-btn bg-indigo-500 hover:bg-indigo-400 text-xl sm:text-2xl px-6 py-4 rounded-xl shadow-lg transform transition-all active:scale-95 w-full sm:w-auto';
            btn.innerText = optWord;
            if (question.answered && optWord === question.word) {
                btn.classList.remove('bg-indigo-500', 'hover:bg-indigo-400');
                btn.classList.add('bg-green-500');
            }
            btn.onclick = () => {
                if (STUDY_STATE.isTransitioning || question.answered) return;
                const correct = optWord === question.word;
                const game = window.Act3Game?.active();
                if (!(question.word in s.recFirst)) {
                    s.recFirst[question.word] = correct;
                    if (game) Act3Game.record('vocab', question.word, correct);
                    else srStudyResults.push({ type: 'vocab', key: act3SRKey('vocab', question.word), firstAttempt: correct });
                }
                if (!correct) {
                    question.failed = true;
                    incrementExerciseAttempts();
                    synthError();
                    btn.classList.add('bg-red-500', 'shake');
                    setTimeout(() => btn.classList.remove('bg-red-500', 'shake'), 500);
                    feedback.textContent = '再听一听，试试另一个答案。';
                    if (game) {
                        s.recQuestion = recognitionQuestion(question.word, question.options);
                        s.recQuestion.failed = true;
                        renderD();
                        document.getElementById('act3-d-feedback').textContent = '再听一听，试试另一个答案。';
                    } else playTTS();
                } else {
                    question.answered = true;
                    STUDY_STATE.isTransitioning = true;
                    playHappySound();
                    btn.classList.remove('bg-indigo-500', 'hover:bg-indigo-400');
                    btn.classList.add('bg-green-500');
                    queueExerciseEvent('wordRecognition', game ? 'game' : 'study', question.word);
                    feedback.textContent = question.failed ? '选对了，稍后再练一次。' : '选对了！';
                    if (game) Act3Game.pauseDeadline();
                    studyLater('act3_d_next', advanceRecognition, 650);
                }
            };
            optionsDiv.appendChild(btn);
        });

        if (question.answered && resuming) {
            STUDY_STATE.isTransitioning = true;
            studyLater('act3_d_next', advanceRecognition, 650);
        } else if (!resuming) {
            playTTS();
        }
    }

    function advanceRecognition() {
        const s = state();
        if (!STUDY_STATE.active || !s || !s.recQuestion) return;
        const question = s.recQuestion;
        if (window.Act3Game?.active()) { Act3Game.ready(); return; }
        STUDY_STATE.isTransitioning = false;
        s.recTurn++;
        if (question.failed) {
            s.recQueue.push({
                word: question.word,
                after: s.recTurn + 2,
                lastPosition: question.options.indexOf(question.word)
            });
        }
        s.recQuestion = null;
        startExerciseTracking();
        if (!s.recQueue.length) enter('E');
        else renderD();
    }

    function restore(saved) {
        const s = state();
        if (!s || !saved || !saved.state) return false;
        if (s.stage === 'A') {
            renderA(saved.speech || null);
            return true;
        }
        if (s.stage === 'C') {
            const frozen = s.missingFrozen;
            renderC();
            if (saved.ui.act3Missing) {
                const { slots, bank } = saved.ui.act3Missing;
                missingSlots().filter(slot => slot.dataset.gap === 'true').forEach((slot, index) => {
                    if (slots[index]) {
                        slot.innerText = slots[index].text;
                        slot.className = slots[index].cls;
                    }
                });
                document.getElementById('act3-missing-bank').replaceChildren(...bank.map(createMissingBankButton));
            }
            s.missingFrozen = frozen;
            return true;
        }
        if (s.stage === 'D') {
            renderD(true);
            return true;
        }
        return false;
    }

    window.Act3Study = {
        createState,
        start,
        cancel,
        enter,
        restore,
        handleKeyDown,
        advanceMissingWord,
        clearMissing,
        advanceRecognition
    };
})();
