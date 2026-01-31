
const STUDY_STATE = {
    active: false,
    words: [],      // The 5 selected words
    sentences: [],  // The 5 selected sentences
    remainingWordsRoundA: [], // Words left to find in Round A
    currentWordIndex: 0, // For Rounds B and C (0 to 4)
    currentSentenceIndex: 0, // For Round D (0 to 4)
    round: 'A',     // 'A', 'B', 'C', 'D'
    startTime: 0,
    timerInterval: null
};

// Entry point
function initStudyMode() {
    // Determine book/unit/page from current selection
    let book = "PU1", unit = "0", page = "4";
    if (typeof selectedDay !== 'undefined' && typeof selectedTime !== 'undefined' && CLASS_CONFIG[selectedDay] && CLASS_CONFIG[selectedDay][selectedTime]) {
        const config = CLASS_CONFIG[selectedDay][selectedTime].content;
        book = config.book;
        unit = config.unit;
        page = config.page;
    }

    // Get Spaced Repetition Content
    const SR_WORDS = getSpacedRepetitionContent(book, unit, page, 'vocab', true);
    const SR_SENTENCES = getSpacedRepetitionContent(book, unit, page, 'sentences', true);

    if (SR_WORDS.length < 5 || SR_SENTENCES.length < 5) {
        alert("Not enough content for Study Mode! Need at least 5 words and 5 sentences from current and previous pages.");
        if (SR_WORDS.length === 0 || SR_SENTENCES.length === 0) return;
    }

    STUDY_STATE.active = true;
    STUDY_STATE.startTime = Date.now();
    STUDY_STATE.round = 'A';

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
        btn.className = "game-btn bg-indigo-500 hover:bg-indigo-400 text-2xl px-8 py-5 rounded-2xl shadow-lg transform transition-all hover:scale-105"; // Warmer styling
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
    setTimeout(playTTS, 500); // Small delay
}

