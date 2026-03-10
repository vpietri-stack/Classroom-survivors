// --- GOMOKU GAME DATA ---
let gomokuBoard = [];
const BOARD_SIZE = 15;
let gomokuCanvas, gomokuCtx;
let gomokuGameActive = false;
let gomokuTurn = 'player'; // 'player' or 'ai'
let gomokuStartTime = 0;
let gomokuAccumulatedTime = 0;
let lastGomokuMove = null;
let gomokuMode = 'regular';
let gomokuSpeedInterval = null;
const SPEED_AI_INTERVAL = 10000;
let gomokuNextAiTime = 0;

let isGomokuDragging = false;
let gomokuDragCell = null;
let dragInitialized = false;

// --- GOMOKU INITIALIZATION ---
function showGomokuModeSelection() {
    document.getElementById('gameSelectionOverlay').classList.add('hidden');
    document.getElementById('gomokuModeSelectionOverlay').classList.remove('hidden');
}

function triggerGomoku(mode = gomokuMode) {
    if (mode) gomokuMode = mode;
    activeGameMode = 'Gomoku';
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameSelectionOverlay').classList.add('hidden');
    document.getElementById('gomokuModeSelectionOverlay').classList.add('hidden');
    document.getElementById('gomokuGameOverScreen').classList.add('hidden');
    document.getElementById('gomokuScreen').classList.remove('hidden');

    initAudio();
    initGomokuBoard();

    if (gomokuSpeedInterval) clearInterval(gomokuSpeedInterval);

    gomokuCanvas = document.getElementById('gomokuCanvas');
    gomokuCtx = gomokuCanvas.getContext('2d');

    if (!dragInitialized) {
        initDragAndDrop();
        dragInitialized = true;
    }

    gomokuGameActive = true;
    gomokuTurn = 'player';
    gomokuAccumulatedTime = 0;
    totalMinigameTimeMs = 0;
    gomokuStartTime = Date.now();

    if (gomokuMode === 'speed') {
        updateGomokuStatus("Speed Mode! AI plays every 10s");
        gomokuNextAiTime = Date.now() + SPEED_AI_INTERVAL;
        gomokuSpeedInterval = setInterval(speedAiTurn, SPEED_AI_INTERVAL);
    } else {
        updateGomokuStatus("Your turn!");
    }

    drawGomokuBoard();

    if (window.gomokuTimerInterval) clearInterval(window.gomokuTimerInterval);
    window.gomokuTimerInterval = setInterval(updateGomokuTimer, 100);
}

function initGomokuBoard() {
    gomokuBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    lastGomokuMove = null;
}

function updateGomokuTimer() {
    if (!gomokuGameActive) return;
    const now = Date.now();
    let displayStr = "";

    if (gomokuMode === 'speed') {
        const timeLeftMs = Math.max(0, gomokuNextAiTime - now);
        const totalSec = Math.floor(timeLeftMs / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        const ms = Math.floor((timeLeftMs % 1000) / 10);
        displayStr = `AI Move: ${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}:${ms < 10 ? '0' + ms : ms}`;
    } else {
        if (gomokuTurn === 'minigame') {
            // While in minigame, just show the accumulated time
            const totalSec = Math.floor(gomokuAccumulatedTime / 1000);
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            displayStr = `Game: ${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
        } else {
            const totalSec = Math.floor((gomokuAccumulatedTime + (now - gomokuStartTime)) / 1000);
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            displayStr = `Game: ${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
        }
    }
    document.getElementById('gomoku-timer').innerText = displayStr;
}

function updateGomokuStatus(msg) {
    document.getElementById('gomoku-status').innerText = msg;
}

// --- RENDERING ---
function drawGomokuBoard() {
    const size = gomokuCanvas.width;
    const padding = 30;
    const cellSize = (size - padding * 2) / (BOARD_SIZE - 1);

    gomokuCtx.clearRect(0, 0, size, size);

    // Grid
    gomokuCtx.strokeStyle = '#5d2b06';
    gomokuCtx.lineWidth = 1;
    for (let i = 0; i < BOARD_SIZE; i++) {
        // Horizontal
        gomokuCtx.beginPath();
        gomokuCtx.moveTo(padding, padding + i * cellSize);
        gomokuCtx.lineTo(size - padding, padding + i * cellSize);
        gomokuCtx.stroke();

        // Vertical
        gomokuCtx.beginPath();
        gomokuCtx.moveTo(padding + i * cellSize, padding);
        gomokuCtx.lineTo(padding + i * cellSize, size - padding);
        gomokuCtx.stroke();
    }

    // Star points
    const stars = [3, 7, 11];
    gomokuCtx.fillStyle = '#5d2b06';
    stars.forEach(r => {
        stars.forEach(c => {
            gomokuCtx.beginPath();
            gomokuCtx.arc(padding + c * cellSize, padding + r * cellSize, 4, 0, Math.PI * 2);
            gomokuCtx.fill();
        });
    });

    // Pieces
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (gomokuBoard[r][c] !== 0) {
                drawPiece(r, c, gomokuBoard[r][c] === 1 ? 'black' : 'white');
            }
        }
    }

    // Drag Preview
    if (gomokuDragCell) {
        drawPiece(gomokuDragCell.r, gomokuDragCell.c, 'preview');
    }

    // Last move indicator
    if (lastGomokuMove) {
        const cellSize = (size - padding * 2) / (BOARD_SIZE - 1);
        gomokuCtx.strokeStyle = 'red';
        gomokuCtx.lineWidth = 2;
        gomokuCtx.beginPath();
        gomokuCtx.arc(padding + lastGomokuMove.c * cellSize, padding + lastGomokuMove.r * cellSize, cellSize * 0.4, 0, Math.PI * 2);
        gomokuCtx.stroke();
    }
}

