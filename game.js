// --- CONTENT MANAGEMENT ---
let SPELLING_WORDS = [];
let SIGHT_WORDS = [];
let GRAMMAR_SENTENCES = [];

// --- GLOBAL STATE (activeGameMode, game declared in boot.js) ---

// --- TRANSLATION SYSTEM (LOCAL) ---
function getLocalTranslation(text) {
    if (!text || typeof LOCAL_TRANSLATIONS === 'undefined') return '';
    const key = text.trim();
    return LOCAL_TRANSLATIONS[key] || '';
}

function showTranslation(elementId, text) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.textContent = "";
    el.classList.add('hidden');

    const cn = getLocalTranslation(text);
    if (cn) {
        el.textContent = cn;
        el.classList.remove('hidden');
    }
}

function showVocabImage(elementId, word) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.classList.add('hidden');
    if (!word) return;

    const filename = word.trim().toLowerCase().replace(/ /g, '-');
    const imagePath = `images/vocab/${filename}.png`;

    // Use an off-DOM image to preload and check existence
    const img = new Image();
    img.onload = () => {
        el.src = imagePath;
        el.classList.remove('hidden');
    };
    img.onerror = () => {
        el.classList.add('hidden');
    };
    img.src = imagePath;
}

function showVocabImage(elementId, word) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.classList.add('hidden');
    if (!word) return;

    const filename = word.trim().toLowerCase().replace(/ /g, '-');
    const imagePath = `images/vocab/${filename}.png`;

    // Use an off-DOM image to preload and check existence
    const img = new Image();
    img.onload = () => {
        el.src = imagePath;
        el.classList.remove('hidden');
    };
    img.onerror = () => {
        el.classList.add('hidden');
    };
    img.src = imagePath;
}

// --- AUDIO SYSTEM ---
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
const osc = (type, freq, dur, vol = 0.1) => {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur);
}
const noise = (dur) => {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * dur;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const n = audioCtx.createBufferSource();
    n.buffer = buffer;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    n.connect(g); g.connect(audioCtx.destination);
    n.start();
}
const synthWhipCrack = () => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // 1. Whoosh/Swell (the swing)
    const oscSwing = audioCtx.createOscillator();
    const gainSwing = audioCtx.createGain();
    oscSwing.type = 'triangle';
    oscSwing.frequency.setValueAtTime(100, now);
    oscSwing.frequency.exponentialRampToValueAtTime(700, now + 0.08);
    gainSwing.gain.setValueAtTime(0.001, now);
    gainSwing.gain.linearRampToValueAtTime(0.08, now + 0.06);
    gainSwing.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    
    oscSwing.connect(gainSwing);
    gainSwing.connect(audioCtx.destination);
    oscSwing.start(now);
    oscSwing.stop(now + 0.1);

    // 2. The Crack (extremely sharp high-intensity pop)
    const oscCrack = audioCtx.createOscillator();
    const gainCrack = audioCtx.createGain();
    oscCrack.type = 'sawtooth';
    oscCrack.frequency.setValueAtTime(2800, now + 0.07);
    oscCrack.frequency.exponentialRampToValueAtTime(150, now + 0.13);
    
    gainCrack.gain.setValueAtTime(0.001, now);
    gainCrack.gain.setValueAtTime(0.35, now + 0.07); // loud, crisp snap!
    gainCrack.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    
    oscCrack.connect(gainCrack);
    gainCrack.connect(audioCtx.destination);
    oscCrack.start(now + 0.07);
    oscCrack.stop(now + 0.15);

    // 3. Noise Snap (high frequency white noise snap/shockwave)
    const bufferSize = audioCtx.sampleRate * 0.08;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, now + 0.07);
    filter.Q.setValueAtTime(1.5, now + 0.07);

    const gainNoise = audioCtx.createGain();
    gainNoise.gain.setValueAtTime(0.001, now);
    gainNoise.gain.setValueAtTime(0.3, now + 0.07);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    noiseNode.connect(filter);
    filter.connect(gainNoise);
    gainNoise.connect(audioCtx.destination);
    noiseNode.start(now + 0.07);
};

const synthShoot = (type) => {
    if (type === 'wand') osc('sine', 800, 0.1, 0.05);
    if (type === 'whip') synthWhipCrack();
    if (type === 'orb') osc('triangle', 200, 0.3, 0.05);
    if (type === 'axe') osc('square', 150, 0.15, 0.05);
    if (type === 'cross') osc('sine', 600, 0.2, 0.05);
    if (type === 'knife') osc('sawtooth', 1000, 0.1, 0.02);
    if (type === 'garlic') osc('sine', 100, 0.5, 0.02);
};
const synthHit = () => osc('square', 100, 0.1, 0.05);
const synthGem = () => osc('sine', 1200, 0.1, 0.05);
const synthLevelUp = () => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [440, 554, 659, 880].forEach((f, i) => {
        const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
        o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.1, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.3);
    });
};
const synthHurt = () => {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.3);
}
const synthError = () => {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(100, audioCtx.currentTime);
    o.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.2);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.2);
};

const synthDeath = () => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const playNote = (freq, start, dur) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.2, start);
        g.gain.exponentialRampToValueAtTime(0.01, start + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(start); o.stop(start + dur);
    };
    // dadadadum
    playNote(220, now, 0.2);       // A3
    playNote(220, now + 0.25, 0.2);  // A3
    playNote(220, now + 0.5, 0.2);   // A3
    playNote(164.8, now + 0.75, 0.6); // E3 (lower)
};