function checkRoundA(word, btnElement) {
    if (word === currentTTSWord) {
        // Correct
        playHappySound(); // Need to implement or reuse
        btnElement.classList.add('scale-0', 'transition-transform', 'duration-300'); // Animate out

        // Remove from list
        STUDY_STATE.remainingWordsRoundA = STUDY_STATE.remainingWordsRoundA.filter(w => w !== word);

        setTimeout(() => {
            btnElement.remove();
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
            
            <div id="scramble-slots" class="flex flex-wrap justify-center gap-[var(--gap-sm)] min-h-[60px] w-full px-4"></div>
            
            <div id="scramble-bank" class="flex flex-wrap justify-center gap-[var(--gap-sm)] w-full px-4"></div>
        </div>
    `;

    // Setup Slots
    const slotsDiv = document.getElementById('scramble-slots');
    for (let i = 0; i < word.length; i++) {
        const slot = document.createElement('div');
        slot.className = "study-slot";

        // Pre-fill space if character is a space
        if (word[i] === ' ') {
            slot.innerText = ' '; // Or keeping it empty visually but filled logically? 
            // Better to show it's a gap.
            slot.classList.add('border-transparent'); // Hide border for space? Or keep it?
            // "gap between the word is already there"
            // Let's make it invisible border but takes space
            slot.style.borderColor = "transparent";
            slot.style.background = "transparent";
            slot.dataset.fixed = "true"; // Mark as fixed
        } else {
            slot.onclick = () => removeLetterFromSlot(i, word);
        }

        slotsDiv.appendChild(slot);
    }

    // Setup Bank (Scrambled letters, excluding spaces)
    const bankDiv = document.getElementById('scramble-bank');
    // Filter out spaces from scramble
    const letters = word.split('').filter(c => c !== ' ').sort(() => 0.5 - Math.random());

    letters.forEach((char) => {
        const btn = document.createElement('button');
        btn.className = "study-letter-btn";
        btn.innerText = char;
        btn.onclick = (e) => addLetterToSlot(char, e.target, word);
        bankDiv.appendChild(btn);
    });

    playTTS();
}

// Round B State
let roundBInput = []; // Array of chars

function addLetterToSlot(char, btnElement, targetWord) {
    // Find first empty slot
    const slots = document.getElementById('scramble-slots').children;
    let insertedIndex = -1;
    for (let i = 0; i < slots.length; i++) {
        // Skip correct spaces or fixed slots
        if (slots[i].dataset.fixed === "true") continue;

        if (!slots[i].innerText) {
            slots[i].innerText = char;
            slots[i].dataset.sourceBtn = "true"; // Mark as filled
            // Store reference to restore button? 
            // Simplified: Hide button
            btnElement.style.visibility = 'hidden';
            btnElement.id = `bank-btn-${i}`; // Hacky mapping? No.
            // We need to map slot back to the button to restore visibility.
            // Let's store the button element in the slot logic? 
            slots[i].sourceBtnEntry = btnElement;
            insertedIndex = i;
            break;
        }
    }

    // Check if full
    if (insertedIndex !== -1) {
        checkRoundBLogic(targetWord);
    }
}

function removeLetterFromSlot(index, targetWord) {
    const slots = document.getElementById('scramble-slots').children;
    const slot = slots[index];
    if (slot.innerText) {
        slot.innerText = '';
        if (slot.sourceBtnEntry) {
            slot.sourceBtnEntry.style.visibility = 'visible';
            slot.sourceBtnEntry = null;
        }
        // Should we clear coloring?
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

function checkRoundBLogic(targetWord) {
    const slots = document.getElementById('scramble-slots').children;
    let currentStr = "";
    let isFull = true;
    for (let s of slots) {
        if (s.dataset.fixed === "true") continue; // Skip fixed slots
        if (!s.innerText) isFull = false;
    }

    if (!isFull) return;

    // Validate
    let allCorrect = true;
    const correctChars = targetWord.split('');

    for (let i = 0; i < slots.length; i++) {
        if (slots[i].dataset.fixed === "true") continue; // Skip fixed slots
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
        playHappySound();
        setTimeout(() => {
            STUDY_STATE.currentWordIndex++;
            nextRoundBWord();
        }, 1000);
    } else {
        synthError();
        // User has to try again. they can click red slots to remove them.
    }
}

function finishRoundB() {
    startRoundC();
}


// --- ROUND C: Spelling ---
function startRoundC() {
    STUDY_STATE.round = 'C';
    STUDY_STATE.currentWordIndex = 0;
    updateStudyUI("Round C: Spelling", "Type the word.");
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
            
            <div id="spelling-display" class="flex flex-wrap justify-center gap-[var(--gap-xs)] min-h-[60px] w-full px-4 text-white"></div>
            
            <div id="virtual-keyboard" class="flex flex-wrap justify-center gap-[var(--gap-sm)] max-w-lg px-4"></div>
            
            <div class="flex gap-[var(--gap-md)]">
                <button onclick="checkRoundC('${word.replace(/'/g, "\\'")}')" class="game-btn bg-green-500 py-3 px-6">CHECK</button>
                <button onclick="clearRoundC()" class="game-btn bg-gray-500 py-3 px-6">CLEAR</button>
            </div>
        </div>
    `;

    // Virtual Keyboard: Actual letters + random
    // Count exact unique letters needed
    const needed = word.split('');
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const extraCount = 10 - needed.length; // Target 10 total? Or strictly 10 keys? 
    // "Virtual keyboard displays 10 letters"
    // If word is longer than 10? Assuming words are short. 
    // If word > 10, show more? "displays 10 letters" might correspond to shorter words levels.
    // Let's ensure at least all word chars are there.

    let keys = [...needed];
    if (keys.length < 10) {
        for (let i = 0; i < (10 - needed.length); i++) {
            keys.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
        }
    }
    // Alphabetical order
    keys.sort();

    const kbDiv = document.getElementById('virtual-keyboard');
    keys.forEach(char => {
        const btn = document.createElement('button');
        btn.className = "study-key";
        btn.innerText = char;
        btn.onclick = () => typeRoundC(char);
        kbDiv.appendChild(btn);
    });

    playTTS();
}

let roundCInput = "";

function typeRoundC(char) {
    roundCInput += char;
    updateRoundCDisplay();
}

function clearRoundC() {
    roundCInput = "";
    updateRoundCDisplay();
}

function updateRoundCDisplay() {
    const disp = document.getElementById('spelling-display');
    const word = currentTTSWord;

    // Build slot display
    let html = "";
    let inputIndex = 0;

    // We iterate over the TARGET word length to show slots
    for (let i = 0; i < word.length; i++) {
        const char = word[i];

        if (char === ' ') {
            // Fixed space
            html += `<div class="w-6 sm:w-8 h-10 flex items-center justify-center text-2xl sm:text-3xl mx-1" data-fixed="true"> </div>`;
            // If input has a space here? Actually input shouldn't have spaces if user types keys.
            // We need to skip this index in the input mapping?
            // Let's assume user input skips spaces.
        } else {
            // Check if user input has a char for this 'letter' slot
            // We need to map 'Nth non-space letter' of target to 'Nth char' of input

            // Wait, simple mapping:
            // Input string contains only typed letters (no spaces).
            // We fill slots from left to right skipping spaces.

            const filledChar = roundCInput[inputIndex] || "";
            if (roundCInput[inputIndex] !== undefined) inputIndex++;

            // Visual slot
            const borderClass = filledChar ? "border-white" : "border-gray-500";
            const textClass = filledChar ? "text-white" : "text-transparent";

            html += `<div class="study-slot border-b-4 ${borderClass} ${textClass} bg-transparent mx-[var(--gap-xs)]">${filledChar}</div>`;
        }
    }

    disp.innerHTML = html;
    disp.className = "flex gap-[var(--gap-xs)] justify-center min-h-[var(--slot-size)] flex-wrap w-full px-4"; // Update container style
}

// Logic check needs adjustment too: we compare input against target *without spaces*?
// Or we assume user types spaces?
// "keyboard displays 10 letters" ... unlikely to have space bar.
// So input is letters only. Target has spaces.
// We must skip spaces in target when checking.

function checkRoundC(targetWord) {
    const disp = document.getElementById('spelling-display');

    // Target without spaces
    const targetClean = targetWord.replace(/ /g, '');
    const input = roundCInput;

    let html = "";
    let allCorrect = (input === targetClean);
    let inputIndex = 0;

    // Re-render with colors
    for (let i = 0; i < targetWord.length; i++) {
        if (targetWord[i] === ' ') {
            html += `<div class="w-6 sm:w-8 h-10 flex items-center justify-center text-2xl sm:text-3xl mx-1"> </div>`;
        } else {
            const char = input[inputIndex] || "";
            const targetChar = targetClean[inputIndex] || "";
            let colorClass = "text-white";
            let borderColor = "border-white";

            if (inputIndex < input.length) {
                if (char === targetChar) {
                    colorClass = "text-green-400";
                    borderColor = "border-green-400";
                } else {
                    colorClass = "text-red-400";
                    borderColor = "border-red-400";
                }
            } else {
                borderColor = "border-gray-500";
            }

            html += `<div class="study-slot border-b-4 ${borderColor} ${colorClass} bg-transparent mx-[var(--gap-xs)]">${char}</div>`;
            inputIndex++;
        }
    }

    disp.innerHTML = html;

    if (allCorrect) {
        playHappySound();
        setTimeout(() => {
            roundCInput = "";
            STUDY_STATE.currentWordIndex++;
            nextRoundCWord();
        }, 1000);
    } else {
        synthError();
        setTimeout(() => {
            clearRoundC();
        }, 2000);
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
    nextRoundDSentence();
}

function nextRoundDSentence() {
    if (STUDY_STATE.currentSentenceIndex >= STUDY_STATE.sentences.length) {
        finishStudySession();
        return;
    }

    let sentence = STUDY_STATE.sentences[STUDY_STATE.currentSentenceIndex];
    // Handle array sentences (dialogues)? Just pick first? 
    // Existing game logic handles arrays by joining or picking one?
    // Let's flatten:
    if (Array.isArray(sentence)) sentence = sentence[0];

    const container = document.getElementById('study-game-area');
    container.innerHTML = `
        <div class="flex flex-col gap-[var(--gap-md)] w-full max-w-2xl mx-auto px-4">
             <div id="sentence-drop-zone" class="bg-gray-800/50 p-6 rounded-xl min-h-[120px] flex flex-wrap gap-[var(--gap-sm)] items-center justify-center border-2 border-dashed border-gray-600">
                <!-- Drop words here -->
             </div>
             
             <div id="sentence-word-bank" class="bg-gray-700/50 p-4 rounded-xl flex flex-wrap gap-[var(--gap-sm)] justify-center min-h-[100px]">
                <!-- Source words -->
             </div>
             
             <div class="flex justify-center gap-4">
                <button onclick="checkRoundD('${sentence.replace(/'/g, "\\'")}')" class="game-btn bg-green-500 py-3 px-8 text-xl">CHECK</button>
             </div>
        </div>
    `;

    // Tokenize
    // Simple space split, retain punctuation attached? 
    // Existing game uses complex tokenization. Let's start simple or reuse `game.js` helpers if exposed.
    // I'll stick to simple space split for now to ensure robustness without dep.
    const tokens = sentence.split(' ');
    const shuffled = [...tokens].sort(() => 0.5 - Math.random());

    const bank = document.getElementById('sentence-word-bank');

    shuffled.forEach((word, idx) => {
        const btn = createWordTile(word, idx);
        bank.appendChild(btn);
    });
}

function createWordTile(word, id) {
    const btn = document.createElement('button');
    btn.className = "study-word-tile";
    btn.innerText = word;
    btn.dataset.word = word;
    btn.dataset.id = id;
    btn.onclick = (e) => moveWordTile(e.target);
    return btn;
}

function moveWordTile(btn) {
    const dropZone = document.getElementById('sentence-drop-zone');
    const bank = document.getElementById('sentence-word-bank');

    if (btn.parentElement === bank) {
        dropZone.appendChild(btn);
    } else {
        bank.appendChild(btn);
    }
}

function checkRoundD(targetSentence) {
    const dropZone = document.getElementById('sentence-drop-zone');
    const currentWords = Array.from(dropZone.children).map(b => b.dataset.word);
    const formedSentence = currentWords.join(' ');

    // Normalize logic? (Trim spaces, etc)
    // Target might have different whitespace, but split(' ') join(' ') usually matches if tokenization matched.

    if (formedSentence === targetSentence) {
        playHappySound();
        setTimeout(() => {
            STUDY_STATE.currentSentenceIndex++;
            nextRoundDSentence();
        }, 1000);
    } else {
        synthError();
        dropZone.classList.add('border-red-500');
        setTimeout(() => dropZone.classList.remove('border-red-500'), 500);
    }
}


function finishStudySession() {
    const durationMs = Date.now() - STUDY_STATE.startTime;
    const durationSec = Math.floor(durationMs / 1000);
    const mm = Math.floor(durationSec / 60);
    const ss = durationSec % 60;
    const timeStr = `${mm}m ${ss}s`;

    const player = selectedStudent || "Student";

    const container = document.getElementById('study-game-area');
    container.innerHTML = `
        <div class="text-center px-4">
            <h2 class="study-text-2xl text-green-400 font-bold mb-4">Great job ${player}!</h2>
            <p class="study-text-xl text-white mb-2">You completed this session in ${timeStr}</p>
            <p class="study-text-xl text-yellow-400 mb-8 font-bold">记得发图片在群里给Val看看！!</p>
            
            <div class="flex flex-col gap-4 items-center">
                <button onclick="initStudyMode()" class="game-btn bg-blue-600 text-xl sm:text-2xl w-full max-w-[280px]">再学习一下</button>
                <button onclick="exitStudyMode()" class="game-btn bg-orange-500 text-xl sm:text-2xl w-full max-w-[280px]">边玩边学</button>
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
        // Find last filled slot
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
    }
}

function handleRoundCKeyDown(key) {
    if (key === 'Enter') {
        const word = currentTTSWord;
        checkRoundC(word);
    } else if (key === 'Backspace') {
        roundCInput = roundCInput.slice(0, -1);
        updateRoundCDisplay();
    } else if (key.length === 1 && key.match(/[a-z0-9]/i)) {
        // Only allow typing if the key is in the visible virtual keyboard
        const kb = document.getElementById('virtual-keyboard').children;
        for (let btn of kb) {
            if (btn.innerText.toLowerCase() === key.toLowerCase()) {
                typeRoundC(btn.innerText);
                break;
            }
        }
    }
}
