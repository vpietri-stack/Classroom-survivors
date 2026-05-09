// ============================================================
// UNO CARD GAME - Classroom Survivors ESL Edition
// 4 players: 1 human (index 0) + 3 AI (indices 1-3)
// ============================================================

let unoGameActive = false;
let unoPlayers = [];
let unoDeck = [];
let unoDiscardPile = [];
let unoCurrentPlayer = 0;
let unoDirection = 1;
let unoPendingStack = 0;
let unoPendingStackType = null;
let unoStartTime = 0;
let unoAccumulatedTime = 0;
let unoWinner = null;
let unoESLContext = null;
let unoESLTimerStart = 0;
let unoESLTimedOut = false;
let unoESLTimerInterval = null;
let unoPlayerNames = ['You', 'Bot A', 'Bot B', 'Bot C'];
let unoSnapEnabled = false;
let unoIsProcessing = false;
let unoFreePlay = false; // after black card ESL success, human can play any card
let unoTurnTimer = null;
let unoVulnerable = [false, false, false, false];

const UNO_COLORS = ['red', 'yellow', 'green', 'blue'];
const UNO_AI_DELAY = 1200;
const UNO_ESL_TIME_LIMIT = 20000;

function createUnoDeck() {
    const d = [];
    UNO_COLORS.forEach(color => {
        d.push({ color, type: 'number', value: 0, id: color + '-0' });
        for (let n = 1; n <= 9; n++) {
            d.push({ color, type: 'number', value: n, id: color + '-' + n + 'a' });
            d.push({ color, type: 'number', value: n, id: color + '-' + n + 'b' });
        }
        ['skip', 'reverse', '+2'].forEach(t => {
            d.push({ color, type: t, value: null, id: color + '-' + t + 'a' });
            d.push({ color, type: t, value: null, id: color + '-' + t + 'b' });
        });
    });
    for (let i = 0; i < 4; i++) {
        d.push({ color: 'black', type: 'wild', value: null, id: 'wild' + i });
        d.push({ color: 'black', type: '+4', value: null, id: 'p4-' + i });
    }
    return d;
}

function shuffleArr(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function unoTopCard() { return unoDiscardPile[unoDiscardPile.length - 1]; }
function effColor(c) { return c.chosenColor || c.color; }

function cardMatchesTop(card, top) {
    if (card.color === 'black') return true;
    if (card.color === effColor(top)) return true;
    if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true;
    if (card.type !== 'number' && card.type === top.type) return true;
    return false;
}

function canPlay(card, top, stack, sType) {
    // Free play after black card ESL success: any card is allowed
    if (unoFreePlay && stack <= 0) return true;
    if (stack > 0) {
        // If the top card is already a reverse, you can't stack +2 or +4. Only re-reverse.
        if (top.type === 'reverse') {
            if (card.type !== 'reverse') return false;
            // Re-reverse on +2 must be same color. Re-reverse on +4 can be any color.
            if (sType === '+2') return card.color === effColor(top);
            if (sType === '+4') return true;
            return false;
        }

        // Normal stacking (top is +2 or +4)
        if (sType === '+2') {
            if (card.type === '+2') return true;
            if (card.type === 'reverse' && card.color === effColor(top)) return true;
            return false;
        }
        if (sType === '+4') {
            if (card.type === '+4') return true;
            if (card.type === 'reverse') return true;
            return false;
        }
    }
    return cardMatchesTop(card, top);
}

function exactSame(a, b) {
    return a.type === 'number' && b.type === 'number' && a.color === b.color && a.value === b.value;
}

function initUnoGame() {
    unoDeck = shuffleArr(createUnoDeck());
    unoDiscardPile = [];
    unoPlayers = [[], [], [], []];
    unoCurrentPlayer = 0;
    unoDirection = 1;
    unoPendingStack = 0;
    unoPendingStackType = null;
    unoWinner = null;
    unoSnapEnabled = false;
    unoIsProcessing = false;
    unoFreePlay = false;
    unoVulnerable = [false, false, false, false];
    for (let r = 0; r < 7; r++)
        for (let p = 0; p < 4; p++)
            unoPlayers[p].push(unoDeck.pop());
    let first = unoDeck.pop();
    while (first.color === 'black') { unoDeck.unshift(first); shuffleArr(unoDeck); first = unoDeck.pop(); }
    unoDiscardPile.push(first);
    if (first.type === 'skip') unoCurrentPlayer = 1;
    else if (first.type === 'reverse') { unoDirection = -1; unoCurrentPlayer = 3; }
    else if (first.type === '+2') { unoPendingStack = 2; unoPendingStackType = '+2'; }
    unoStartTime = Date.now();
    unoAccumulatedTime = 0;
    totalMinigameTimeMs = 0;
    unoGameActive = true;
}

function triggerUno() {
    activeGameMode = 'Uno';
    
    // Reset SR tracking for this game session
    if (typeof srGameResults !== 'undefined') srGameResults = [];
    if (typeof srInSessionFailures !== 'undefined') srInSessionFailures = new Set();
    if (typeof srInSessionSuccesses !== 'undefined') srInSessionSuccesses = new Set();
    
    ['startScreen', 'gameSelectionOverlay', 'gomokuScreen', 'gomokuGameOverScreen',
        'gomokuModeSelectionOverlay', 'gomokuDifficultySelectionOverlay',
        'gameOverScreen', 'gameIntroOverlay', 'studyModeOverlay', 'unoGameOverScreen'
    ].forEach(id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); });
    document.getElementById('unoScreen').classList.remove('hidden');
    document.getElementById('unoTensionOverlay').classList.add('hidden');
    initAudio();
    initUnoGame();
    renderUno();
    if (window.unoTimerInterval) clearInterval(window.unoTimerInterval);
    window.unoTimerInterval = setInterval(updateUnoTimer, 1000);
    unoTurnTimer = setTimeout(() => startUnoTurn(), 600);
}