function drawPiece(r, c, color) {
    const padding = 30;
    const cellSize = (gomokuCanvas.width - padding * 2) / (BOARD_SIZE - 1);
    const x = padding + c * cellSize;
    const y = padding + r * cellSize;

    gomokuCtx.shadowBlur = 4;
    gomokuCtx.shadowColor = 'rgba(0,0,0,0.5)';
    gomokuCtx.shadowOffsetY = 2;

    const grad = gomokuCtx.createRadialGradient(x - cellSize * 0.1, y - cellSize * 0.1, cellSize * 0.05, x, y, cellSize * 0.4);
    if (color === 'black') {
        grad.addColorStop(0, '#666');
        grad.addColorStop(1, '#000');
    } else if (color === 'preview') {
        gomokuCtx.globalAlpha = 0.4;
        grad.addColorStop(0, '#888');
        grad.addColorStop(1, '#222');
    } else {
        grad.addColorStop(0, '#fff');
        grad.addColorStop(1, '#ccc');
    }

    gomokuCtx.fillStyle = grad;
    gomokuCtx.beginPath();
    gomokuCtx.arc(x, y, cellSize * 0.4, 0, Math.PI * 2);
    gomokuCtx.fill();

    gomokuCtx.shadowBlur = 0;
    gomokuCtx.shadowOffsetY = 0;
    gomokuCtx.globalAlpha = 1.0;
}

// --- GAME LOGIC ---
function initDragAndDrop() {
    const stash = document.getElementById('gomoku-piece-stash');
    const ghost = document.getElementById('gomoku-ghost-piece');

    const startDrag = (e) => {
        if (!gomokuGameActive || (gomokuMode === 'regular' && gomokuTurn !== 'player')) return;
        if (gomokuTurn === 'minigame') return;

        isGomokuDragging = true;
        ghost.classList.remove('hidden');
        moveGhost(e);

        if (e.type === 'touchstart') e.preventDefault();
    };

    const moveGhost = (e) => {
        if (!isGomokuDragging) return;

        const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);

        if (clientX === undefined || clientY === undefined) return;

        ghost.style.left = (clientX - 20) + 'px';
        ghost.style.top = (clientY - 60) + 'px';

        const rect = gomokuCanvas.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            const scaleX = gomokuCanvas.width / rect.width;
            const scaleY = gomokuCanvas.height / rect.height;
            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            const padding = 30;
            const cellSize = (gomokuCanvas.width - padding * 2) / (BOARD_SIZE - 1);
            const c = Math.round((x - padding) / cellSize);
            const r = Math.round((y - padding) / cellSize);

            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gomokuBoard[r][c] === 0) {
                if (!gomokuDragCell || gomokuDragCell.r !== r || gomokuDragCell.c !== c) {
                    gomokuDragCell = { r, c };
                    drawGomokuBoard();
                }
            } else if (gomokuDragCell) {
                gomokuDragCell = null;
                drawGomokuBoard();
            }
        } else if (gomokuDragCell) {
            gomokuDragCell = null;
            drawGomokuBoard();
        }

        if (e.type === 'touchmove') e.preventDefault();
    };

    const endDrag = (e) => {
        if (!isGomokuDragging) return;
        isGomokuDragging = false;
        ghost.classList.add('hidden');

        if (gomokuDragCell) {
            const { r, c } = gomokuDragCell;
            handleMoveSelection(r, c);
            gomokuDragCell = null;
        }
        drawGomokuBoard();
    };

    stash.addEventListener('mousedown', startDrag);
    stash.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('mousemove', moveGhost);
    window.addEventListener('touchmove', moveGhost, { passive: false });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);
}

