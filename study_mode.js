
const STUDY_STATE = {
    active: false,
    words: [],      // The 5 selected words
    sentences: [],  // The 5 selected sentences
    remainingWordsRoundA: [], // Words left to find in Round A
    currentWordIndex: 0, // For Rounds B and C (0 to 4)
    currentSentenceIndex: 0, // For Round D (0 to 4)
    round: 'A',     // 'A', 'B', 'C', 'D'
    startTime: 0,
    timerInterval: null,
    isTransitioning: false
};

// SR result tracking for this study session
var srStudyResults = [];  // [{ type, key, firstAttempt }, ...]
var srUsedPageIndices = new Set();  // abs page indices used by Round E sub-rounds

// Entry point
function initStudyMode() {
    // Determine book/unit/page from current selection
    let book = "PU1", unit = "0", page = "5";
    if (typeof selectedClassContent !== 'undefined' && selectedClassContent) {
        book = selectedClassContent.book;
        unit = selectedClassContent.unit;
        page = selectedClassContent.page;
    }

    // Get Spaced Repetition Content (SR-aware)
    const SR_WORDS = getStudyContentSR(book, unit, page, 'vocab', 5);
    const SR_SENTENCES = getStudyContentSR(book, unit, page, 'sentences', 5);

    if (SR_WORDS.length < 5 || SR_SENTENCES.length < 5) {
        alert("Not enough content for Study Mode! Need at least 5 words and 5 sentences from current and previous pages.");
        if (SR_WORDS.length === 0 || SR_SENTENCES.length === 0) return;
    }

    STUDY_STATE.active = true;
    STUDY_STATE.startTime = Date.now();
    STUDY_STATE.round = 'A';
    STUDY_STATE.isTransitioning = false;

    // Reset SR tracking for this session
    srStudyResults = [];
    srUsedPageIndices = new Set();

    // Pick exactly 5 (SR logic already tries to do this, but let's be sure)
    STUDY_STATE.words = SR_WORDS.slice(0, 5);
    STUDY_STATE.sentences = SR_SENTENCES.slice(0, 5);

    // Hide Start Screen
    document.getElementById('startScreen').classList.add('hidden');

    // Show Study Overlay
    const overlay = document.getElementById('studyModeOverlay');
    overlay.classList.remove('hidden');

    startRoundA();
}

// --- ROUND A: Word Recognition ---
function startRoundA() {
    STUDY_STATE.round = 'A';
    STUDY_STATE.remainingWordsRoundA = [...STUDY_STATE.words];

    updateStudyUI("Round A: Word Recognition", "Listen and click the correct word.");

    const container = document.getElementById('study-game-area');
    container.innerHTML = `
        <div id="roundA-translation" class="translation-hint hidden"></div>
        <img id="roundA-image" class="w-32 h-32 object-contain mx-auto my-2 hidden border-2 border-slate-300 rounded-xl bg-white/10" alt="Vocabulary Image">
        <div id="roundA-container" class="flex flex-wrap justify-center gap-6 mt-8 p-4">
            <!-- Words injected here -->
        </div>
    `;

    renderRoundAWords();
    playRoundAPrompt();
}

function renderRoundAWords() {
    const container = document.getElementById('roundA-container');
    container.innerHTML = '';

    // Display all remaining words (randomized order on screen? or fixed positions? 
    // "5 words picked randomly... are displayed... word disappears". 
    // Keep positions? Randomize? Let's randomize initially, then just remove.
    // Actually, let's keep them in a stable set but hide found ones? Or just remove DOM elements?
    // If I re-render, they might jump around. I'll just render once and remove element on success.

    // Wait, if I render once, I need to know which ones are there. 
    // Let's render STUDY_STATE.remainingWordsRoundA.
    // But then they jump.
    // Let's render the initial 5 words, and hide the ones NOT in remainingWordsRoundA if we wanted stable positions.
    // But the requirements imply "that word disappears". Removing DOM element is fine.

    STUDY_STATE.remainingWordsRoundA.sort(() => 0.5 - Math.random()).forEach(word => {
        const btn = document.createElement('button');
        btn.className = "game-btn bg-indigo-500 hover:bg-indigo-400 text-2xl px-8 py-5 rounded-2xl shadow-lg transform transition-all hover:scale-105";
        btn.innerText = word;
        btn.onclick = () => checkRoundA(word, btn);
        container.appendChild(btn);
    });
}

function playRoundAPrompt() {
    if (STUDY_STATE.remainingWordsRoundA.length === 0) {
        finishRoundA();
        return;
    }
    // "sound of one of the word is played" -> Pick random from remaining
    const target = STUDY_STATE.remainingWordsRoundA[Math.floor(Math.random() * STUDY_STATE.remainingWordsRoundA.length)];
    currentTTSWord = target; // Global from game.js for playTTS()
    showTranslation('roundA-translation', target);
    showVocabImage('roundA-image', target);
    setTimeout(playTTS, 500); // Small delay
}

function checkRoundA(word, btnElement) {
    if (STUDY_STATE.isTransitioning) return;
    if (word === currentTTSWord) {
        STUDY_STATE.isTransitioning = true;
        // Correct
        playHappySound(); // Need to implement or reuse
        btnElement.classList.add('scale-0', 'transition-transform', 'duration-300'); // Animate out

        // Remove from list
        STUDY_STATE.remainingWordsRoundA = STUDY_STATE.remainingWordsRoundA.filter(w => w !== word);

        setTimeout(() => {
            btnElement.remove();
            STUDY_STATE.isTransitioning = false;
            playRoundAPrompt();
        }, 500);
    } else {
        // Wrong
        synthError(); // Reuse game.js
        btnElement.classList.add('bg-red-500', 'shake');
        setTimeout(() => btnElement.classList.remove('bg-red-500', 'shake'), 500);
        setTimeout(playTTS, 600); // Replay correct sound
    }
}