function updateUnoTimer() {
    if (!unoGameActive) return;
    const s = Math.floor((unoAccumulatedTime + Date.now() - unoStartTime) / 1000);
    const el = document.getElementById('uno-timer');
    if (el) el.innerText = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function nextUP() { unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 4) % 4; }

function startUnoTurn() {
    if (!unoGameActive || unoWinner !== null) return;
    unoIsProcessing = false;
    const p = unoCurrentPlayer, hand = unoPlayers[p], top = unoTopCard();
    if (p === 0) {
        unoSnapEnabled = false;
        if (unoPendingStack > 0) {
            if (!hand.some(c => canPlay(c, top, unoPendingStack, unoPendingStackType))) {
                unoStatus('Stack: +' + unoPendingStack + '! You must click Draw.');
            } else {
                unoStatus('Stack: +' + unoPendingStack + '! Play a card.');
            }
        } else {
            if (!hand.some(c => canPlay(c, top, 0, null))) {
                unoStatus('No playable card! Click "I can\'t play".');
            } else {
                unoStatus('Your turn! Click a highlighted card.');
            }
        }
        renderUno();
    } else {
        unoSnapEnabled = true;
        unoStatus(unoPlayerNames[p] + "'s turn...");
        renderUno();
        unoTurnTimer = setTimeout(() => aiTurn(p), UNO_AI_DELAY);
    }
}

function humanPlay(idx) {
    if (!unoGameActive || unoIsProcessing || unoCurrentPlayer !== 0) return;
    const card = unoPlayers[0][idx], top = unoTopCard();
    if (!canPlay(card, top, unoPendingStack, unoPendingStackType)) { shakeUno(idx); return; }
    unoIsProcessing = true;
    unoFreePlay = false;
    resolveUnoVulnerabilities();

    // Animate play
    const els = document.querySelectorAll('#uno-player-hand .uno-card');
    if (els[idx]) {
        animatePlayBurst(els[idx], card);
        els[idx].style.opacity = '0';
    }

    setTimeout(() => {
        if (unoPendingStack > 0 && card.type === 'reverse') {
            unoPlayers[0].splice(idx, 1); unoDiscardPile.push(card);
            playUnoReverseSound();
            unoDirection *= -1;
            unoStatus('You reversed the +' + unoPendingStack + '!');
            if (unoCheckEnd(0)) return;
            renderUno(); nextUP(); unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY); return;
        }

        if (card.color === 'black') {
            unoPlayers[0].splice(idx, 1);
            if (card.type === '+4') { unoPendingStack += 4; unoPendingStackType = '+4'; }
            card.originalColor = 'black';
            execPlay(0, card);
            return;
        }

        unoPlayers[0].splice(idx, 1);
        execPlay(0, card);
    }, 250);
}