const synthLootbox = () => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(440, now);
    o.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    o.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(now + 0.3);
};
let currentTTSWord = "";
const playTTS = () => {
    if (!currentTTSWord) return;
    const text = currentTTSWord;

    // Helper: try playing an Audio URL with a timeout.
    // If audio doesn't start playing within timeoutMs, fall through to onFail.
    // The settled flag prevents double-triggering from both timeout and error.
    const tryAudioWithTimeout = (url, label, onFail, timeoutMs = 2000) => {
        let settled = false;
        const fail = (reason) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            console.warn(`${label} ${reason}`);
            onFail();
        };
        const audio = new Audio(url);
        audio.addEventListener('playing', () => {
            settled = true;
            clearTimeout(timer);
        });
        audio.onerror = () => fail("error");
        audio.play().catch(e => fail("play failed: " + e));
        const timer = setTimeout(() => fail("timeout"), timeoutMs);
    };

    const playYoudao = () => {
        const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`;
        tryAudioWithTimeout(url, "Youdao TTS", playLocalMP3, 1000);
    };

    const playLocalMP3 = () => {
        const url = `audio_mp3/${encodeURIComponent(text)}.mp3`;
        tryAudioWithTimeout(url, "Local MP3", playBaidu, 10000);
    };

    const playBaidu = () => {
        const url = `https://fanyi.baidu.com/gettts?lan=uk&text=${encodeURIComponent(text)}&spd=3&source=web`;
        tryAudioWithTimeout(url, "Baidu Fanyi TTS", playBrowserSpeech, 2000);
    };

    const playBrowserSpeech = () => {
        console.log("Falling back to Browser Speech");
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 0.9;
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(val => val.lang.includes('GB') || val.lang.includes('UK') || val.lang.includes('en'));
            if (v) u.voice = v;
            window.speechSynthesis.speak(u);
        }
    };

    playYoudao();
};

// --- PHASER STATE (game declared in boot.js) ---


// --- DOM FUNCTIONS ---
function updateDOMHUD(stats, time, kills) {
    // Only update if in Vampire Survivors mode and HUD exists
    if (activeGameMode !== 'VS') return;

    const hpFill = document.getElementById('hpBarFill');
    const hpText = document.getElementById('hpText');
    const xpFill = document.getElementById('xpBar');
    const lvlDisp = document.getElementById('levelDisplay');
    const timerDisp = document.getElementById('timerDisplay');
    const killDisp = document.getElementById('killDisplay');

    if (hpFill) hpFill.style.width = (stats.hp / stats.maxHp * 100) + '%';
    if (hpText) hpText.innerText = `${Math.floor(stats.hp)}/${stats.maxHp}`;
    if (xpFill) xpFill.style.width = (stats.xp / stats.nextLevelXp * 100) + '%';
    if (lvlDisp) lvlDisp.innerText = stats.level;
    if (killDisp) killDisp.innerText = kills;

    if (timerDisp) {
        const m = Math.floor(time / 60);
        const s = time % 60;
        timerDisp.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    }
}


