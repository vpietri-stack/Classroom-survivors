// One-off: verify the VS survival clock FREEZES (not drains) during ESL
// minigames. Before the fix, a 100ms/tick deduction on top of the paused
// scene made the clock run BACKWARDS during questions.
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const p = await b.newPage({ viewport: { width: 800, height: 600 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2500);
    const r = await p.evaluate(async () => {
        const s = game.scene.getScene('MainScene');
        const out = {};
        const t0 = s.accumulatedTime;
        await new Promise(r2 => setTimeout(r2, 1200));
        out.accruedInPlayMs = Math.round(s.accumulatedTime - t0);
        // Open an ESL minigame the way the real flow does: triggerLevelUp/
        // showPowerUpSelection PAUSE the scene first, then startMiniGame runs
        s.scene.pause();
        startMiniGame('spelling', 'levelup');
        await new Promise(r2 => setTimeout(r2, 300));
        const t1 = s.accumulatedTime;
        await new Promise(r2 => setTimeout(r2, 1500));
        const t2 = s.accumulatedTime;
        out.deltaDuringMinigameMs = Math.round(t2 - t1); // MUST be 0 (was ~-1500)
        out.pausedDuringMinigame = s.scene.isPaused();
        claimReward(false); // close + resume
        await new Promise(r2 => setTimeout(r2, 700));
        const t3 = s.accumulatedTime;
        await new Promise(r2 => setTimeout(r2, 1200));
        out.accruedAfterResumeMs = Math.round(s.accumulatedTime - t3);
        return out;
    });
    console.log(JSON.stringify(r, null, 1));
    console.log('errs', JSON.stringify(errs));
    const ok = r.accruedInPlayMs > 800 && r.deltaDuringMinigameMs === 0 &&
        r.pausedDuringMinigame && r.accruedAfterResumeMs > 800 && errs.length === 0;
    console.log('RESULT', ok ? 'PASS' : 'FAIL');
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