function execPlay(pi, card) {
    unoFreePlay = false;
    unoDiscardPile.push(card);
    if (card.type === '+2') { unoPendingStack += 2; unoPendingStackType = '+2'; }
    if (card.type === 'skip') { playUnoSkipSound(); nextUP(); }
    if (card.type === 'reverse') { playUnoReverseSound(); unoDirection *= -1; }
    if (unoCheckEnd(pi)) return;
    renderUno();

    // Wild cards trigger ESL immediately; +4 is handled via stack resolution
    if ((card.color === 'black' || card.originalColor === 'black') && card.type !== '+4') {
        tensionBlackCardESL();
        return;
    }

    nextUP(); unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY);
}

function unoCheckEnd(pi) {
    if (unoPlayers[pi].length === 1) {
        unoVulnerable[pi] = true;
        renderUno();
    }
    if (unoPlayers[pi].length === 0) {
        unoWinner = pi; renderUno(); unoTurnTimer = setTimeout(() => endUno(pi), 800); return true;
    }
    return false;
}

// Snap: play exact same card out of turn (number cards only)
function humanSnapCard(idx) {
    if (!unoGameActive || unoIsProcessing || unoCurrentPlayer === 0 || !unoSnapEnabled) return;
    const card = unoPlayers[0][idx];
    if (!exactSame(card, unoTopCard())) return;

    if (unoTurnTimer) clearTimeout(unoTurnTimer);

    unoIsProcessing = true; unoSnapEnabled = false;
    resolveUnoVulnerabilities();

    const els = document.querySelectorAll('#uno-player-hand .uno-card');
    if (els[idx]) {
        animatePlayBurst(els[idx], card);
        els[idx].style.opacity = '0';
    }

    setTimeout(() => {
        unoPlayers[0].splice(idx, 1);
        unoDiscardPile.push(card);
        unoStatus('SNAP! \uD83C\uDFAF');
        if (unoCheckEnd(0)) return;
        renderUno();
        unoCurrentPlayer = 0; nextUP();
        unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY);
    }, 250);
}

function unoDraw(pi, n) {
    if (n > 0) animateDrawBurst(pi, n);
    for (let i = 0; i < n; i++) {
        if (unoDeck.length === 0) {
            const t = unoDiscardPile.pop();
            unoDeck = shuffleArr([...unoDiscardPile]);
            unoDeck.forEach(c => { delete c.chosenColor; delete c.originalColor; });
            unoDiscardPile = [t];
        }
        if (unoDeck.length > 0) unoPlayers[pi].push(unoDeck.pop());
    }
}

function humanDrawPending() {
    if (!unoGameActive || unoIsProcessing || unoCurrentPlayer !== 0 || unoPendingStack <= 0) return;
    unoIsProcessing = true;
    resolveUnoVulnerabilities();
    const a = unoPendingStack;
    const wasPlus4 = unoPendingStackType === '+4';
    unoDraw(0, a); unoPendingStack = 0; unoPendingStackType = null;
    unoStatus('You drew ' + a + ' cards!');
    renderUno();
    if (wasPlus4) {
        // +4 is a black card: after drawing, trigger Tension ESL
        unoTurnTimer = setTimeout(() => tensionBlackCardESL(), 800);
    } else {
        nextUP(); unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY);
    }
}

