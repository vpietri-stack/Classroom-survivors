// Reproduce the REAL promo lifecycle across a full menu->play->exit->menu cycle
// using a logged-in-style user (testMode gives authActiveUser.id='test-mode').
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const p = await b.newPage({ viewport: { width: 414, height: 896 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    // testMode=true => authActiveUser={id:'test-mode',...}; skips real login
    await p.goto('http://localhost:8080/index.html?testMode=true&studentName=test1', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const shown = () => p.evaluate(() => !document.getElementById('vsPromoBadge').classList.contains('hidden'));

    const s0 = await p.evaluate(() => {
        return { hasUser: typeof authActiveUser !== 'undefined' && !!authActiveUser, id: (typeof authActiveUser !== 'undefined' && authActiveUser) ? authActiveUser.id : null, isTest: (typeof isTestMode !== 'undefined') ? isTestMode : 'n/a' };
    });
    console.log('user state:', JSON.stringify(s0));

    // 1) First menu view
    await p.evaluate(() => showGameSelection());
    await p.waitForTimeout(200);
    const first = await shown();
    const flag1 = await p.evaluate(() => ({ mem: authActiveUser.vsPromoSeen, ls: localStorage.getItem('vsPromoSeen') }));
    console.log('after 1st showGameSelection: shown=', first, 'flags=', JSON.stringify(flag1));

    // 2) Enter VS then exit back to menu (the real wired return path)
    await p.evaluate(() => triggerVampireSurvivors());
    await p.waitForTimeout(2000);
    await p.evaluate(() => { if (typeof exitVampireSurvivors === 'function') exitVampireSurvivors(); });
    await p.waitForTimeout(400);
    const afterExit = await shown();
    const flag2 = await p.evaluate(() => ({ mem: (authActiveUser||{}).vsPromoSeen, ls: localStorage.getItem('vsPromoSeen'), sameUserId: (authActiveUser||{}).id }));
    console.log('after VS->exit->menu: shown=', afterExit, 'flags=', JSON.stringify(flag2));

    // 3) Explicit showGameSelection again
    await p.evaluate(() => showGameSelection());
    await p.waitForTimeout(200);
    const third = await shown();
    console.log('after 2nd showGameSelection: shown=', third);

    console.log('errs', JSON.stringify(errs));
    const ok = first === true && afterExit === false && third === false;
    console.log('RESULT', ok ? 'PASS (hides after first)' : 'FAIL (promo persists)');
    await b.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