function finishRoundA() {
    // Round completed
    startRoundB();
}


// --- ROUND B: Word Scramble ---
function startRoundB() {
    STUDY_STATE.round = 'B';
    STUDY_STATE.currentWordIndex = 0;
    updateStudyUI("Round B: Word Scramble", "Unscramble the letters.");
    startExerciseTracking();
    nextRoundBWord();
}

function nextRoundBWord() {
    if (STUDY_STATE.currentWordIndex >= STUDY_STATE.words.length) {
        finishRoundB();
        return;
    }

    const word = STUDY_STATE.words[STUDY_STATE.currentWordIndex];
    currentTTSWord = word;

    const container = document.getElementById('study-game-area');
    container.innerHTML = `
        <div class="flex flex-col items-center gap-[var(--gap-md)] w-full">
            <button onclick="playTTS()" aria-label="Play Audio" class="w-16 h-16 rounded-full bg-blue-500 text-white text-2xl shadow-lg transform active:scale-95 transition-transform"><i class="fas fa-volume-up"></i></button>
            <div id="roundB-translation" class="translation-hint hidden"></div>
            <img id="roundB-image" class="w-32 h-32 object-contain mx-auto my-2 hidden border-2 border-slate-300 rounded-xl bg-white/10" alt="Vocabulary Image">
            
            <div id="scramble-slots" class="flex flex-wrap justify-center gap-[var(--gap-sm)] min-h-[60px] w-full px-4"></div>
            
            <div id="scramble-bank" class="flex flex-wrap justify-center gap-[var(--gap-sm)] w-full px-4"></div>

            <div class="flex gap-[var(--gap-md)]">
                <button onclick="checkRoundB()" class="game-btn bg-green-500 py-3 px-6">CHECK</button>
                <button onclick="clearRoundB()" class="game-btn bg-gray-500 py-3 px-6">CLEAR</button>
            </div>
        </div>
    `;
    showTranslation('roundB-translation', word);
    showVocabImage('roundB-image', word);

    // Setup Slots
    const slotsDiv = document.getElementById('scramble-slots');
    for (let i = 0; i < word.length; i++) {
        const slot = document.createElement('div');
        slot.className = "study-slot";

        if (word[i] === ' ') {
            slot.innerText = ' '; // Or keeping it empty visually but filled logically? 
            // Better to show it's a gap.
            slot.classList.add('border-transparent'); // Hide border for space? Or keep it?
            // "gap between the word is already there"
            // Let's make it invisible border but takes space
            slot.style.borderColor = "transparent";
            slot.style.background = "transparent";
            slot.dataset.fixed = "true"; // Mark as fixed
        } else if (word[i] === "'" || word[i] === "-" || word[i] === "." || word[i] === "?" || word[i] === "!") {
            slot.innerText = word[i];
            slot.classList.add('border-transparent', 'flex', 'items-end', 'pb-2', 'text-2xl', 'font-bold', 'text-white');
            slot.style.borderColor = "transparent";
            slot.style.background = "transparent";
            slot.dataset.fixed = "true"; // Mark punctuation as fixed too
        } else {
            slot.onclick = () => removeLetterFromSlot(i, word);
        }

        slotsDiv.appendChild(slot);
    }

    // Setup Bank (Scrambled letters, excluding spaces). This is a STATIC palette:
    // clicking a bank letter places a copy in the earliest empty slot; the bank never depletes.
    const bankDiv = document.getElementById('scramble-bank');
    const punctuation = [' ', "'", "-", ".", "?", "!"];
    const letters = word.split('').filter(c => !punctuation.includes(c)).sort(() => 0.5 - Math.random());

    bankDiv.innerHTML = '';
    letters.forEach((char) => {
        const btn = document.createElement('button');
        btn.className = "study-letter-btn";
        btn.innerText = char;
        btn.dataset.char = char;
        btn.onclick = (e) => addLetterToSlot(char, e.target, word);
        bankDiv.appendChild(btn);
    });

    STUDY_STATE._roundBFrozen = false;
    playTTS();
}

// Round B State
let roundBInput = []; // Array of chars

function addLetterToSlot(char, btnElement, targetWord) {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundBFrozen) return;
    const slots = document.getElementById('scramble-slots').children;
    // Place into the earliest EMPTY letter-slot (fixed slots skipped).
    for (let i = 0; i < slots.length; i++) {
        if (slots[i].dataset.fixed === "true") continue;
        if (!slots[i].innerText) {
            slots[i].innerText = char;
            break;
        }
    }
    // Bank stays as a static palette — the clicked button is NOT hidden/removed.
}

function removeLetterFromSlot(index, targetWord) {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundBFrozen) return;
    const slots = document.getElementById('scramble-slots').children;
    const slot = slots[index];
    if (slot.innerText) {
        slot.innerText = '';
        // Cancel any pending reveal/reset so colours clear immediately on edit.
        if (slot._resetTimer) { clearTimeout(slot._resetTimer); slot._resetTimer = null; }
        resetSlotColors();
    }
}