function humanDeclareNoPlay() {
    if (!unoGameActive || unoIsProcessing || unoCurrentPlayer !== 0 || unoPendingStack > 0) return;
    const hand = unoPlayers[0], top = unoTopCard();
    if (hand.some(c => canPlay(c, top, 0, null))) return; // sanity check
    unoIsProcessing = true;
    resolveUnoVulnerabilities();
    unoStatus('Answering question...');
    triggerUnoESL('draw');
}

function aiTurn(pi) {
    if (!unoGameActive || unoWinner !== null) return;
    const hand = unoPlayers[pi], top = unoTopCard();

    // Stack resolution
    if (unoPendingStack > 0) {
        const opts = hand.map((c, i) => ({ c, i })).filter(({ c }) => canPlay(c, top, unoPendingStack, unoPendingStackType));
        if (opts.length > 0) {
            const pk = opts[0]; const card = pk.c;
            resolveUnoVulnerabilities();
            const arEl = document.getElementById('uno-ai-area-' + pi);
            if (arEl) animatePlayBurst(arEl, card);

            setTimeout(() => {
                hand.splice(pk.i, 1);
                if (card.type === 'reverse') {
                    unoDiscardPile.push(card); playUnoReverseSound();
                    unoDirection *= -1;
                    unoStatus(unoPlayerNames[pi] + ' reversed the +' + unoPendingStack + '!');
                } else {
                    if (card.color === 'black') { card.originalColor = 'black'; }
                    if (card.type === '+2') unoPendingStack += 2;
                    if (card.type === '+4') { unoPendingStack += 4; unoPendingStackType = '+4'; }
                    unoDiscardPile.push(card);
                    unoStatus(unoPlayerNames[pi] + ' stacked! +' + unoPendingStack);
                }
                if (unoCheckEnd(pi)) return;
                renderUno();
                if (card.originalColor === 'black' && card.type !== '+4') { tensionBlackCardESL(); return; }
                nextUP(); unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY);
            }, 250);
        } else {
            const wasPlus4 = unoPendingStackType === '+4';
            resolveUnoVulnerabilities();
            unoDraw(pi, unoPendingStack);
            unoStatus(unoPlayerNames[pi] + ' drew ' + unoPendingStack + ' cards!');
            unoPendingStack = 0; unoPendingStackType = null;
            renderUno();
            if (wasPlus4) {
                // +4 is a black card: after AI draws, trigger Tension ESL for human
                unoTurnTimer = setTimeout(() => tensionBlackCardESL(), 800);
            } else {
                nextUP(); unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY);
            }
        }
        return;
    }

    // Normal play
    const playable = hand.map((c, i) => ({ c, i })).filter(({ c }) => canPlay(c, top, 0, null));
    if (playable.length === 0) {
        resolveUnoVulnerabilities();
        unoDraw(pi, 1); unoStatus(unoPlayerNames[pi] + ' drew a card.');
        renderUno(); nextUP(); unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY); return;
    }

    const colM = playable.filter(({ c }) => c.color === effColor(top) && c.color !== 'black');
    const oth = playable.filter(({ c }) => c.color !== 'black' && c.color !== effColor(top));
    const wld = playable.filter(({ c }) => c.color === 'black');
    let pk;
    if (colM.length) pk = colM[Math.floor(Math.random() * colM.length)];
    else if (oth.length) pk = oth[Math.floor(Math.random() * oth.length)];
    else pk = wld[Math.floor(Math.random() * wld.length)];

    const card = pk.c;
    resolveUnoVulnerabilities();
    const arEl = document.getElementById('uno-ai-area-' + pi);
    if (arEl) animatePlayBurst(arEl, card);

    setTimeout(() => {
        hand.splice(pk.i, 1);
        if (card.color === 'black') { card.originalColor = 'black'; }
        if (card.type === '+2') { unoPendingStack += 2; unoPendingStackType = '+2'; }
        if (card.type === '+4') { unoPendingStack += 4; unoPendingStackType = '+4'; }
        unoDiscardPile.push(card);
        if (card.type === 'skip') { playUnoSkipSound(); nextUP(); }
        if (card.type === 'reverse') { playUnoReverseSound(); unoDirection *= -1; }
        unoStatus(unoPlayerNames[pi] + ' played a card.');
        if (unoCheckEnd(pi)) return;
        renderUno();
        if (card.originalColor === 'black' && card.type !== '+4') { tensionBlackCardESL(); return; }
        nextUP(); unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY);
    }, 250);
}

