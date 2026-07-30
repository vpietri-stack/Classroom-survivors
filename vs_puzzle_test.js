// One-off: verify walking-puzzle magnet (prefer correct box in overlap) + undo-last tap.
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const p = await b.newPage({ viewport: { width: 800, height: 600 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
        const s = game.scene.getScene('MainScene');
        const out = {};
        // Build a puzzle object directly (pickPuzzleContent needs class vocab)
        s.puzzle = { reward: { id: 'heart', type: 'special' }, item: { text: 'ab', mode: 'word', tokens: ['a', 'b'] }, attempt: [], boxes: [] };
        // Wrong box 'b' slightly CLOSER than correct 'a' — magnet should still
        // prefer the correct 'a' because both are in range this frame.
        const wrong = s.createPuzzleBox('b', s.player.x + 40, s.player.y);
        const correct = s.createPuzzleBox('a', s.player.x - 52, s.player.y);
        s.puzzle.boxes = [wrong, correct];
        s.updatePuzzle();
        out.firstPicked = s.puzzle.attempt.map(x => x.tokenValue);
        // Undo the single collected box (partial dock, not yet validating)
        s.onTrackerTap();
        out.afterUndo1 = s.puzzle.attempt.map(x => x.tokenValue);
        out.correctBackHome = !correct.used && Math.round(correct.x) === Math.round(s.player.x - 52);
        // Tap again on the empty dock (should just be a no-op for the attempt)
        s.onTrackerTap();
        out.afterUndo2 = s.puzzle.attempt.map(x => x.tokenValue);
        return out;
    });
    await b.close();
    console.log(JSON.stringify({ r, errs }, null, 1));
    process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