function showGameSelection() {
    // Reset all screens
    const screens = ['startScreen', 'gomokuScreen', 'gomokuGameOverScreen', 'gameOverScreen', 'gameIntroOverlay', 'studentManagerOverlay', 'studyModeOverlay', 'unoScreen', 'unoGameOverScreen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Cancel any pending stop from endUno(), then stop UNO scene properly
    if (typeof unoGameActive !== 'undefined') unoGameActive = false;
    if (window.unoTimerInterval) clearInterval(window.unoTimerInterval);
    if (window.unoStopTimeout) { clearTimeout(window.unoStopTimeout); window.unoStopTimeout = null; }
    if (typeof game !== 'undefined' && game && game.scene && game.scene.isActive('UnoScene')) {
        game.scene.stop('UnoScene');
    }

    document.getElementById('gameSelectionOverlay').classList.remove('hidden');
}

// --- WIZARD STATE ---
// --- WIZARD STATE (Moved to teaching_content.js for global access) ---

function initMenus() {
    if (typeof CLASS_CONFIG === 'undefined' || typeof CLASS_DAYS === 'undefined') {
        console.error("CLASS_CONFIG or CLASS_DAYS is undefined. Make sure teaching_content.js is loaded correctly.");
        return;
    }

    // Populate Day buttons
    const dayContainer = document.getElementById('day-buttons');
    dayContainer.innerHTML = '';

    CLASS_DAYS.forEach(day => {
        const btn = document.createElement('button');
        btn.className = 'wizard-btn bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200';
        btn.innerText = day;
        btn.onclick = () => selectDay(day);
        dayContainer.appendChild(btn);
    });
}

function selectDay(day) {
    selectedDay = day;

    if (day === "其他老师的学生") {
        document.getElementById('step-day').classList.add('hidden');
        document.getElementById('step-book').classList.remove('hidden');

        // Populate book buttons
        const bookContainer = document.getElementById('book-buttons');
        bookContainer.innerHTML = '';
        Object.keys(TEACHING_CONTENT).forEach(book => {
            const btn = document.createElement('button');
            btn.className = 'wizard-btn bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200';
            btn.innerText = book;
            btn.onclick = () => selectBook(book);
            bookContainer.appendChild(btn);
        });
        return;
    }

    // Hide step 1, show step 2
    document.getElementById('step-day').classList.add('hidden');
    document.getElementById('step-time').classList.remove('hidden');

    // Populate time buttons for this day
    const timeContainer = document.getElementById('time-buttons');
    const noClassMsg = document.getElementById('no-class-msg');
    timeContainer.innerHTML = '';

    const dayData = CLASS_CONFIG[day];

    if (dayData && Object.keys(dayData).length > 0) {
        noClassMsg.classList.add('hidden');
        Object.keys(dayData).forEach(time => {
            const btn = document.createElement('button');
            btn.className = 'wizard-btn bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200';
            btn.innerText = time;
            btn.onclick = () => selectTime(time);
            timeContainer.appendChild(btn);
        });
    } else {
        // No classes for this day
        noClassMsg.classList.remove('hidden');
    }
}

function selectTime(time) {
    selectedTime = time;

    const classData = CLASS_CONFIG[selectedDay][time];
    // Hide step 2, show step 3
    document.getElementById('step-time').classList.add('hidden');
    document.getElementById('step-student').classList.remove('hidden');

    // Populate student buttons
    const studentContainer = document.getElementById('student-buttons');
    studentContainer.innerHTML = '';

    if (classData && classData.students) {
        classData.students.forEach(student => {
            const btn = document.createElement('button');
            btn.className = 'wizard-btn bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200';
            btn.innerText = student;
            btn.onclick = () => selectStudent(student);
            studentContainer.appendChild(btn);
        });
    }
}

function selectBook(book) {
    selectedBook = book;
    document.getElementById('step-book').classList.add('hidden');
    document.getElementById('step-unit').classList.remove('hidden');

    const unitContainer = document.getElementById('unit-buttons');
    unitContainer.innerHTML = '';
    const bookData = TEACHING_CONTENT[book];
    if (bookData) {
        Object.keys(bookData).forEach(unit => {
            const btn = document.createElement('button');
            btn.className = 'wizard-btn bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200';
            btn.innerText = `Unit ${unit}`;
            btn.onclick = () => selectUnit(unit);
            unitContainer.appendChild(btn);
        });
    }
}

function selectUnit(unit) {
    selectedUnit = unit;
    selectedStudent = "Other Student"; // Tag as other teacher student

    document.getElementById('step-unit').classList.add('hidden');
    document.getElementById('step-greeting').classList.remove('hidden');

    document.getElementById('greeting-text').innerText = `欢迎！`;
    loadContent();
}

function selectStudent(student) {
    selectedStudent = student;

    // Hide step 3, show step 4 (greeting)
    document.getElementById('step-student').classList.add('hidden');
    document.getElementById('step-greeting').classList.remove('hidden');

    // Update greeting text
    document.getElementById('greeting-text').innerText = `Hello, ${student}!`;

    // Load content for this class
    loadContent();
}

// --- BACK NAVIGATION ---
function goBackToDay() {
    document.getElementById('step-time').classList.add('hidden');
    document.getElementById('step-book').classList.add('hidden'); // Also hide if we came from book
    document.getElementById('step-day').classList.remove('hidden');
    selectedDay = null;
    selectedBook = null;
}

function goBackToTime() {
    document.getElementById('step-student').classList.add('hidden');
    document.getElementById('step-time').classList.remove('hidden');
    selectedTime = null;
}

function goBackToStudentOrUnit() {
    document.getElementById('step-greeting').classList.add('hidden');
    if (selectedBook) {
        document.getElementById('step-unit').classList.remove('hidden');
    } else {
        document.getElementById('step-student').classList.remove('hidden');
    }
    selectedStudent = null;
    selectedUnit = null;
}

function goBackToBook() {
    document.getElementById('step-unit').classList.add('hidden');
    document.getElementById('step-book').classList.remove('hidden');
    selectedBook = null;
    selectedUnit = null;
}

function goBackToTimeFromBook() {
    document.getElementById('step-book').classList.add('hidden');
    document.getElementById('step-time').classList.remove('hidden');
    selectedBook = null;
}

// --- GAME INTRO ---

let pendingReward = null;
let rewardContext = 'levelup';
let isFirstAttempt = true;
let minigameStartTime = 0; // Track when minigame started (in ms)
let currentMinigameType = ''; // Track which type of minigame is active
let minigameCountdownInterval = null; // Interval for countdown timer during minigames
let totalMinigameTimeMs = 0; // Track total time spent in all minigames



function startMinigameCountdown(scene) {
    // Clear any existing countdown
    if (minigameCountdownInterval) {
        clearInterval(minigameCountdownInterval);
    }

    // Update countdown every 100ms
    minigameCountdownInterval = setInterval(() => {
        let timeString = "";

        if (activeGameMode === 'Gomoku' && typeof gomokuMode !== 'undefined' && gomokuMode === 'speed') {
            // Show time until next computer move ONLY in speed mode
            const timeLeftMs = Math.max(0, gomokuNextAiTime - Date.now());
            const totalSec = Math.floor(timeLeftMs / 1000);
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            const ms = Math.floor((timeLeftMs % 1000) / 10);
            timeString = `AI Move: ${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}:${ms < 10 ? '0' + ms : ms}`;
        } else {
            // Hide the timer for all other modes as requested
            timeString = "";
        }

        // Update all minigame timer displays
        const spellingTimer = document.getElementById('spelling-timer');
        const recTimer = document.getElementById('rec-timer');
        const grammarTimer = document.getElementById('grammar-timer');
        const sentencematchTimer = document.getElementById('sentencematch-timer');

        if (spellingTimer) spellingTimer.textContent = timeString;
        if (recTimer) recTimer.textContent = timeString;
        if (grammarTimer) grammarTimer.textContent = timeString;
        if (sentencematchTimer) sentencematchTimer.textContent = timeString;

        // Deduct time from survival time (if VS)
        if (activeGameMode === 'VS' && scene) {
            scene.accumulatedTime = Math.max(0, scene.accumulatedTime - 100);
        }
    }, 100);
}

function startMiniGame(type, context) {
    rewardContext = context;
    isFirstAttempt = true;
    currentMinigameType = type;
    minigameStartTime = Date.now(); // Record start time

    // Start countdown timer display (we start it even to clear the strings if empty)
    const scene = game ? game.scene.getScene('MainScene') : null;
    startMinigameCountdown(scene);


    if (type === 'spelling') startSpellingGame();
    if (type === 'wordrec') startWordRecGame();
    if (type === 'scramble') startGrammarGame();
    if (type === 'sentencematch') startSentenceMatchGame();
}

function claimReward(success) {
    // Stop countdown timer
    if (minigameCountdownInterval) {
        clearInterval(minigameCountdownInterval);
        minigameCountdownInterval = null;
    }

    document.getElementById('spellingGame').classList.add('hidden');
    document.getElementById('wordRecGame').classList.add('hidden');
    document.getElementById('grammarGame').classList.add('hidden');
    document.getElementById('sentenceMatchGame').classList.add('hidden');

    // Calculate time penalty
    const timeSpentMs = Date.now() - minigameStartTime;
    const timeSpentSec = Math.floor(timeSpentMs / 1000);

    // Track cumulative minigame time
    totalMinigameTimeMs += timeSpentMs;

    if (rewardContext === 'gomoku' || activeGameMode === 'Gomoku') {
        completeGomokuMove(success);
        return;
    }

    if (rewardContext === 'uno' || activeGameMode === 'Uno') {
        completeUnoESLQuestion(success);
        return;
    }

    if (rewardContext === 'towerdefense' || activeGameMode === 'TowerDefense') {
        if (success && typeof tdCreditCoins === 'function') tdCreditCoins(50);
        return;
    }

    const scene = (game && activeGameMode === 'VS') ? game.scene.getScene('MainScene') : null;

    // Note: time was already deducted during countdown in startMinigameCountdown
    // Just update the HUD
    if (scene) {
        updateDOMHUD(scene.playerStats, Math.floor(scene.accumulatedTime / 1000), scene.killCount);

        // Apply reward based on game type and success
        if (success) {
            if (rewardContext === 'chest') {
                const r = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
                scene.applyReward(r);
            } else {
                scene.applyReward(pendingReward);
            }
        }
        game.scene.resume('MainScene');
    }
}

// --- PLACEHOLDERS FOR LARGE CHUNKS ---
function loadContent() {
    let book, unit, page;

    if (typeof authActiveUser !== 'undefined' && authActiveUser && authActiveUser.book && authActiveUser.unit && authActiveUser.page) {
        book = authActiveUser.book;
        unit = authActiveUser.unit.toString();
        page = authActiveUser.page.toString();
        selectedClassContent = { book, unit, page };
    } else if (selectedBook && selectedUnit) {
        book = selectedBook;
        unit = selectedUnit;
        // Assign the LAST page of that unit
        const bookData = TEACHING_CONTENT[book];
        const unitData = bookData[unit];
        const pages = Object.keys(unitData).sort((a, b) => parseInt(a) - parseInt(b));
        page = pages[pages.length - 1]; // Last page
        selectedClassContent = { book, unit, page };
    } else {
        if (!CLASS_CONFIG || !selectedDay || !selectedTime) return;
        const classData = CLASS_CONFIG[selectedDay] && CLASS_CONFIG[selectedDay][selectedTime];
        if (!classData || !classData.content) {
            console.warn("No content configured for:", selectedDay, selectedTime);
            return;
        }
        ({ book, unit, page } = classData.content);
        selectedClassContent = { book, unit, page };
    }

    // Default to empty
    SPELLING_WORDS = [];
    SIGHT_WORDS = [];
    GRAMMAR_SENTENCES = [];

    // Use Spaced Repetition logic to get all available items up to current page
    const sortedPages = getSortedPagesForBook(book);
    const activePageIndex = sortedPages.findIndex(p => p.book === book && p.unit === unit && p.page === page.toString());

    // We populate the global arrays with ALL eligible items (up to current)
    // The specific weighted selection will happen during minigame start
    const unitsToLoad = sortedPages.slice(0, activePageIndex + 1);

    unitsToLoad.forEach(p => {
        const content = TEACHING_CONTENT[book] && TEACHING_CONTENT[book][p.unit] && TEACHING_CONTENT[book][p.unit][p.page];
        if (content) {
            if (content.vocab) {
                content.vocab.forEach(w => {
                    if (!SPELLING_WORDS.includes(w)) SPELLING_WORDS.push(w);
                });
            }
            if (content.sentences) {
                content.sentences.forEach(s => {
                    // Avoid dupes if necessary, though sentences might be unique across pages usually
                    GRAMMAR_SENTENCES.push(s);
                });
            }
        }
    });

    // Format SIGHT_WORDS (legacy legacy...)
    SIGHT_WORDS = SPELLING_WORDS.map(w => [w]);

    if (SPELLING_WORDS.length === 0) {
        // Final fallback if absolutely nothing found
        const prefix = `${book} U${unit} P${page}`;
        SPELLING_WORDS = [`${prefix} Word1`];
        SIGHT_WORDS = [[`${prefix} Word1`]];
        GRAMMAR_SENTENCES = [`${prefix} Sentence 1.`];
    }
}

// SR result tracking for game session
var srGameResults = [];  // [{ type, key, firstAttempt }, ...]
var srInSessionFailures = new Set();  // Set of keys failed at least once this session
var srInSessionSuccesses = new Set(); // Set of keys succeeded on first attempt this session

// --- MINIGAMES ---

function startSpellingGame() {
    if (SPELLING_WORDS.length === 0) { handleMinigameSuccess('spelling'); return; }
    startExerciseTracking();

    // SR-aware selection
    const { book, unit, page } = selectedClassContent;
    const word = getGameItemSR(book, unit, page, 'vocab', srInSessionFailures, srInSessionSuccesses);
    currentTTSWord = word;
    document.getElementById('spellingGame').dataset.targetWord = word;
    showTranslation('spelling-translation', word);
    showVocabImage('spelling-image', word);

    const totalChars = word.length;
    // Always use ALL letters - no level-based scaling
    // But spaces should be pre-filled
    const indices = [];
    for (let i = 0; i < totalChars; i++) {
        if (word[i] !== ' ') {
            indices.push(i);
        }
    }
    const missingIndices = [...indices]; // All non-space characters are missing
    let missingCount = missingIndices.length;

    let template = [];
    let missingChars = [];
    for (let i = 0; i < totalChars; i++) {
        if (missingIndices.includes(i)) {
            template.push(null);
            missingChars.push(word[i]);
        } else {
            template.push(word[i]);
        }
    }
    missingIndices.sort((a, b) => a - b); // purely for display order if needed, but logic handles it

    const gameEl = document.getElementById('spellingGame');
    gameEl.dataset.targetWord = word;
    gameEl.dataset.template = JSON.stringify(template);
    gameEl.dataset.missingChars = JSON.stringify(missingChars); // Unsorted for validation logic? No, validation matches input string
    // Wait, original logic sorted missing chars to create the key sequence.
    // Let's mirror original logic: "sortedMissingChars = missingIndices.map(idx => word[idx]);"
    // My missingChars above is in index order? No, loop 0..total. Yes index order.

    gameEl.dataset.currentInput = "";
    gameEl.dataset.feedbackMode = "false";

    updateSpellingDisplay();

    const display = document.getElementById('spelling-input-display');
    display.classList.remove('shake');
    document.getElementById('spelling-result-action').classList.add('hidden');
    document.getElementById('spelling-actions').classList.remove('hidden');
    document.getElementById('spellingGame').classList.remove('hidden');

    // Keyboard keys (shuffled)
    const keys = [...missingChars];
    keys.sort(() => 0.5 - Math.random());

    const container = document.getElementById('spelling-keyboard');
    container.innerHTML = '';
    keys.forEach(char => {
        const bubble = document.createElement('div');
        bubble.className = 'letter-bubble'; bubble.innerText = char;
        bubble.onclick = () => handleSpellingInput(char, bubble);
        container.appendChild(bubble);
    });
    setTimeout(playTTS, 500);
}

function handleSpellingInput(char, bubble) {
    if (!document.getElementById('spelling-result-action').classList.contains('hidden')) return;

    const gameEl = document.getElementById('spellingGame');
    const missingChars = JSON.parse(gameEl.dataset.missingChars);
    let currentInput = gameEl.dataset.currentInput;

    if (currentInput.length < missingChars.length) {
        currentInput += char;
        gameEl.dataset.currentInput = currentInput;
        bubble.style.visibility = 'hidden';
        updateSpellingDisplay();
    }
}

function updateSpellingDisplay() {
    const gameEl = document.getElementById('spellingGame');
    const template = JSON.parse(gameEl.dataset.template);
    const currentInput = gameEl.dataset.currentInput;
    const targetWord = gameEl.dataset.targetWord;
    const isFeedback = gameEl.dataset.feedbackMode === "true";
    const isSuccess = !document.getElementById('spelling-result-action').classList.contains('hidden');

    let displayHtml = "";
    let inputIdx = 0;

    template.forEach((char, fullIdx) => {
        if (char === null) {
            if (inputIdx < currentInput.length) {
                let colorClass = "text-blue-600";
                if (isSuccess) {
                    colorClass = "text-green-500";
                } else if (isFeedback) {
                    colorClass = (currentInput[inputIdx] === targetWord[fullIdx]) ? "text-green-500" : "text-red-500";
                }
                displayHtml += `<span class="${colorClass} underline">${currentInput[inputIdx]}</span>`;
                inputIdx++;
            } else {
                displayHtml += "_";
            }
        } else {
            // Show literal characters like spaces
            displayHtml += char === ' ' ? '&nbsp;' : char;
        }
    });
    document.getElementById('spelling-input-display').innerHTML = displayHtml;
}

function clearSpelling() {
    if (!document.getElementById('spelling-result-action').classList.contains('hidden')) return;

    const gameEl = document.getElementById('spellingGame');
    gameEl.dataset.currentInput = "";
    gameEl.dataset.feedbackMode = "false";
    updateSpellingDisplay();
    const display = document.getElementById('spelling-input-display');
    display.classList.remove('shake');
    document.querySelectorAll('.letter-bubble').forEach(b => b.style.visibility = 'visible');
}

function checkSpelling() {
    if (!document.getElementById('spelling-result-action').classList.contains('hidden')) return;

    const gameEl = document.getElementById('spellingGame');
    const currentInput = gameEl.dataset.currentInput;
    const missingChars = JSON.parse(gameEl.dataset.missingChars);

    // The original logic checked if currentInput === missingChars.join('')
    // Ideally we'd check if the RESULTING word matches target, but since we fill slots in order, matching the sequence of missing characters is equivalent.

    if (currentInput === missingChars.join('')) {
        handleMinigameSuccess('spelling');
        updateSpellingDisplay(); // Refresh to show green
    } else {
        gameEl.dataset.feedbackMode = "true";
        updateSpellingDisplay();
        const display = document.getElementById('spelling-input-display');
        display.classList.add('shake');
        synthError();
        setTimeout(() => display.classList.remove('shake'), 500);
        isFirstAttempt = false;
        incrementExerciseAttempts();
    }
}

// --- WORD REC ---
let recTimer;
let recTimeLeft;

function startWordRecGame() {
    if (SIGHT_WORDS.length === 0) { handleMinigameSuccess('rec'); return; }

    // Weighted selection
    const { book, unit, page } = selectedClassContent;
    const target = getWeightedItemForGame(book, unit, page, 'vocab');

    currentTTSWord = target;
    showTranslation('rec-translation', target);
    showVocabImage('rec-image', target);

    // Always show 5 words - no level-based scaling
    let choiceCount = 5;

    let choices = [target];
    const pool = SIGHT_WORDS.flat().filter(w => w !== target);
    pool.sort(() => 0.5 - Math.random());

    let added = 0;
    for (let w of pool) {
        if (added >= choiceCount - 1) break;
        if (!choices.includes(w)) {
            choices.push(w);
            added++;
        }
    }
    choices.sort(() => 0.5 - Math.random());

    const container = document.getElementById('rec-options');
    container.innerHTML = '';
    container.classList.remove('hidden');

    choices.forEach(word => {
        const btn = document.createElement('button');
        btn.className = "game-btn text-2xl py-8 min-w-[150px]";
        btn.innerText = word;
        btn.onclick = () => checkWordRec(word, target, btn);
        container.appendChild(btn);
    });

    document.getElementById('rec-result-action').classList.add('hidden');
    document.getElementById('wordRecGame').classList.remove('hidden');

    recTimeLeft = 100;
    const bar = document.getElementById('rec-timer-bar');
    bar.style.width = '100%';
    if (recTimer) clearInterval(recTimer);
    recTimer = setInterval(() => {
        recTimeLeft -= 1;
        bar.style.width = recTimeLeft + '%';
        if (recTimeLeft <= 0) {
            clearInterval(recTimer);
            isFirstAttempt = false;
        }
    }, 50);
    setTimeout(playTTS, 500);
}

function checkWordRec(selected, target, btn) {
    clearInterval(recTimer);
    if (selected === target) {
        handleMinigameSuccess('rec');
    } else {
        synthError();
        btn.classList.add('bg-red-500', 'shake');
        setTimeout(() => {
            btn.classList.remove('bg-red-500', 'shake');
            startWordRecGame();
        }, 500);
    }
}

// --- GRAMMAR ---

function startGrammarGame() {
    if (GRAMMAR_SENTENCES.length === 0) { handleMinigameSuccess('grammar'); return; }
    startExerciseTracking();

    const { book, unit, page } = selectedClassContent;
    const rawEntry = getGameItemSR(book, unit, page, 'sentences', srInSessionFailures, srInSessionSuccesses);
    let possibilities = [];
    let primarySentence = "";

    if (Array.isArray(rawEntry)) {
        possibilities = rawEntry;
        primarySentence = rawEntry[0];
    } else {
        possibilities = [rawEntry];
        primarySentence = rawEntry;
    }

    // Store valid possibilities for validation
    const grammarGameEl = document.getElementById('grammarGame');
    grammarGameEl.dataset.validOptions = JSON.stringify(possibilities);
    grammarGameEl.dataset.targetSentence = primarySentence;
    showTranslation('grammar-translation', primarySentence);


    const sentContainer = document.getElementById('sentence-container');
    const dock = document.getElementById('word-dock');
    sentContainer.innerHTML = ''; dock.innerHTML = '';

    document.getElementById('grammar-result-action').classList.add('hidden');
    document.getElementById('grammar-actions').classList.remove('hidden');

    const rawChunks = primarySentence.split(' ');
    const tokens = rawChunks.map(chunk => {
        return { word: chunk, punct: '' };
    });

    const candidateIndices = tokens.map((_, i) => i);
    candidateIndices.sort(() => 0.5 - Math.random());

    // Always use ALL words - no level-based scaling
    let numBlanks = tokens.length;

    const blankIndices = candidateIndices.slice(0, numBlanks);
    const neededOptions = [];

    const sentenceDiv = document.createElement('div');
    sentenceDiv.className = 'sentence-row';

    tokens.forEach((token, index) => {
        if (blankIndices.includes(index)) {
            neededOptions.push(token.word);
            const dz = document.createElement('div');
            dz.className = 'drop-zone';
            dz.dataset.expected = token.word;
            sentenceDiv.appendChild(dz);
            if (token.punct) {
                const span = document.createElement('span');
                span.innerText = token.punct;
                span.className = "mr-2";
                sentenceDiv.appendChild(span);
            }
        } else {
            const span = document.createElement('span');
            span.className = "mx-1";
            span.innerText = token.word + token.punct;
            sentenceDiv.appendChild(span);
        }
    });
    sentContainer.appendChild(sentenceDiv);

    neededOptions.sort(() => 0.5 - Math.random());
    neededOptions.forEach(opt => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'draggable';
        wordDiv.innerText = opt;
        dock.appendChild(wordDiv);
    });

    document.getElementById('grammarGame').classList.remove('hidden');
}