// --- TENSION ESL OVERLAY ---
function tensionBlackCardESL() {
    unoIsProcessing = true;
    unoSnapEnabled = false;
    document.getElementById('unoTensionOverlay').classList.remove('hidden');
    let count = 3;
    document.getElementById('unoTensionCountdown').innerText = count;

    // Tension audio
    osc('triangle', 300, 0.4, 0.3);
    setTimeout(() => osc('square', 250, 0.4, 0.4), 100);

    const iv = setInterval(() => {
        count--;
        if (count > 0) {
            document.getElementById('unoTensionCountdown').innerText = count;
            osc('triangle', 300 + (3 - count) * 50, 0.4, 0.2);
        } else {
            clearInterval(iv);
            document.getElementById('unoTensionOverlay').classList.add('hidden');
            osc('square', 600, 0.3, 0.4);
            triggerUnoESL('black');
        }
    }, 1000);
}

// --- ESL ---
function triggerUnoESL(ctx) {
    unoESLContext = ctx; unoESLTimedOut = false;
    unoESLTimerStart = Date.now();
    unoAccumulatedTime += (Date.now() - unoStartTime);
    unoSnapEnabled = false;
    document.getElementById('unoESLOverlay').classList.remove('hidden');
    updateUnoESLDisplay();
    if (unoESLTimerInterval) clearInterval(unoESLTimerInterval);
    unoESLTimerInterval = setInterval(updateUnoESLDisplay, 100);
    const types = ['spelling', 'wordrec', 'scramble', 'sentencematch'];
    startMiniGame(types[Math.floor(Math.random() * types.length)], 'uno');
}

function updateUnoESLDisplay() {
    const rem = Math.max(0, UNO_ESL_TIME_LIMIT - (Date.now() - unoESLTimerStart));
    const s = Math.ceil(rem / 1000);
    const el = document.getElementById('uno-esl-timer');
    if (el) { el.innerText = '\u23F1 ' + s + 's'; el.style.color = s <= 5 ? '#ef4444' : '#facc15'; }
    if (rem <= 0 && !unoESLTimedOut) unoESLTimedOut = true;
}

function completeUnoESLQuestion(success) {
    if (unoESLTimerInterval) { clearInterval(unoESLTimerInterval); unoESLTimerInterval = null; }
    document.getElementById('unoESLOverlay').classList.add('hidden');
    const timedOut = (Date.now() - unoESLTimerStart) > UNO_ESL_TIME_LIMIT;
    unoStartTime = Date.now();
    if (unoESLContext === 'draw') {
        // No playable card: correct in time = 1 card, too slow = 2 cards
        if (!timedOut) { unoDraw(0, 1); unoStatus('Correct in time! Drew 1 card.'); }
        else { unoDraw(0, 2); unoStatus('Too slow! Drew 2 cards.'); }
        renderUno(); nextUP(); unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY);
    } else {
        // Black card: correct in time = human free play, too slow = draw 1 + AI plays
        if (!timedOut) {
            unoFreePlay = true; // human can play ANY card
            unoStatus('Correct! Play any card!');
            unoCurrentPlayer = 0; renderUno(); unoTurnTimer = setTimeout(startUnoTurn, 500);
        } else {
            unoDraw(0, 1); unoStatus('Too slow! Drew 1 card.');
            unoFreePlay = true; // next player also gets free play
            unoCurrentPlayer = 0; nextUP(); renderUno(); unoTurnTimer = setTimeout(startUnoTurn, UNO_AI_DELAY);
        }
    }
}

