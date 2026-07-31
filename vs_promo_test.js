// One-off: verify the VS promo is PER-USER (server-persisted) with a
// localStorage fallback for anonymous/test play.
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
    const b = await chromium.launch({ executablePath: CHROME, headless: true });
    const p = await b.newPage({ viewport: { width: 414, height: 896 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const posts = [];
    p.on('request', rq => { if (rq.url().includes('/updateStudent')) posts.push(rq.postData()); });
    await p.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
        const out = {};
        const shown = () => !document.getElementById('vsPromoBadge').classList.contains('hidden');
        // 1) Logged-in student, promo never seen (server field absent)
        localStorage.removeItem('vsPromoSeen');
        window.authActiveUser = { id: 'stu_123', fullName: 'Kid' };
        showGameSelection();
        out.loggedIn_first_shown = shown();
        out.loggedIn_flagSetInMemory = authActiveUser.vsPromoSeen === true;
        out.localStorageUntouched = localStorage.getItem('vsPromoSeen'); // should stay null
        // 2) Same session, second visit -> cleared
        showGameSelection();
        out.loggedIn_second_shown = shown();
        // 3) SAME user, DIFFERENT device: fresh object but server says seen:true, no localStorage
        window.authActiveUser = { id: 'stu_123', fullName: 'Kid', vsPromoSeen: true };
        localStorage.removeItem('vsPromoSeen');
        localStorage.removeItem('vsPromoSeen_stu_123');
        showGameSelection();
        out.otherDevice_shown = shown(); // should be false (follows the account)
        // 3b) SAME user, SAME device, NEW login that DROPPED the server flag
        // (regression guard: login used to rebuild the user without vsPromoSeen).
        // The per-user device mirror set in step 1 must still hide it.
        window.authActiveUser = { id: 'stu_promo_dev', fullName: 'Kid2' };
        localStorage.removeItem('vsPromoSeen'); localStorage.removeItem('vsPromoSeen_stu_promo_dev');
        showGameSelection(); out.dev_first_shown = shown();      // shows once, sets mirror
        window.authActiveUser = { id: 'stu_promo_dev', fullName: 'Kid2' }; // relogin, flag dropped
        showGameSelection(); out.dev_after_relogin_shown = shown(); // mirror -> hidden
        // 4) Anonymous / test: localStorage fallback
        window.authActiveUser = null;
        localStorage.removeItem('vsPromoSeen');
        showGameSelection();
        out.anon_first_shown = shown();
        out.anon_flag = localStorage.getItem('vsPromoSeen');
        showGameSelection();
        out.anon_second_shown = shown();
        return out;
    });
    await p.waitForTimeout(400);
    console.log(JSON.stringify(r, null, 1));
    console.log('updateStudent POSTs:', JSON.stringify(posts));
    console.log('errs', JSON.stringify(errs));
    const ok = r.loggedIn_first_shown && r.loggedIn_flagSetInMemory && r.localStorageUntouched === null &&
        !r.loggedIn_second_shown && !r.otherDevice_shown &&
        r.dev_first_shown && !r.dev_after_relogin_shown &&
        r.anon_first_shown && r.anon_flag === '1' && !r.anon_second_shown &&
        posts.some(pd => pd && pd.includes('vsPromoSeen')) && errs.length === 0;
    console.log('RESULT', ok ? 'PASS' : 'FAIL');
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