function clearGrammar() {
    const zones = document.querySelectorAll('.drop-zone');
    const dock = document.getElementById('word-dock');
    zones.forEach(zone => {
        if (zone.children.length > 0) {
            const item = zone.children[0];
            item.classList.remove('wrong', 'correct');
            dock.appendChild(item);
            zone.classList.remove('filled');
        }
    });
}

function checkGrammar() {
    const zones = document.querySelectorAll('.drop-zone');
    const gameEl = document.getElementById('grammarGame');
    const validOptions = JSON.parse(gameEl.dataset.validOptions || "[]");

    // 1. Collect user's words
    let userWords = [];
    let anyFilled = false;
    let allFilled = true;

    zones.forEach(zone => {
        if (zone.children.length > 0) {
            anyFilled = true;
            userWords.push(zone.children[0].innerText);
        } else {
            allFilled = false;
            userWords.push(null); // Gap
        }
    });

    // 2. Check complete match against ANY valid option
    let exactMatchFound = false;

    if (allFilled) {
        for (let option of validOptions) {
            // Tokenize option to get words only
            const optChunks = option.split(' ');
            const optWords = optChunks;

            // Compare arrays
            if (optWords.length === userWords.length) {
                const isMatch = optWords.every((w, i) => w === userWords[i]);
                if (isMatch) {
                    exactMatchFound = true;
                    break;
                }
            }
        }
    }

    // 3. Update UI
    let allCorrect = true;
    zones.forEach((zone, i) => {
        if (zone.children.length > 0) {
            const item = zone.children[0];
            const word = item.innerText;

            if (exactMatchFound) {
                // If the whole sentence is a valid variation, everything is correct
                item.classList.add('correct');
                item.classList.remove('wrong');
            } else {
                // Fallback: Grade against the *primary* expected word (from the slot definition)
                // This gives feedback based on the original structure if the user is off
                if (word === zone.dataset.expected) {
                    item.classList.add('correct');
                    item.classList.remove('wrong');
                } else {
                    item.classList.add('wrong');
                    item.classList.remove('correct');
                    allCorrect = false;
                }
            }
        } else {
            allCorrect = false;
        }
    });

    if (exactMatchFound) allCorrect = true;

    if (anyFilled && !allCorrect) {
        synthError();
        isFirstAttempt = false;
        incrementExerciseAttempts();
    }

    if (allCorrect) {
        handleMinigameSuccess('grammar');
    }
}