function handleGomokuClick(e) {
    if (!gomokuGameActive) return;
    if (gomokuMode === 'regular' && gomokuTurn !== 'player') return;
    if (gomokuMode === 'speed' && gomokuTurn === 'minigame') return;

    if (e.type === 'touchstart') e.preventDefault();

    const rect = gomokuCanvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);

    if (clientX === undefined || clientY === undefined) return;

    const scaleX = gomokuCanvas.width / rect.width;
    const scaleY = gomokuCanvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const padding = 30;
    const cellSize = (gomokuCanvas.width - padding * 2) / (BOARD_SIZE - 1);
    const c = Math.round((x - padding) / cellSize);
    const r = Math.round((y - padding) / cellSize);

    handleMoveSelection(r, c);
}

function handleMoveSelection(r, c) {
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gomokuBoard[r][c] === 0) {
        pendingGomokuMove = { r, c };

        if (gomokuMode === 'speed') {
            gomokuBoard[r][c] = 1;
            lastGomokuMove = { r, c };
            drawGomokuBoard();
            osc('sine', 400, 0.1, 0.1);

            if (checkWin(r, c, 1)) {
                endGomokuGame('win');
                return;
            }
        }
        showGomokuMiniGame();
    }
}

let pendingGomokuMove = null;

function showGomokuMiniGame() {
    gomokuTurn = 'minigame';
    gomokuAccumulatedTime += (Date.now() - gomokuStartTime);

    const types = ['spelling', 'wordrec', 'scramble', 'sentencematch'];
    const type = types[Math.floor(Math.random() * types.length)];
    startMiniGame(type, 'gomoku');
}

function completeGomokuMove(success) {
    if (!success) {
        gomokuTurn = 'player';
        gomokuStartTime = Date.now();
        updateGomokuStatus("Wrong! Try again.");
        return;
    }

    const { r, c } = pendingGomokuMove;

    if (gomokuMode !== 'speed') {
        // Only place here for regular mode
        gomokuBoard[r][c] = 1; // Player is Black
        lastGomokuMove = { r, c };
        drawGomokuBoard();
        osc('sine', 400, 0.1, 0.1);

        if (checkWin(r, c, 1)) {
            endGomokuGame('win');
            return;
        }
    }

    if (gomokuMode === 'speed') {
        gomokuTurn = 'player';
        updateGomokuStatus("Go! Go! Go!");
        gomokuStartTime = Date.now();
    } else {
        gomokuTurn = 'ai';
        updateGomokuStatus("Computer thinking...");
        setTimeout(aiTurn, 600);
    }
}

function speedAiTurn() {
    if (!gomokuGameActive) return;

    // Reset timer for next move
    gomokuNextAiTime = Date.now() + SPEED_AI_INTERVAL;

    const move = findBestMove(true);
    if (move) {
        gomokuBoard[move.r][move.c] = 2; // AI is White
        lastGomokuMove = move;
        drawGomokuBoard();
        osc('sine', 300, 0.1, 0.1);

        if (checkWin(move.r, move.c, 2)) {
            endGomokuGame('loss');
        }
    }
}

function aiTurn() {
    if (!gomokuGameActive) return;

    const move = findBestMove();
    if (move) {
        gomokuBoard[move.r][move.c] = 2; // AI is White
        lastGomokuMove = move;
        drawGomokuBoard();
        osc('sine', 300, 0.1, 0.1);

        if (checkWin(move.r, move.c, 2)) {
            endGomokuGame('loss');
            return;
        }
    }

    gomokuTurn = 'player';
    updateGomokuStatus("Your turn!");
    gomokuStartTime = Date.now();
}

function checkWin(r, c, p) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let [dr, dc] of dirs) {
        let count = 1;
        // Check forward
        let i = 1;
        while (r + dr * i >= 0 && r + dr * i < BOARD_SIZE && c + dc * i >= 0 && c + dc * i < BOARD_SIZE && gomokuBoard[r + dr * i][c + dc * i] === p) {
            count++; i++;
        }
        // Check backward
        i = 1;
        while (r - dr * i >= 0 && r - dr * i < BOARD_SIZE && c - dc * i >= 0 && c - dc * i < BOARD_SIZE && gomokuBoard[r - dr * i][c - dc * i] === p) {
            count++; i++;
        }
        if (count >= 5) return true;
    }
    return false;
}