function unoCallout(pi) {
    const el = document.getElementById('uno-callout');
    if (!el) return;
    el.innerText = unoPlayerNames[pi] + ': UNO! \uD83C\uDF89';
    el.classList.remove('hidden');
    el.style.animation = 'none'; el.offsetHeight; el.style.animation = '';
    osc('sine', 880, 0.3, 0.15);
    setTimeout(() => el.classList.add('hidden'), 2500);
}

function unoStatus(m) { const el = document.getElementById('uno-status'); if (el) el.innerText = m; }

function shakeUno(idx) {
    const cards = document.querySelectorAll('#uno-player-hand .uno-card');
    if (cards[idx]) { cards[idx].classList.add('shake'); synthError(); setTimeout(() => cards[idx].classList.remove('shake'), 400); }
}

// --- RENDERING ---
function renderUno() {
    renderUnoHand(); renderUnoDiscard(); renderUnoDeckN(); renderUnoAIs(); renderUnoInd();
}

function cSym(c) {
    if (c.type === 'number') return c.value;
    return { skip: '\u2298', reverse: '\u27F2', '+2': '+2', wild: '\u2605', '+4': '+4' }[c.type] || '?';
}

function cStyle(c) {
    const col = effColor(c);
    const m = {
        red: 'background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;',
        yellow: 'background:linear-gradient(135deg,#facc15,#eab308);color:#1a1a1a;',
        green: 'background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;',
        blue: 'background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;',
        black: 'background:linear-gradient(135deg,#374151,#111827);color:#fff;'
    };
    return m[col] || m.black;
}

function renderCard(c, cls, hnd) {
    const s = cSym(c);
    return '<div class="uno-card ' + cls + '" style="' + cStyle(c) + '" ' + hnd + '>' +
        '<span class="uno-tl">' + s + '</span><span class="uno-mid">' + s + '</span><span class="uno-br">' + s + '</span></div>';
}

function renderUnoHand() {
    const el = document.getElementById('uno-player-hand');
    if (!el) return;
    const hand = unoPlayers[0], top = unoTopCard(), my = unoCurrentPlayer === 0 && !unoIsProcessing;
    let h = '';
    hand.forEach((c, i) => {
        const ok = my && canPlay(c, top, unoPendingStack, unoPendingStackType);
        const snap = unoCurrentPlayer !== 0 && unoSnapEnabled && exactSame(c, top);
        let cls = '', fn = '';
        if (ok) { cls = 'uno-glow'; fn = 'onclick="humanPlay(' + i + ')"'; }
        else if (snap) { cls = 'uno-snap'; fn = 'onclick="humanSnapCard(' + i + ')"'; }
        h += renderCard(c, cls, fn);
    });
    if (my) {
        if (unoPendingStack > 0) {
            if (!hand.some(c => canPlay(c, top, unoPendingStack, unoPendingStackType))) {
                h += '<button class="uno-draw-btn bg-red-600 hover:bg-red-500" onclick="humanDrawPending()">Draw ' + unoPendingStack + ' \uD83D\uDCE5</button>';
            }
        } else {
            if (!hand.some(c => canPlay(c, top, 0, null))) {
                h += '<button class="uno-draw-btn bg-orange-600 hover:bg-orange-500" onclick="humanDeclareNoPlay()">I can\'t play \uD83D\uDEAB</button>';
            }
        }
    }
    if (unoVulnerable[0]) {
        h += `<button onclick="humanCallUno()" class="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-4xl px-12 py-6 rounded-full border-[6px] border-white animate-pulse shadow-[0_0_50px_rgba(250,204,21,1)] cursor-pointer pointer-events-auto">SAY UNO! 📣</button>`;
    }
    el.innerHTML = h;
}

function renderUnoDiscard() {
    const el = document.getElementById('uno-discard');
    if (!el || !unoDiscardPile.length) return;
    el.innerHTML = renderCard(unoTopCard(), 'uno-card-big', '');
}

function renderUnoDeckN() {
    const el = document.getElementById('uno-deck-count');
    if (el) el.innerText = unoDeck.length;
}