// --- SENTENCE MATCH MINIGAME ---
let gameModeSelectedBTile = null;

function startSentenceMatchGame() {
    startExerciseTracking();
    const { book, unit, page } = selectedClassContent;

    let pairs = [];
    const result = getGameSentencePairsSR(book, unit, page, srInSessionFailures, srInSessionSuccesses);
    
    if (result && result.pairs && result.pairs.length > 0) {
        pairs = result.pairs;
    }

    // Fallback if selection returns nothing
    if (pairs.length === 0) {
        pairs = [
            { a: "What's your name?", b: "My name is Sarah." },
            { a: "How old are you?", b: "I'm seven years old." },
            { a: "What colour is the apple?", b: "The apple is red." }
        ];
    }

    const shuffledPairs = pairs; // Already picked and unique from one page

    // Store in game element for later reference
    const gameEl = document.getElementById('sentenceMatchGame');
    gameEl.dataset.pairs = JSON.stringify(shuffledPairs);
    gameEl.dataset.pairAttempts = JSON.stringify(shuffledPairs.map(() => 1));
    gameEl.dataset.pairQueued = JSON.stringify(shuffledPairs.map(() => false));

    // Create shuffled B sentences
    const bSentences = shuffledPairs.map((p, i) => ({ text: p.b, correctIndex: i }));
    bSentences.sort(() => 0.5 - Math.random());

    // Build pairs UI
    const pairsContainer = document.getElementById('sentencematch-pairs');
    pairsContainer.innerHTML = shuffledPairs.map((pair, index) => `
        <div class="match-pair-row flex flex-col sm:flex-row gap-2 items-stretch">
            <div class="sentence-a flex-1 bg-indigo-600 p-3 rounded-lg text-white font-medium text-sm" data-index="${index}">
                ${pair.a}
            </div>
            <div class="gm-sentence-b-slot flex-1 bg-gray-200 p-3 rounded-lg min-h-[45px] border-2 border-dashed border-gray-400 flex items-center justify-center cursor-pointer text-gray-700" 
                 data-target-index="${index}" 
                 onclick="handleGameModeSlotClick(${index})">
                <span class="text-gray-400 text-sm">Click to place</span>
            </div>
        </div>
    `).join('');

    // Build dock UI
    const dock = document.getElementById('sentencematch-dock');
    dock.innerHTML = bSentences.map(item => `
        <button class="gm-sentence-b-tile bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                data-correct-index="${item.correctIndex}"
                onclick="selectGameModeBTile(this)">
            ${item.text}
        </button>
    `).join('');

    gameModeSelectedBTile = null;

    document.getElementById('sentencematch-actions').classList.remove('hidden');
    document.getElementById('sentencematch-result-action').classList.add('hidden');
    document.getElementById('sentenceMatchGame').classList.remove('hidden');
}