function resetSlotColors() {
    const slots = document.getElementById('scramble-slots').children;
    for (let s of slots) {
        s.classList.remove('bg-green-500', 'bg-red-500');
        s.classList.add('bg-gray-800');
    }
}

// CHECK button: reveal correct (green) / wrong (red) for ~5s, then reset all to bank.
function checkRoundB() {
    if (STUDY_STATE.isTransitioning) return;
    const slots = document.getElementById('scramble-slots').children;
    const targetWord = currentTTSWord;

    // Fill state: every non-fixed slot must have a letter.
    let isFull = true;
    for (let s of slots) {
        if (s.dataset.fixed === "true") continue;
        if (!s.innerText) isFull = false;
    }
    if (!isFull) {
        // Nothing to grade yet — give a soft nudge but do not reset.
        synthError();
        return;
    }

    let allCorrect = true;
    const correctChars = targetWord.split('');
    for (let i = 0; i < slots.length; i++) {
        if (slots[i].dataset.fixed === "true") continue;
        const char = slots[i].innerText;
        if (char === correctChars[i]) {
            slots[i].classList.remove('bg-gray-800', 'bg-red-500');
            slots[i].classList.add('bg-green-500');
        } else {
            slots[i].classList.remove('bg-gray-800', 'bg-green-500');
            slots[i].classList.add('bg-red-500');
            allCorrect = false;
        }
    }

    if (allCorrect) {
        STUDY_STATE.isTransitioning = true;
        STUDY_STATE._roundBFrozen = true;
        playHappySound();
        srStudyResults.push({ type: 'vocab', key: itemKey(targetWord), firstAttempt: exerciseAttempts === 1 });
        queueExerciseEvent('wordScramble', 'study', targetWord);
        setTimeout(() => {
            STUDY_STATE.currentWordIndex++;
            startExerciseTracking();
            STUDY_STATE.isTransitioning = false;
            STUDY_STATE._roundBFrozen = false;
            nextRoundBWord();
        }, 1000);
        return;
    }

    // Wrong: reveal for ~5s (frozen), then clear all slots.
    STUDY_STATE._roundBFrozen = true;
    synthError();
    incrementExerciseAttempts();
    const slotsArr = Array.from(slots);
    slotsArr.forEach(s => {
        if (s._resetTimer) clearTimeout(s._resetTimer);
        s._resetTimer = setTimeout(() => {
            for (let slot of slots) {
                slot.innerText = '';
                resetSlotColors();
            }
            STUDY_STATE._roundBFrozen = false;
        }, 5000);
    });
}

// Restore the full original bank (handles shuffled original order vs current visibility).
function repositionBank() {
    const bankDiv = document.getElementById('scramble-bank');
    const chars = JSON.parse(bankDiv.dataset.chars || "[]");
    bankDiv.innerHTML = '';
    chars.forEach((char) => {
        const btn = document.createElement('button');
        btn.className = "study-letter-btn";
        btn.innerText = char;
        btn.dataset.char = char;
        btn.onclick = (e) => addLetterToSlot(char, e.target, currentTTSWord);
        bankDiv.appendChild(btn);
    });
}

function clearRoundB() {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundBFrozen) return;
    const slots = document.getElementById('scramble-slots').children;
    for (let slot of slots) {
        if (slot._resetTimer) { clearTimeout(slot._resetTimer); slot._resetTimer = null; }
        slot.innerText = '';
        resetSlotColors();
    }
    // Bank is a static palette — it is NOT rebuilt/emptied.
}

// (repositionBank removed — the bank is now a static palette that never depletes.)
function repositionBank() {}

function finishRoundB() {
    startRoundC();
}


// --- ROUND C: Spelling (type from a 10-key board) ---
function startRoundC() {
    STUDY_STATE.round = 'C';
    STUDY_STATE.currentWordIndex = 0;
    updateStudyUI("Round C: Spelling", "Type the word.");
    startExerciseTracking();
    nextRoundCWord();
}

function nextRoundCWord() {
    if (STUDY_STATE.currentWordIndex >= STUDY_STATE.words.length) {
        finishRoundC();
        return;
    }

    const word = STUDY_STATE.words[STUDY_STATE.currentWordIndex];
    currentTTSWord = word;

    const container = document.getElementById('study-game-area');
    container.innerHTML = `
        <div class="flex flex-col items-center gap-[var(--gap-md)] w-full">
            <button onclick="playTTS()" aria-label="Play Audio" class="w-16 h-16 rounded-full bg-blue-500 text-white text-2xl shadow-lg transform active:scale-95 transition-transform"><i class="fas fa-volume-up"></i></button>
            <div id="roundC-translation" class="translation-hint hidden"></div>
            <img id="roundC-image" class="w-32 h-32 object-contain mx-auto my-2 hidden border-2 border-slate-300 rounded-xl bg-white/10" alt="Vocabulary Image">

            <div id="spelling-display" class="flex flex-wrap justify-center gap-[var(--gap-xs)] min-h-[60px] w-full px-4 text-white"></div>

            <div id="virtual-keyboard" class="flex flex-wrap justify-center gap-[var(--gap-sm)] max-w-lg px-4"></div>

            <div class="flex gap-[var(--gap-md)]">
                <button onclick="checkRoundC()" class="game-btn bg-green-500 py-3 px-6">CHECK</button>
                <button onclick="clearRoundC()" class="game-btn bg-gray-500 py-3 px-6">CLEAR</button>
            </div>
        </div>
    `;
    showTranslation('roundC-translation', word);
    showVocabImage('roundC-image', word);

    // Board = the word's own letters (shuffled) + enough random fillers to reach 10 keys.
    const punct = [' ', "'", "-", ".", "?", "!", ","];
    const needed = word.split('').filter(c => !punct.includes(c));
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    let keys = [...needed];
    while (keys.length < 10) {
        keys.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
    keys.sort();

    // Persist: which shuffled key index is still unplaced, plus the word's slot layout.
    const slots = [];
    for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        if (punct.includes(ch)) slots.push({ type: 'fixed', char: ch });
        else slots.push({ type: 'letter', index: i });
    }

    const kbDiv = document.getElementById('virtual-keyboard');
    kbDiv.innerHTML = '';
    keys.forEach((char, i) => {
        const btn = document.createElement('button');
        btn.className = "study-key";
        btn.innerText = char;
        btn.dataset.keyIndex = i;
        btn.onclick = () => typeRoundC(i);
        kbDiv.appendChild(btn);
    });

    roundCInput = "";
    roundCSlots = slots;
    roundCBaseKeys = [...keys];
    roundCPlacement = [];
    roundCUsedKeys = [];
    updateRoundCDisplay();
    playTTS();
}