function renderUnoAIs() {
    for (let i = 1; i <= 3; i++) {
        const n = unoPlayers[i].length;
        const ne = document.getElementById('uno-ai-name-' + i);
        const ce = document.getElementById('uno-ai-count-' + i);
        const ca = document.getElementById('uno-ai-cards-' + i);
        const ar = document.getElementById('uno-ai-area-' + i);
        if (ne) {
            ne.innerHTML = unoPlayerNames[i];
            if (unoVulnerable[i]) {
                ne.innerHTML += ` <button onclick="humanCatchBot(${i})" class="ml-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase px-2 py-1 rounded border-2 border-white animate-bounce shadow-[0_0_15px_red] pointer-events-auto relative z-50">NO UNO!</button>`;
            }
        }
        if (ce) ce.innerText = n;
        if (ar) { if (i === unoCurrentPlayer) ar.classList.add('uno-active'); else ar.classList.remove('uno-active'); }
        if (ca) {
            let h = '';
            for (let j = 0; j < Math.min(n, 10); j++) h += '<div class="uno-card-back"></div>';
            if (n > 10) h += '<span class="text-xs text-gray-300 ml-1">+' + (n - 10) + '</span>';
            ca.innerHTML = h;
        }
    }
}

function renderUnoInd() {
    const d = document.getElementById('uno-direction');
    if (d) d.innerText = unoDirection === 1 ? '\uD83D\uDD04 \u2192' : '\uD83D\uDD04 \u2190';
    const s = document.getElementById('uno-stack');
    if (s) { if (unoPendingStack > 0) { s.innerText = '\u26A1 +' + unoPendingStack; s.classList.remove('hidden'); } else s.classList.add('hidden'); }
    const pa = document.getElementById('uno-player-area');
    if (pa) { if (unoCurrentPlayer === 0) pa.classList.add('uno-active'); else pa.classList.remove('uno-active'); }
}

function endUno(winner) {
    unoGameActive = false;
    if (window.unoTimerInterval) clearInterval(window.unoTimerInterval);
    unoAccumulatedTime += (Date.now() - unoStartTime);
    const t = document.getElementById('unoResultTitle'), m = document.getElementById('unoResultMsg');
    const nm = (typeof selectedStudent !== 'undefined' && selectedStudent) ? selectedStudent : 'Player';
    if (winner === 0) {
        t.innerText = 'You Won! \uD83C\uDF89'; t.className = 'text-4xl font-bold mb-4 text-green-400';
        m.innerText = 'Congratulations, ' + nm + '! You are an UNO Master!'; synthLevelUp();
    } else {
        t.innerText = 'Game Over'; t.className = 'text-4xl font-bold mb-4 text-red-500';
        m.innerText = unoPlayerNames[winner] + ' won. Better luck next time, ' + nm + '!'; synthDeath();
    }
    const f = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    const gs = Math.floor(unoAccumulatedTime / 1000), qs = Math.floor(totalMinigameTimeMs / 1000);
    document.getElementById('unoGameTime').innerText = f(gs);
    document.getElementById('unoQuestTime').innerText = f(qs);
    document.getElementById('unoTotalTime').innerText = f(gs + qs);

    // Track session analytics and finalize SR
    if (typeof srGameResults !== 'undefined') {
        finalizeSession(srGameResults);
    }
    queueSessionEvent('uno', {
        winner: winner,
        winnerName: winner === 0 ? nm : unoPlayerNames[winner],
        gameTimeSec: gs,
        questTimeSec: qs,
        totalTimeSec: gs + qs
    });
    flushAnalytics();

    document.getElementById('unoScreen').classList.add('hidden');
    document.getElementById('unoGameOverScreen').classList.remove('hidden');
}