function selectGameModeBTile(tile) {
    document.querySelectorAll('.gm-sentence-b-tile').forEach(t => t.classList.remove('ring-4', 'ring-yellow-400'));
    gameModeSelectedBTile = tile;
    tile.classList.add('ring-4', 'ring-yellow-400');
}

function handleGameModeSlotClick(slotIndex) {
    const slot = document.querySelector(`.gm-sentence-b-slot[data-target-index="${slotIndex}"]`);

    const existingTile = slot.querySelector('.gm-sentence-b-tile');
    if (existingTile) {
        returnGameModeTileToDock(existingTile);
        slot.innerHTML = '<span class="text-gray-400 text-sm">Click to place</span>';
        return;
    }

    if (gameModeSelectedBTile) {
        slot.innerHTML = '';
        slot.appendChild(gameModeSelectedBTile);
        gameModeSelectedBTile.classList.remove('ring-4', 'ring-yellow-400');
        gameModeSelectedBTile = null;
    }
}

function returnGameModeTileToDock(tile) {
    const dock = document.getElementById('sentencematch-dock');
    tile.classList.remove('ring-4', 'ring-yellow-400');
    tile.style.backgroundColor = '';
    dock.appendChild(tile);
}

function checkSentenceMatch() {
    const slots = document.querySelectorAll('.gm-sentence-b-slot');
    const gameEl = document.getElementById('sentenceMatchGame');
    const pairsData = JSON.parse(gameEl.dataset.pairs);

    let allCorrect = true;
    let anyPlaced = false;

    slots.forEach((slot) => {
        const tile = slot.querySelector('.gm-sentence-b-tile');

        if (tile) {
            anyPlaced = true;
            const targetIndex = parseInt(slot.dataset.targetIndex);

            // Allow matching if the text matches the expected answer for this question
            const placedText = tile.innerText.trim();
            const expectedText = pairsData[targetIndex].b.trim();

            if (placedText === expectedText) {
                tile.style.backgroundColor = '#10b981'; // green
                
                // Track pair individually
                let pairQueued = JSON.parse(gameEl.dataset.pairQueued);
                if (!pairQueued[targetIndex]) {
                    let pairAttempts = JSON.parse(gameEl.dataset.pairAttempts);
                    const itemDetails = `A: ${pairsData[targetIndex].a} | B: ${pairsData[targetIndex].b}`;
                    // Record SR result for sentence pair
                    const pairItem = JSON.parse(document.getElementById('sentenceMatchGame').dataset.pairs)[targetIndex];
                    const pairKey = itemKey(pairItem);
                    const isFirstAttempt = pairAttempts[targetIndex] === 1;
                    srGameResults.push({ type: 'sentencePairs', key: pairKey, firstAttempt: isFirstAttempt });
                    if (!isFirstAttempt) {
                        srInSessionFailures.add(pairKey);
                    } else {
                        srInSessionSuccesses.add(pairKey);
                    }

                    queueExerciseEvent('sentenceMatch', 'game', itemDetails, pairAttempts[targetIndex]);
                    pairQueued[targetIndex] = true;
                    gameEl.dataset.pairQueued = JSON.stringify(pairQueued);
                }
            } else {
                tile.style.backgroundColor = '#ef4444'; // red
                allCorrect = false;
            }
        } else {
            allCorrect = false;
        }
    });

    if (!anyPlaced) return;

    if (allCorrect) {
        handleMinigameSuccess('sentencematch');
    } else {
        synthError();
        isFirstAttempt = false;
        incrementExerciseAttempts();
        
        let pairAttempts = JSON.parse(gameEl.dataset.pairAttempts);
        let pairQueued = JSON.parse(gameEl.dataset.pairQueued);
        
        // Mark as failed for SR
        pairsData.forEach((pair, idx) => {
            if (!pairQueued[idx]) {
                srInSessionFailures.add(itemKey(pair));
            }
        });

        for (let i = 0; i < pairsData.length; i++) {
            if (!pairQueued[i]) pairAttempts[i]++;
        }
        gameEl.dataset.pairAttempts = JSON.stringify(pairAttempts);

        // Reset after 2 seconds
        setTimeout(() => {
            const tiles = document.querySelectorAll('.gm-sentence-b-tile');
            tiles.forEach(tile => {
                returnGameModeTileToDock(tile);
            });
            const slots = document.querySelectorAll('.gm-sentence-b-slot');
            slots.forEach(slot => {
                slot.innerHTML = '<span class="text-gray-400 text-sm">Click to place</span>';
            });
        }, 2000);
    }
}