let roundCInput = "";
let roundCSlots = [];
let roundCBaseKeys = [];
// Per-letter-slot -> tile index (which keyboard tile filled this slot), and
// per-tile used flag. These decouple "which tile is placed" from typing order,
// so a used tile is blocked by its OWN placement, not by which typing position
// it landed in (the old bug blocked an 'a' tile just because two 'd's were
// typed first).
let roundCPlacement = [];
let roundCUsedKeys = [];

// Rebuild the typed string from the per-slot placement (slot order), so display
// and validation read a coherent left-to-right string regardless of which tile
// was used for each slot.
function roundCRebuild() {
    roundCInput = roundCPlacement.map(ki => ki === undefined ? '' : roundCBaseKeys[ki]).join('');
}

function typeRoundC(keyIndex) {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundCFrozen) return;
    const letterSlotCount = roundCSlots.filter(s => s.type === 'letter').length;
    // Find the first empty letter-slot to fill (L-to-R slot order, not typing order).
    let slotFullIdx = -1;
    for (let i = 0; i < roundCSlots.length; i++) {
        if (roundCSlots[i].type === 'letter' && roundCPlacement[i] === undefined) { slotFullIdx = i; break; }
    }
    if (slotFullIdx === -1) return; // all slots filled
    if (roundCUsedKeys[keyIndex]) return; // this tile already placed
    roundCUsedKeys[keyIndex] = true;
    roundCPlacement[slotFullIdx] = keyIndex;
    updateRoundCDisplay();
}

function removeRoundCLetter(slotFullIdx) {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundCFrozen) return;
    if (roundCSlots[slotFullIdx].type !== 'letter') return;
    const placedKey = roundCPlacement[slotFullIdx];
    if (placedKey === undefined) return; // already empty
    roundCUsedKeys[placedKey] = false;
    roundCPlacement[slotFullIdx] = undefined;
    roundCRebuild();
    updateRoundCDisplay();
}

function clearRoundC() {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundCFrozen) return;
    if (STUDY_STATE._roundCResetTimer) { clearTimeout(STUDY_STATE._roundCResetTimer); STUDY_STATE._roundCResetTimer = null; }
    roundCInput = "";
    roundCPlacement = [];
    roundCUsedKeys = [];
    updateRoundCDisplay();
}

function updateRoundCDisplay() {
    const disp = document.getElementById('spelling-display');
    const targetWord = currentTTSWord;
    const isFeedback = STUDY_STATE._roundCFeedback === true;
    const isSuccess = STUDY_STATE._roundCSuccess === true;
    const isFrozen = STUDY_STATE._roundCFrozen === true;

    // Keep roundCInput coherent with per-slot placement (slot order).
    roundCRebuild();

    let html = "";
    roundCSlots.forEach((slot, fullIdx) => {
        if (slot.type === 'fixed') {
            const c = slot.char === ' ' ? ' ' : slot.char;
            html += `<div class="study-slot border-transparent bg-transparent select-none" style="color:#94a3b8">${c}</div>`;
        } else {
            const placedKey = roundCPlacement[fullIdx];
            const filledChar = (placedKey !== undefined) ? roundCBaseKeys[placedKey] : "";
            let bg = "bg-gray-800";
            if (isSuccess) bg = "bg-green-500";
            else if (isFeedback && filledChar) {
                bg = (filledChar === targetWord[slot.index]) ? "bg-green-500" : "bg-red-500";
            }
            // Click a filled slot to DELETE it (frozen during reveal).
            const onclick = (filledChar && !isFrozen) ? ` onclick="removeRoundCLetter(${fullIdx})"` : "";
            html += `<div class="study-slot ${bg}"${onclick}>${filledChar}</div>`;
        }
    });
    disp.innerHTML = html;
    disp.className = "flex flex-wrap justify-center gap-[var(--gap-xs)] min-h-[60px] w-full px-4 text-white";

    // Virtual keyboard stays a STATIC palette: all tiles remain visible; a used
    // tile is flagged (so the player sees what's spent) but never hidden/removed.
    const kbDiv = document.getElementById('virtual-keyboard');
    if (kbDiv) {
        Array.from(kbDiv.children).forEach((btn) => {
            const ki = Number(btn.dataset.keyIndex);
            btn.style.visibility = 'visible';
            if (roundCUsedKeys[ki]) btn.classList.add('used');
            else btn.classList.remove('used');
        });
    }
}

