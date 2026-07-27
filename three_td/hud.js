// ============================================================
// SCHOOL DEFENSE 3D — hud.js
// Syncs game state to the DOM HUD (cheap: only writes on change).
// ============================================================

const el = id => document.getElementById(id);
const cache = {};
function setText(id, v) {
    if (cache[id] === v) return;
    cache[id] = v;
    el(id).textContent = v;
}

export function updateHUD(game) {
    setText('hudCoins', game.build.coins);
    setText('hudWave', Math.max(0, game.waves.waveNumber));
    setText('hudSchoolHp', game.schoolHp);
    setText('hudPlayerHp', Math.ceil(game.player.hp));
    setText('arrowCnt', game.player.arrows);

    el('hudSchool').classList.toggle('danger', game.schoolHp <= 9);

    // special cooldown radial (conic-gradient percentage)
    const pct = Math.round(game.player.specialCd / 45 * 100);
    el('btnSpecial').style.setProperty('--cd', pct + '%');
    el('btnSpecial').classList.toggle('disabled', pct > 0);
    el('btnBow').classList.toggle('disabled', game.player.arrows <= 0);
}

export function showWaveBanner(text, sub = '', ms = 2200) {
    const b = el('waveBanner');
    b.innerHTML = text + (sub ? `<div class="sub">${sub}</div>` : '');
    b.classList.add('show');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('show'), ms);
}

export function showSkipButton(show, seconds = 0) {
    const b = el('skipWaveBtn');
    b.style.display = show ? 'block' : 'none';
    if (show) setText('skipCount', Math.ceil(seconds));
}

export function showEnd(won, stats) {
    el('endTitle').textContent = won ? '🏆 Victory!' : '💀 School Overrun!';
    el('endTitle').style.color = won ? '#ffd75e' : '#ff6b6b';
    el('endStats').innerHTML = stats;
    el('endOverlay').classList.remove('hidden');
}