// --- AI (PATTERN GRADER) ---
function findBestMove(perfect = false) {
    let allMoves = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (gomokuBoard[r][c] === 0) {
                if (hasNeighbor(r, c)) {
                    const score = evaluatePosition(r, c);
                    allMoves.push({ r, c, score });
                }
            }
        }
    }

    if (allMoves.length === 0) {
        // If board is empty, play center
        if (gomokuBoard[7][7] === 0) return { r: 7, c: 7 };
        for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (gomokuBoard[r][c] === 0) return { r, c };
    }

    // Sort moves from highest score to lowest
    allMoves.sort((a, b) => b.score - a.score);

    // If there is an immediate critical move (winning, or blocking a 4-in-a-row)
    // ALWAYS take it. A score >= 2000 represents at least a blocked/taken 4-in-a-row.
    if (perfect || allMoves[0].score >= 2000) {
        return allMoves[0];
    }

    // AI Difficulty adjustment for students:
    // Sorts all moves and probabilistically picks one so it's not a chess-level computer
    const rand = Math.random();
    if (rand < 0.5) {
        // 50% chance: play the absolute best move
        return allMoves[0];
    } else if (rand < 0.8) {
        // 30% chance: pick from the top 3 best moves (might miss a critical block!)
        const idx = Math.floor(Math.random() * Math.min(3, allMoves.length));
        return allMoves[idx];
    } else {
        // 20% chance: Bigger blunder! Pick a random move from the top 8 (gives students big openings)
        const idx = Math.floor(Math.random() * Math.min(8, allMoves.length));
        return allMoves[idx];
    }
}

function hasNeighbor(r, c) {
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && gomokuBoard[nr][nc] !== 0) return true;
        }
    }
    return false;
}

function evaluatePosition(r, c) {
    // Scores for different patterns
    const attackScore = getScoreForPlayer(r, c, 2); // AI
    const defenseScore = getScoreForPlayer(r, c, 1); // Player

    // Base score: Prioritize winning over blocking, but blocking 4 over attacking 3
    let score = attackScore + defenseScore * 1.1; // Slightly favor defense

    return score;
}

function getScoreForPlayer(r, c, p) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    let totalScore = 0;

    for (let [dr, dc] of dirs) {
        let line = [];
        for (let i = -4; i <= 4; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                if (i === 0) line.push(p);
                else line.push(gomokuBoard[nr][nc]);
            } else {
                line.push(-1); // Wall
            }
        }
        totalScore += scoreLine(line, p);
    }
    return totalScore;
}

function scoreLine(line, p) {
    const s = line.map(v => v === p ? 'X' : (v === 0 ? 'O' : '#')).join('');

    let score = 0;
    if (s.includes('XXXXX')) score += 100000;
    if (s.includes('OXXXXO')) score += 10000;
    if (s.includes('#XXXXO') || s.includes('OXXXX#')) score += 2000;
    if (s.includes('OXXXO')) score += 1000;
    if (s.includes('OXXOXO') || s.includes('OXOXXO')) score += 800;
    if (s.includes('#XXXO') || s.includes('OXXX#')) score += 200;
    if (s.includes('OOXXOO')) score += 100;

    return score;
}

// --- GAME OVER ---
function endGomokuGame(result) {
    gomokuGameActive = false;
    clearInterval(window.gomokuTimerInterval);
    if (gomokuSpeedInterval) clearInterval(gomokuSpeedInterval);

    if (gomokuTurn !== 'minigame') {
        gomokuAccumulatedTime += (Date.now() - gomokuStartTime);
    }

    const title = document.getElementById('gomokuResultTitle');
    const msg = document.getElementById('gomokuResultMsg');

    const studentName = typeof selectedStudent !== 'undefined' && selectedStudent ? selectedStudent : 'Player';

    if (result === 'win') {
        title.innerText = "You Won!";
        title.className = "text-4xl font-bold mb-4 text-green-400";
        msg.innerText = `Congratulations, ${studentName}! You are a 5 in a row Master.`;
        synthLevelUp();
    } else {
        title.innerText = "Game Over";
        title.className = "text-4xl font-bold mb-4 text-red-500";
        msg.innerText = `Better luck next time, ${studentName}! The computer won this round.`;
        synthDeath();
    }

    const gameTimeSec = Math.floor(gomokuAccumulatedTime / 1000);
    const questTimeSec = Math.floor(totalMinigameTimeMs / 1000);
    const totalTimeSec = gameTimeSec + questTimeSec;

    const format = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    document.getElementById('gomokuGameTime').innerText = format(gameTimeSec);
    document.getElementById('gomokuQuestTime').innerText = format(questTimeSec);
    document.getElementById('gomokuTotalTime').innerText = format(totalTimeSec);

    document.getElementById('gomokuGameOverScreen').classList.remove('hidden');
}