function checkRoundC() {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundCFrozen) return;
    const targetWord = currentTTSWord;
    const punct = [' ', "'", "-", ".", "?", "!", ","];
    const targetLetters = targetWord.split('').filter(c => !punct.includes(c)).join('');
    const allCorrect = (roundCInput === targetLetters);

    // Full? input length must equal number of letter slots.
    let letterSlotCount = roundCSlots.filter(s => s.type === 'letter').length;
    if (roundCInput.length < letterSlotCount) { synthError(); return; }

    if (allCorrect) {
        STUDY_STATE._roundCSuccess = true;
        STUDY_STATE._roundCFeedback = true;
        STUDY_STATE._roundCFrozen = true;
        updateRoundCDisplay();
        STUDY_STATE.isTransitioning = true;
        playHappySound();
        queueExerciseEvent('spelling', 'study', targetWord);
        setTimeout(() => {
            roundCInput = "";
            roundCPlacement = [];
            roundCUsedKeys = [];
            STUDY_STATE._roundCSuccess = false;
            STUDY_STATE._roundCFeedback = false;
            STUDY_STATE._roundCFrozen = false;
            STUDY_STATE.currentWordIndex++;
            startExerciseTracking();
            STUDY_STATE.isTransitioning = false;
            nextRoundCWord();
        }, 1000);
    } else {
        STUDY_STATE._roundCFeedback = true;
        STUDY_STATE._roundCFrozen = true; // freeze: no editing during reveal
        updateRoundCDisplay();
        synthError();
        incrementExerciseAttempts();
        if (STUDY_STATE._roundCResetTimer) clearTimeout(STUDY_STATE._roundCResetTimer);
        STUDY_STATE._roundCResetTimer = setTimeout(() => {
            STUDY_STATE._roundCFeedback = false;
            STUDY_STATE._roundCFrozen = false;
            roundCInput = "";
            roundCPlacement = [];
            roundCUsedKeys = [];
            updateRoundCDisplay();
        }, 5000);
    }
}

function finishRoundC() {
    startRoundD();
}


// --- ROUND D: Sentence Scramble ---
function startRoundD() {
    STUDY_STATE.round = 'D';
    STUDY_STATE.currentSentenceIndex = 0;
    updateStudyUI("Round D: Sentence Scramble", "Order the words.");
    startExerciseTracking();
    nextRoundDSentence();
}

function nextRoundDSentence() {
    if (STUDY_STATE.currentSentenceIndex >= STUDY_STATE.sentences.length) {
        startRoundE();
        return;
    }

    let sentence = STUDY_STATE.sentences[STUDY_STATE.currentSentenceIndex];
    if (Array.isArray(sentence)) sentence = sentence[0];

    const container = document.getElementById('study-game-area');
    container.innerHTML = `
        <div class="flex flex-col gap-[var(--gap-md)] w-full max-w-2xl mx-auto px-4">
             <div id="roundD-translation" class="translation-hint hidden"></div>
             <div id="sentence-drop-zone" class="bg-gray-800/50 p-6 rounded-xl min-h-[120px] flex flex-wrap gap-[var(--gap-sm)] items-center justify-center border-2 border-dashed border-gray-600">
                <!-- Word slots -->
             </div>
             
             <div id="sentence-word-bank" class="bg-gray-700/50 p-4 rounded-xl flex flex-wrap gap-[var(--gap-sm)] justify-center min-h-[100px]">
                <!-- Source words -->
             </div>
             
             <div class="flex justify-center gap-4">
                <button onclick="checkRoundD()" class="game-btn bg-green-500 py-3 px-8 text-xl">CHECK</button>
                <button onclick="clearRoundD()" class="game-btn bg-gray-500 py-3 px-8 text-xl">CLEAR</button>
             </div>
        </div>
    `;
    showTranslation('roundD-translation', sentence);

    // Build fixed word-slots (one per token, in order).
    const tokens = sentence.split(' ');
    const dropZone = document.getElementById('sentence-drop-zone');
    dropZone.innerHTML = '';
    tokens.forEach((word, idx) => {
        const slot = document.createElement('div');
        slot.className = 'sentence-slot';
        slot.dataset.index = idx;
        slot.dataset.expected = word;
        dropZone.appendChild(slot);
    });

    // Shuffled bank — a STATIC palette. Clicking a word places a copy; the bank stays.
    const shuffled = [...tokens].sort(() => 0.5 - Math.random());
    const bank = document.getElementById('sentence-word-bank');
    bank.innerHTML = '';
    shuffled.forEach((word, id) => {
        bank.appendChild(createWordTile(word, id));
    });

    STUDY_STATE._roundDFrozen = false;
}

function createWordTile(word, id) {
    const btn = document.createElement('button');
    btn.className = "study-word-tile";
    btn.innerText = word;
    btn.dataset.word = word;
    btn.dataset.id = id;
    btn.onclick = () => placeWordTile(word);
    return btn;
}

// Bank is a static palette: clicking a bank word places a COPY into the earliest
// empty slot. The source word stays in the bank.
function placeWordTile(word) {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundDFrozen) return;
    const dropZone = document.getElementById('sentence-drop-zone');
    const empty = Array.from(dropZone.children).find(s => !s.firstChild);
    if (empty) {
        const tile = document.createElement('div');
        tile.className = 'study-word-tile placed';
        tile.innerText = word;
        tile.dataset.word = word;
        tile.onclick = () => deleteWordTile(tile);
        empty.appendChild(tile);
    }
}