function handleMinigameSuccess(gameType) {
    let actionsId, resultId, itemDetails = null;
    if (gameType === 'spelling') { 
        actionsId = 'spelling-actions'; 
        resultId = 'spelling-result-action'; 
        itemDetails = document.getElementById('spellingGame').dataset.targetWord;
    }
    else if (gameType === 'rec') { actionsId = 'rec-options'; resultId = 'rec-result-action'; }
    else if (gameType === 'sentencematch') { actionsId = 'sentencematch-actions'; resultId = 'sentencematch-result-action'; }
    else { 
        actionsId = 'grammar-actions'; 
        resultId = 'grammar-result-action'; 
        itemDetails = document.getElementById('grammarGame').dataset.targetSentence;
    }

    // Track exercise analytics (skip word rec)
    if (gameType !== 'rec') {
        const exerciseTypeMap = { 'spelling': 'spelling', 'grammar': 'sentenceScramble', 'sentencematch': 'sentenceMatch' };
        
        // SR result tracking for spelling (vocab) and grammar (sentences)
        if (gameType === 'spelling' || gameType === 'grammar') {
            const srType = gameType === 'spelling' ? 'vocab' : 'sentences';
            const key = itemKey(itemDetails);
            const isFirstAttempt = exerciseAttempts === 1;
            
            srGameResults.push({ type: srType, key: key, firstAttempt: isFirstAttempt });
            if (!isFirstAttempt) {
                srInSessionFailures.add(key);
            } else {
                srInSessionSuccesses.add(key);
            }
        }

        // Only queue globally for spelling and grammar. Sentence Match handles its own item queuing.
        if (gameType !== 'sentencematch') {
            queueExerciseEvent(exerciseTypeMap[gameType] || gameType, 'game', itemDetails);
        }
    }

    if (actionsId) document.getElementById(actionsId).classList.add('hidden');
    const resultDiv = document.getElementById(resultId);
    resultDiv.classList.remove('hidden');

    // Always give reward on eventual success.
    const isGomokuOrUno = (activeGameMode === 'Gomoku' || rewardContext === 'gomoku' || activeGameMode === 'Uno' || rewardContext === 'uno');
    const btnText = isGomokuOrUno ? "CONTINUE!" : "GET POWER UP!";
    resultDiv.innerHTML = `<button onclick="claimReward(true)" class="game-btn bg-green-500 text-2xl py-4 px-8 animate-bounce">${btnText}</button>`;
}