// --- ANIMATION HELPERS ---
function animatePlayBurst(srcEl, card) {
    const destEl = document.getElementById('uno-discard');
    if (!srcEl || !destEl) return;
    const r1 = srcEl.getBoundingClientRect();
    const r2 = destEl.getBoundingClientRect();
    const clone = document.createElement('div');
    clone.innerHTML = renderCard(card, '', '');
    clone.className = 'fixed z-50 pointer-events-none ' + srcEl.className;
    clone.style.cssText = srcEl.style.cssText;
    clone.style.left = r1.left + 'px';
    clone.style.top = r1.top + 'px';
    clone.style.width = r1.width + 'px';
    clone.style.height = r1.height + 'px';
    clone.style.margin = '0';
    clone.style.transition = 'all 200ms ease-out';
    document.body.appendChild(clone);

    osc('sine', 500, 0.15, 0.1);

    requestAnimationFrame(() => {
        clone.style.left = r2.left + 'px';
        clone.style.top = r2.top + 'px';
        clone.style.width = r2.width + 'px';
        clone.style.height = r2.height + 'px';
        clone.style.transform = 'scale(1.1) rotate(' + (Math.random() * 30 - 15) + 'deg)';
    });

    setTimeout(() => clone.remove(), 250);
}

function animateDrawBurst(pi, amount) {
    const srcEl = document.getElementById('uno-deck-count');
    if (!srcEl) return;
    const parent = srcEl.parentElement;
    let destEl = pi === 0 ? document.getElementById('uno-player-area') : document.getElementById('uno-ai-area-' + pi);
    if (!destEl) return;
    const r1 = parent.getBoundingClientRect();
    const r2 = destEl.getBoundingClientRect();

    for (let i = 0; i < amount; i++) {
        setTimeout(() => {
            const clone = document.createElement('div');
            clone.className = 'fixed z-50 pointer-events-none uno-card-back';
            clone.style.left = r1.left + 'px';
            clone.style.top = r1.top + 'px';
            clone.style.width = '24px';
            clone.style.height = '36px';
            clone.style.transition = 'all 250ms ease-out';
            document.body.appendChild(clone);

            osc('sine', 600 + i * 50, 0.1, 0.1);

            requestAnimationFrame(() => {
                clone.style.left = (r2.left + r2.width / 2 - 12 + (Math.random() * 40 - 20)) + 'px';
                clone.style.top = (r2.top + r2.height / 2 - 18 + (Math.random() * 40 - 20)) + 'px';
                clone.style.opacity = '0';
                clone.style.transform = 'rotate(' + (Math.random() * 180 - 90) + 'deg)';
            });

            setTimeout(() => clone.remove(), 250);
        }, i * Math.max(20, Math.min(100, 200 / amount)));
    }
}

function playUnoSkipSound() {
    osc('sawtooth', 150, 0.3, 0.1);
    setTimeout(() => osc('sawtooth', 100, 0.3, 0.2), 100);
}

function playUnoReverseSound() {
    if (typeof audioCtx === 'undefined' || !audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(300, audioCtx.currentTime);
    o.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.15);
    o.frequency.linearRampToValueAtTime(300, audioCtx.currentTime + 0.3);
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.15);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.3);
}

function resolveUnoVulnerabilities() {
    if (unoVulnerable[0]) {
        unoVulnerable[0] = false;
        playUnoCatchSound();
        unoStatus('You forgot to say UNO! You drew 2 penalty cards!');
        unoDraw(0, 2);
    }
    for (let i = 1; i <= 3; i++) {
        if (unoVulnerable[i]) {
            unoVulnerable[i] = false;
        }
    }
}

function humanCallUno() {
    if (!unoVulnerable[0]) return;
    unoVulnerable[0] = false;
    playUnoSaySound();
    unoCallout(0);
    renderUno();
}

function humanCatchBot(pi) {
    if (!unoVulnerable[pi] || !unoGameActive) return;
    unoVulnerable[pi] = false;
    playUnoCatchSound();
    unoStatus('CAUGHT ' + unoPlayerNames[pi] + '! They drew 2 cards!');
    unoDraw(pi, 2);
    renderUno();
}

function playUnoCatchSound() {
    osc('square', 250, 0.4, 0.1);
    setTimeout(() => osc('sawtooth', 150, 0.5, 0.3), 100);
}

function playUnoSaySound() {
    osc('sine', 600, 0.2, 0.1);
    setTimeout(() => osc('sine', 800, 0.2, 0.2), 100);
}