// Remove a placed word entirely (it just disappears — nothing returns to the bank).
function deleteWordTile(tile) {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundDFrozen) return;
    tile.classList.remove('!bg-green-500', '!bg-red-500');
    tile.remove();
}

function clearRoundD() {
    if (STUDY_STATE.isTransitioning || STUDY_STATE._roundDFrozen) return;
    const dropZone = document.getElementById('sentence-drop-zone');
    if (STUDY_STATE._roundDResetTimer) { clearTimeout(STUDY_STATE._roundDResetTimer); STUDY_STATE._roundDResetTimer = null; }
    // Remove all placed tiles; the bank (static palette) is left untouched.
    Array.from(dropZone.children).forEach(slot => { if (slot.firstChild) slot.firstChild.remove(); });
}

function checkRoundD() {
    if (STUDY_STATE.isTransitioning) return;
    const dropZone = document.getElementById('sentence-drop-zone');
    const slots = Array.from(dropZone.children);
    const targetWords = slots.map(s => s.dataset.expected);
    const currentWords = slots.map(s => s.firstChild ? s.firstChild.dataset.word : null);

    let allCorrect = currentWords.length === targetWords.length &&
                    currentWords.every((w, i) => w === targetWords[i]);

    slots.forEach((slot, index) => {
        const tile = slot.firstChild;
        if (!tile) return;
        tile.classList.remove('!bg-green-500', '!bg-red-500');
        if (tile.dataset.word === targetWords[index]) {
            tile.classList.add('!bg-green-500');
        } else {
            tile.classList.add('!bg-red-500');
        }
    });

    if (allCorrect) {
        STUDY_STATE.isTransitioning = true;
        STUDY_STATE._roundDFrozen = true;
        playHappySound();
        srStudyResults.push({ type: 'sentences', key: itemKey(STUDY_STATE.sentences[STUDY_STATE.currentSentenceIndex]), firstAttempt: exerciseAttempts === 1 });
        queueExerciseEvent('sentenceScramble', 'study', STUDY_STATE.sentences[STUDY_STATE.currentSentenceIndex]);
        setTimeout(() => {
            STUDY_STATE.currentSentenceIndex++;
            startExerciseTracking();
            STUDY_STATE.isTransitioning = false;
            STUDY_STATE._roundDFrozen = false;
            nextRoundDSentence();
        }, 1000);
    } else {
        STUDY_STATE.isTransitioning = true;
        STUDY_STATE._roundDFrozen = true; // frozen during reveal
        synthError();
        incrementExerciseAttempts();
        dropZone.classList.add('border-red-500');
        if (STUDY_STATE._roundDResetTimer) clearTimeout(STUDY_STATE._roundDResetTimer);
        STUDY_STATE._roundDResetTimer = setTimeout(() => {
            dropZone.classList.remove('border-red-500');
            STUDY_STATE.isTransitioning = false;
            STUDY_STATE._roundDFrozen = false;
            // Remove all placed tiles; the bank (static palette) is left untouched.
            Array.from(dropZone.children).forEach(slot => { if (slot.firstChild) slot.firstChild.remove(); });
        }, 5000);
    }
}


// --- ROUND E: Sentence Matching ---
function startRoundE() {
    STUDY_STATE.round = 'E';
    STUDY_STATE.subRound = 1; // Initialize sub-round counter
    startExerciseTracking();
    nextRoundESubRound();
}

function nextRoundESubRound() {
    if (STUDY_STATE.subRound > 3) {
        finishStudySession();
        return;
    }

    updateStudyUI(`Round E${STUDY_STATE.subRound}: Sentence Matching`, "Match each question with its answer.");

    // Get sentence pairs using SR-aware same-page selection
    const { book, unit, page } = selectedClassContent;

    const result = getStudySentencePairsSubRoundSR(book, unit, page, srUsedPageIndices);
    let pairs = [];

    if (result && result.pairs && result.pairs.length > 0) {
        srUsedPageIndices.add(result.pageAbsIndex);
        pairs = result.pairs;
    } else {
        // Fallback: legacy selection
        const sortedPages = getSortedPagesForBook(book);
        const activePageIndex = sortedPages.findIndex(p => p.book === book && p.unit === unit && p.page === page.toString());
        if (STUDY_STATE.subRound === 1) {
            const currentPage = sortedPages[activePageIndex] ? [sortedPages[activePageIndex]] : [];
            pairs = pickUniqueItems(currentPage, 3, 'sentencePairs', activePageIndex, false, true);
        } else {
            const previousPages = sortedPages.slice(0, activePageIndex);
            if (previousPages.length > 0) {
                pairs = pickUniqueItems(previousPages, 3, 'sentencePairs', activePageIndex, true, true);
            }
        }
    }

    // Fallback if no pairs found (or no previous pages)
    if (!pairs || pairs.length === 0) {
        // If we can't find previous content for E2/E3, try current page again
        const currentPage = sortedPages[activePageIndex] ? [sortedPages[activePageIndex]] : [];
        pairs = pickUniqueItems(currentPage, 3, 'sentencePairs', activePageIndex, false, true);
    }

    // Final fallback for empty content
    if (!pairs || pairs.length === 0) {
        pairs = [
            { a: "What's your name?", b: "My name is Sarah." },
            { a: "How old are you?", b: "I'm seven years old." },
            { a: "What colour is the apple?", b: "The apple is red." }
        ];
    }

    STUDY_STATE.sentencePairs = pairs;
    STUDY_STATE.pairAttempts = pairs.map(() => 1);
    STUDY_STATE.pairQueued = pairs.map(() => false);
    renderRoundE();
}

