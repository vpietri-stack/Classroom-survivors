// The game borrows the Act 3 Study widgets for one exercise, then returns to
// gameplay. Only the cycle and the open exercise's logical state are saved.
(function (w) {
    'use strict';
    const stages = ['B', 'C', 'D', 'E'];
    const $ = id => document.getElementById(id);
    let cycle = null;
    let open = false;
    let pausedAt = null;
    let speedRemaining = null;

    function pick(type) {
        const { unit, page } = selectedClassContent;
        const bucket = type === 'vocab' ? 'act3:recognition:' : 'act3:scramble:';
        const failed = [...srInSessionFailures].some(key => key.startsWith(bucket));
        return getGameItemSR('Act3', String(unit), String(page), type,
            srInSessionFailures, srInSessionSuccesses, failed ? null : cycle['last_' + type], { act3: true });
    }

    function start(context) {
        if (selectedClassContent?.book !== 'Act3' || !['levelup', 'gomoku', 'uno'].includes(context)
            || (context === 'levelup' && activeGameMode !== 'VS')) return false;
        cycle ||= { step: 0, word: null, sentence: null, repeat: false, failed: false };
        if (cycle.step === 0 && !cycle.word) {
            cycle.word = pick('vocab');
            if (cycle.word) cycle.last_vocab = act3SRKey('vocab', cycle.word);
        }
        if (cycle.step === 3 && !cycle.sentence) {
            cycle.sentence = pick('sentences');
            if (cycle.sentence) cycle.last_sentences = act3SRKey('sentences', cycle.sentence);
        }
        if (!cycle.word || (cycle.step === 3 && !cycle.sentence)) throw Error('Missing Act 3 exercise content');
        show();
        Object.assign(STUDY_STATE, {
            active: true, startTime: Date.now(), act3: Act3Study.createState(),
            words: [cycle.word], sentences: cycle.sentence ? [cycle.sentence] : [],
            currentWordIndex: 0, currentSentenceIndex: 0, nonSpellingExercises: null,
            phonics: null, pictureBook: null, parks: null, previewNote: null,
            _mixedActive: false, _roundEFrozen: false, srFinalized: false
        });
        if (cycle.step === 1) {
            cycle.gaps ||= getAct3MissingLetterIndices(cycle.word);
            STUDY_STATE.act3.missingGaps = cycle.gaps;
        }
        Act3Study.enter(stages[cycle.step]);
        return true;
    }

    function show() {
        open = true;
        const overlay = $('studyModeOverlay');
        overlay.style.zIndex = '56';
        overlay.classList.remove('hidden');
        overlay.scrollTop = 0;
        $('study-close').hidden = true;
        $('act3-game-timer').classList.remove('hidden');
        updateTimer();
    }

    function updateTimer() {
        if (!open) return;
        const display = $('act3-game-timer');
        if (rewardContext === 'uno') {
            const left = Math.max(0, UNO_ESL_TIME_LIMIT - ((pausedAt ?? Date.now()) - unoESLTimerStart));
            display.textContent = '⏱ ' + Math.ceil(left / 1000) + 's';
        } else if (rewardContext === 'gomoku' && gomokuMode === 'speed') {
            const left = speedRemaining ?? Math.max(0, gomokuNextAiTime - Date.now());
            display.textContent = 'AI Move: ' + (left / 1000).toFixed(1) + 's';
        } else display.textContent = '';
    }

    function pauseDeadline() {
        if (!open || pausedAt !== null) return;
        pausedAt = Date.now();
        if (rewardContext === 'gomoku' && gomokuMode === 'speed') {
            speedRemaining = Math.max(0, gomokuNextAiTime - pausedAt);
            clearInterval(gomokuSpeedInterval);
        }
        updateTimer();
        w.GameRuntime?.tick();
    }

    function unpause() {
        if (pausedAt === null) return;
        if (rewardContext === 'uno') unoESLTimerStart += Date.now() - pausedAt;
        const remaining = speedRemaining;
        pausedAt = null;
        speedRemaining = null;
        if (remaining !== null && gomokuGameActive) startGomokuSpeedClock(remaining);
    }

    function wordSpeech(word, slots, actions, saved) {
        if (!w.SpeechUI?.isReady()) { ready(); return; }
        if (actions) $(actions).style.display = 'none';
        const tiles = SpeechUI.completedWordTiles($(slots), word);
        const gate = SpeechUI.makeSentenceGate({
            target: word, wordTiles: tiles, mode: 'game',
            resumeState: saved || null, onDone: ready
        });
        $('study-game-area').appendChild(gate);
        pauseDeadline();
    }

    function ready() {
        if (!open || $('act3-game-reward')) return;
        const host = $('study-game-area');
        host.querySelectorAll('.speech-rec-btn').forEach(btn => btn.disposeSpeech?.());
        host.querySelector('.speech-sentence-gate')?.remove();
        const button = document.createElement('button');
        button.id = 'act3-game-reward';
        button.className = 'game-btn bg-green-500 text-2xl py-4 px-8 mt-3';
        button.textContent = rewardContext === 'levelup' ? 'GET POWER UP!' : 'CONTINUE!';
        button.onclick = () => claimReward(true);
        host.appendChild(button);
        pauseDeadline();
        // The answer is complete. The reward button only dismisses feedback.
        w.GameRuntime?.tick();
    }

    function record(type, item, firstAttempt) {
        const key = act3SRKey(type, item);
        if (!srGameResults.some(r => r.type === type && r.key === key)) {
            srGameResults.push({ type, key, firstAttempt });
        }
        const add = firstAttempt ? srInSessionSuccesses : srInSessionFailures;
        const remove = firstAttempt ? srInSessionFailures : srInSessionSuccesses;
        add.add(key);
        remove.delete(key);
        if (type === 'vocab' && !firstAttempt) cycle.failed = true;
        w.GameRuntime?.tick();
    }

    function close() {
        if (!open) return;
        open = false;
        unpause();
        if (STUDY_STATE.act3?.stage === 'B' && !STUDY_STATE.isTransitioning) hwCaptureEndWord();
        StudyRuntime.suspend();
        $('studyModeOverlay').style.removeProperty('z-index');
        $('study-game-area').replaceChildren();
        $('study-close').hidden = false;
        $('act3-game-timer').classList.add('hidden');
        STUDY_STATE.act3 = null;
    }

    function leaveRun(resumable) {
        close();
        if (resumable || selectedClassContent?.book !== 'Act3' ||
            !srGameResults.some(result => String(result.key).startsWith('act3:'))) return;
        finalizeSession(srGameResults, false);
        srGameResults = [];
    }

    function finish(success) {
        if (!open) return;
        if (!success && rewardContext === 'uno') unoESLTimedOut = true;
        if (success) {
            if (cycle.step === 1) cycle.gaps = null;
            if (cycle.step === 2) cycle.repeat = cycle.failed;
            if (cycle.step === 3) {
                if (!cycle.repeat) cycle.word = null;
                cycle.sentence = null;
                cycle.failed = false;
            }
            cycle.step = (cycle.step + 1) % stages.length;
        }
        close();
    }

    function snapshot() {
        if (!open) return null;
        const exercise = StudyRuntime.capture();
        exercise.practice = null;
        return {
            id: 'act3', exercise, ready: !!$('act3-game-reward'), paused: pausedAt !== null,
            elapsed: Math.max(0, Date.now() - minigameStartTime)
        };
    }

    function restore(saved, context) {
        rewardContext = context;
        minigameStartTime = Date.now() - saved.elapsed;
        show();
        StudyRuntime.restore(saved.exercise, { game: true });
        if (saved.paused) pauseDeadline();
        if (saved.ready) ready();
        else if (saved.exercise.speech && cycle.step < 2) {
            const writing = cycle.step === 0;
            wordSpeech(cycle.word, writing ? 'handwriting-slots' : 'act3-missing-slots',
                writing ? null : 'act3-c-actions', saved.exercise.speech);
        }
        startMinigameCountdown(null);
    }

    w.Act3Game = {
        start, finish, close, leaveRun, record, wordSpeech, pauseDeadline, ready, updateTimer, snapshot, restore,
        active: () => open, paused: () => open && pausedAt !== null,
        elapsedUno: () => Math.max(0, (pausedAt ?? Date.now()) - unoESLTimerStart),
        speedRemaining: () => speedRemaining,
        getCycle: () => cycle && { ...cycle },
        setCycle: saved => { cycle = saved ? { ...saved } : null; },
        reset: () => {
            close();
            cycle = null;
            if (!w.GameRuntime?.restoring() && selectedClassContent?.book === 'Act3' && authActiveUser?.book === 'Act3') {
                loadContent();
            }
        }
    };
})(window);