// Init
game = null;
initMenus();
loadContent();

// DOM Listeners for Grammar
document.getElementById('word-dock').addEventListener('click', (e) => {
    if (e.target.classList.contains('draggable')) {
        const emptyZone = Array.from(document.querySelectorAll('.drop-zone')).find(z => z.children.length === 0);
        if (emptyZone) {
            e.target.classList.remove('wrong', 'correct');
            emptyZone.appendChild(e.target);
            emptyZone.classList.add('filled');
        }
    }
});
document.getElementById('sentence-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('draggable')) {
        const dock = document.getElementById('word-dock');
        e.target.classList.remove('wrong', 'correct');
        dock.appendChild(e.target);
        e.target.parentElement.classList.remove('filled');
    }
});

// Initialize menus on load
window.addEventListener('DOMContentLoaded', initMenus);

// --- KEYBOARD SUPPORT FOR MINIGAMES ---
window.addEventListener('keydown', (e) => {
    // Check if Study Mode is active - if so, let it handle the keyboard
    if (typeof STUDY_STATE !== 'undefined' && STUDY_STATE.active) return;

    // Check if Spelling Minigame is active
    const spellingGameEl = document.getElementById('spellingGame');
    if (spellingGameEl && !spellingGameEl.classList.contains('hidden')) {
        // Prevent default browser behavior for Enter/Backspace only when spelling game is active
        // This stops focused buttons (like CLEAR) from being triggered again by the Enter key
        if (e.key === 'Enter' || e.key === 'Backspace') {
            e.preventDefault();
        }
        handleGameSpellingKeyDown(e.key);
    }
});

function handleGameSpellingKeyDown(key) {
    if (key === 'Enter') {
        checkSpelling();
    } else if (key === 'Backspace') {
        clearSpelling();
    } else if (key.length === 1 && key.match(/[a-z0-9]/i)) {
        const bubbles = document.querySelectorAll('.letter-bubble');
        for (let bubble of bubbles) {
            if (bubble.innerText.toLowerCase() === key.toLowerCase() && bubble.style.visibility !== 'hidden') {
                handleSpellingInput(bubble.innerText, bubble);
                break;
            }
        }
    }
}

// --- THEME SYSTEM (KID FRIENDLY / DARK THEME) ---
function toggleTheme() {
    const isKidFriendly = document.body.classList.toggle('kid-friendly');
    localStorage.setItem('theme-kid-friendly', isKidFriendly ? 'true' : 'false');
    updateThemeUI(isKidFriendly);
}

function updateThemeUI(isKidFriendly) {
    const themeToggleIcon = document.getElementById('themeToggleIcon');
    if (themeToggleIcon) {
        themeToggleIcon.textContent = isKidFriendly ? '🧸' : '☀️';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme-kid-friendly');
    const isKidFriendly = savedTheme === 'true';
    if (isKidFriendly) {
        document.body.classList.add('kid-friendly');
    } else {
        document.body.classList.remove('kid-friendly');
    }
    updateThemeUI(isKidFriendly);
}

// Auto-run theme initialization
initTheme();

function goBackFromGameSelection() {
    document.getElementById('gameSelectionOverlay').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    // Ensure step-greeting is visible and others are hidden
    const stepContainers = document.querySelectorAll('.step-container');
    stepContainers.forEach(container => container.classList.add('hidden'));
    document.getElementById('step-greeting').classList.remove('hidden');
}