function renderRoundE() {
    const pairs = STUDY_STATE.sentencePairs;

    // Create shuffled array of B sentences for the dock
    const bSentences = pairs.map((p, i) => ({ text: p.b, correctIndex: i }));
    bSentences.sort(() => 0.5 - Math.random());

    const container = document.getElementById('study-game-area');
    container.innerHTML = `
        <div class="flex flex-col gap-4 w-full max-w-3xl mx-auto px-4">
            <div id="match-pairs-container" class="flex flex-col gap-3">
                ${pairs.map((pair, index) => `
                    <div class="match-pair-row flex flex-col sm:flex-row gap-2 items-stretch">
                        <div class="sentence-a flex-1 bg-indigo-900/60 p-3 rounded-lg text-white font-medium text-sm sm:text-base" data-index="${index}">
                            ${pair.a}
                        </div>
                        <div class="sentence-b-slot flex-1 bg-gray-700/50 p-3 rounded-lg min-h-[50px] border-2 border-dashed border-gray-500 flex items-center justify-center cursor-pointer" 
                             data-target-index="${index}" 
                             onclick="handleSlotClick(${index})">
                            <span class="text-gray-400 text-sm">Click to place answer</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div id="sentence-b-dock" class="bg-gray-800/50 p-4 rounded-xl flex flex-wrap gap-2 justify-center min-h-[80px] mt-4">
                ${bSentences.map(item => `
                    <button class="sentence-b-tile bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                            data-correct-index="${item.correctIndex}"
                            onclick="selectBTile(this)">
                        ${item.text}
                    </button>
                `).join('')}
            </div>
            
            <div class="flex justify-center gap-4 mt-4">
                <button onclick="checkRoundE()" class="game-btn bg-green-500 py-3 px-8 text-xl">CHECK</button>
            </div>
        </div>
    `;
}

let selectedBTile = null;

function selectBTile(tile) {
    if (STUDY_STATE.isTransitioning) return;
    // Clear previous selection
    document.querySelectorAll('.sentence-b-tile').forEach(t => t.classList.remove('ring-4', 'ring-yellow-400'));

    // Select this tile
    selectedBTile = tile;
    tile.classList.add('ring-4', 'ring-yellow-400');
}

function handleSlotClick(slotIndex) {
    if (STUDY_STATE.isTransitioning) return;
    const slot = document.querySelector(`.sentence-b-slot[data-target-index="${slotIndex}"]`);

    // If clicking a slot that already has a tile, return it to dock
    const existingTile = slot.querySelector('.sentence-b-tile');
    if (existingTile) {
        returnTileToDock(existingTile);
        slot.innerHTML = '<span class="text-gray-400 text-sm">Click to place answer</span>';
        return;
    }

    // If a tile is selected, place it in this slot
    if (selectedBTile) {
        slot.innerHTML = '';
        slot.appendChild(selectedBTile);
        selectedBTile.classList.remove('ring-4', 'ring-yellow-400');
        selectedBTile = null;
    }
}

function returnTileToDock(tile) {
    const dock = document.getElementById('sentence-b-dock');
    tile.classList.remove('ring-4', 'ring-yellow-400', 'correct-match', 'wrong-match');
    tile.style.backgroundColor = '';
    dock.appendChild(tile);
}

function checkRoundE() {
    if (STUDY_STATE.isTransitioning) return;
    const pairs = STUDY_STATE.sentencePairs;
    const slots = document.querySelectorAll('.sentence-b-slot');
    let allCorrect = true;
    let anyPlaced = false;

    slots.forEach((slot, index) => {
        const tile = slot.querySelector('.sentence-b-tile');

        if (tile) {
            anyPlaced = true;
            const targetIndex = parseInt(slot.dataset.targetIndex);

            // Allow matching if the text matches the expected answer for this question
            const placedText = tile.innerText.trim();
            const expectedText = pairs[targetIndex].b.trim();

            if (placedText === expectedText) {
                // Correct match
                tile.classList.remove('wrong-match');
                tile.classList.add('correct-match');
                tile.style.backgroundColor = '#10b981'; // green
                
                // Record analytics for this pair if not already recorded
                if (!STUDY_STATE.pairQueued[targetIndex]) {
                    const itemDetails = `A: ${pairs[targetIndex].a} | B: ${pairs[targetIndex].b}`;
                    // SR: first attempt = pairAttempts still at 1
                    srStudyResults.push({ type: 'sentencePairs', key: itemKey(pairs[targetIndex]), firstAttempt: STUDY_STATE.pairAttempts[targetIndex] === 1 });
                    queueExerciseEvent('sentenceMatch', 'study', itemDetails, STUDY_STATE.pairAttempts[targetIndex]);
                    STUDY_STATE.pairQueued[targetIndex] = true;
                }
            } else {
                // Incorrect match
                tile.classList.remove('correct-match');
                tile.classList.add('wrong-match');
                tile.style.backgroundColor = '#ef4444'; // red
                allCorrect = false;
            }
        } else {
            allCorrect = false;
        }
    });

    if (!anyPlaced) {
        // No tiles placed, do nothing
        return;
    }

    if (allCorrect) {
        STUDY_STATE.isTransitioning = true;
        playHappySound();
        // Note: The individual pairs were already queued during the check above.
        setTimeout(() => {
            STUDY_STATE.subRound++;
            startExerciseTracking();
            STUDY_STATE.isTransitioning = false;
            nextRoundESubRound();
        }, 1500);
    } else {
        STUDY_STATE.isTransitioning = true;
        synthError();
        incrementExerciseAttempts();
        
        // Increment attempts for any pairs that have not yet been successfully matched
        for (let i = 0; i < pairs.length; i++) {
            if (!STUDY_STATE.pairQueued[i]) {
                STUDY_STATE.pairAttempts[i]++;
            }
        }

        // Reset after 2 seconds
        setTimeout(() => {
            resetRoundE();
            STUDY_STATE.isTransitioning = false;
        }, 2000);
    }
}

function resetRoundE() {
    // Return all tiles to dock
    const tiles = document.querySelectorAll('.sentence-b-tile');
    tiles.forEach(tile => {
        returnTileToDock(tile);
    });

    // Reset all slots
    const slots = document.querySelectorAll('.sentence-b-slot');
    slots.forEach(slot => {
        slot.innerHTML = '<span class="text-gray-400 text-sm">Click to place answer</span>';
    });

    selectedBTile = null;
}


function finishStudySession() {
    const durationMs = Date.now() - STUDY_STATE.startTime;
    const durationSec = Math.floor(durationMs / 1000);
    const mm = Math.floor(durationSec / 60);
    const ss = durationSec % 60;
    const timeStr = `${mm}m ${ss}s`;

    const player = selectedStudent || "Student";

    // Track session completion
    // Finalize SR state for this session before flushing
    finalizeSession(srStudyResults);

    queueSessionEvent('study', {
        durationMs: durationMs,
        durationFormatted: timeStr
    });
    flushAnalytics(); // Flush immediately on session end

    const targetText = typeof getActiveTargetText === 'function' ? getActiveTargetText() : null;
    const messageHtml = targetText 
        ? `<div class="mb-8 py-3 px-6 bg-indigo-900/50 border border-indigo-400/50 rounded-xl inline-block"><p class="study-text-xl text-indigo-200 font-bold tracking-wide">${targetText}</p></div>`
        : `<p class="study-text-xl text-yellow-400 mb-8 font-bold">记得发图片在群里给Val看看！!</p>`;

    const container = document.getElementById('study-game-area');
    container.innerHTML = `
        <div class="text-center px-4">
            <h2 class="study-text-2xl text-green-400 font-bold mb-4">Great job ${player}!</h2>
            <p class="study-text-xl text-white mb-2">You completed this session in ${timeStr}</p>
            ${messageHtml}
            
            <div class="flex flex-col gap-4 items-center">
                <button onclick="initStudyMode()" class="game-btn bg-blue-600 text-xl sm:text-2xl w-full max-w-[280px]">再学习一下</button>
                <button onclick="showGameSelection()" class="game-btn bg-orange-500 text-xl sm:text-2xl w-full max-w-[280px]">边玩边学</button>
            </div>
        </div>
    `;
    updateStudyUI("Session Complete", "");
}

function exitStudyMode() {
    document.getElementById('studyModeOverlay').classList.add('hidden');
    triggerStartGame(); // Call original game start
}


// --- Helper UI ---
function updateStudyUI(title, subtitle) {
    document.getElementById('study-title').innerText = title;
    document.getElementById('study-instruction').innerText = subtitle;
}

function playHappySound() {
    initAudio(); // Ensure audio context is ready
    if (typeof synthLevelUp === 'function') {
        synthLevelUp();
    }
}

// --- KEYBOARD SUPPORT ---
window.addEventListener('keydown', (e) => {
    if (!STUDY_STATE.active) return;

    if (STUDY_STATE.round === 'B') {
        handleRoundBKeyDown(e.key);
    } else if (STUDY_STATE.round === 'C') {
        handleRoundCKeyDown(e.key);
    }
});

function handleRoundBKeyDown(key) {
    if (key === 'Backspace') {
        const slots = document.getElementById('scramble-slots').children;
        // Find last filled letter-slot and remove it.
        for (let i = slots.length - 1; i >= 0; i--) {
            if (slots[i].innerText && slots[i].dataset.fixed !== "true") {
                removeLetterFromSlot(i, currentTTSWord);
                break;
            }
        }
    } else if (key.length === 1 && key.match(/[a-z0-9]/i)) {
        const bank = document.getElementById('scramble-bank').children;
        for (let btn of bank) {
            if (btn.innerText.toLowerCase() === key.toLowerCase() && btn.style.visibility !== 'hidden') {
                addLetterToSlot(btn.innerText, btn, currentTTSWord);
                break;
            }
        }
    } else if (key === 'Enter') {
        checkRoundB();
    }
}

function handleRoundCKeyDown(key) {
    if (key === 'Enter') {
        checkRoundC();
    } else if (key === 'Backspace') {
        // Remove last placed letter (reflow L-to-R), not a full clear.
        if (roundCInput.length > 0) {
            roundCInput = roundCInput.slice(0, -1);
            updateRoundCDisplay();
        }
    } else if (key.length === 1 && key.match(/[a-z0-9]/i)) {
        // Only allow typing if the key is in the visible virtual keyboard.
        const kb = document.getElementById('virtual-keyboard').children;
        for (let btn of kb) {
            const ki = Number(btn.dataset.keyIndex);
            if (btn.innerText.toLowerCase() === key.toLowerCase() && !roundCUsedKeys[ki]) {
                typeRoundC(ki);
                break;
            }
        }
    }
}
