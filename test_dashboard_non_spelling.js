'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright-core');

const missingKey = 'non-spelling:missing-word:pu3:4:54:m13';
const fixKey = 'non-spelling:find-fix:pu3:4:54:f5';
const missing = { id: 'M13', key: missingKey, book: 'PU3', unit: '4', page: '54',
    sentences: ["I didn't ___ the ball.", 'My sister ___ it.'], answers: ['throw', 'threw'], response: ['throw', 'threw'] };
const fix = { id: 'F5', key: fixKey, book: 'PU3', unit: '4', page: '54',
    sentences: ['I throwed the ball.'], answers: ['threw'], response: ['threw'] };
const state = (lastResult, interval = 2) => ({ interval, dueAfterSession: 104 + interval, lastSession: 104, lastResult });
const student = { id: 'student-fixture', fullName: 'Example Student', role: 'student', avatar: '🐱', teacher: 'Teacher',
    classTime: 'Sun 16:30', book: 'PU3', unit: '4', page: '54', sessionCount: 104,
    srState: { vocab: { climb: state('success') }, sentences: {
        [missingKey]: state('failure', 1), [fixKey]: state('success'),
        'non-spelling:missing-word:pu3:4:54:m5': state('failure', 1),
        'non-spelling:find-fix:pu3:4:54:f999': state('failure', 1),
        'she threw the ball well.': state('success') }, sentencePairs: {} },
    analytics: [
        { type: 'exercise', eventId: 'missing', exerciseType: 'missingWord', mode: 'game', attempts: 2, itemDetails: JSON.stringify(missing), timestamp: '2026-10-19T14:10:00Z' },
        { type: 'exercise', eventId: 'legacy', exerciseType: 'spelling', mode: 'game', attempts: 1, itemDetails: 'climb', timestamp: '2026-10-19T14:11:00Z' },
        { type: 'session', eventId: 'session', sessionType: 'gomoku', data: { totalTimeSec: 600, result: 'win' }, timestamp: '2026-10-19T14:15:00Z' }
    ] };
const archivedFix = { type: 'exercise', eventId: 'fix', exerciseType: 'findAndFix', mode: 'study', attempts: 1,
    itemDetails: fix, timestamp: '2026-10-19T14:09:00Z' };

(async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1388, height: 1000 } });
        const errors = [], mutations = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            localStorage.setItem('savedUsers', JSON.stringify([{ id: 'admin-test', name: 'Test admin', role: 'admin' }]));
            localStorage.setItem('activeUserId', 'admin-test');
        });
        await page.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            const send = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
            if (request.method() !== 'GET') { mutations.push(url.pathname); return route.abort(); }
            if (url.pathname.endsWith('/login')) return send({ id: 'admin-test', role: 'admin' });
            if (url.pathname.endsWith('/getStudents')) return send([student]);
            if (url.pathname.endsWith('/getStudentArchive')) return send([{ type: 'student_analytics_archive', events: [archivedFix] }]);
            if (url.pathname.endsWith('/classCalendar')) return send({ events: [] });
            if (url.pathname.endsWith('/app-config.json')) return send({ APP_API_KEY: '' });
            if (url.hostname !== 'dashboard.test') return route.abort();
            const file = path.join(__dirname, decodeURIComponent(url.pathname.slice(1)));
            if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
            return route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', body: fs.readFileSync(file) });
        });
        await page.goto('https://dashboard.test/teacher_dashboard.html');
        await page.locator('#studentsTableBody tr').filter({ hasText: 'Example Student' }).click();
        await page.getByRole('button', { name: 'Exercises', exact: true }).click();
        assert.match(await page.locator('#exercisesTableBody').innerText(), /Missing Words/);
        assert.match(await page.locator('#exercisesTableBody').innerText(), /Find and Fix/);
        assert.doesNotMatch(await page.locator('#exercisesTableBody').innerText(), /"sentences"|"answers"/);
        await page.locator('#filterExerciseType').selectOption('missingWord');
        assert.equal(await page.locator('#exercisesTableBody tr').count(), 1);
        assert.match(await page.locator('#exercisesTableBody').innerText(), /I didn't ___ the ball\./);
        assert.match(await page.locator('#exercisesTableBody').innerText(), /throw, threw/);
        await page.locator('#exercisesTableBody tr').click();
        assert.match(await page.locator('.sr-inline-popup').innerText(), /Missing Words/);
        assert.match(await page.locator('.sr-inline-popup').innerText(), /failure/);
        assert.match(await page.locator('.sr-inline-popup').innerText(), /105/);
        await page.locator('.sr-inline-popup .modal-close').click();
        await page.locator('#filterExerciseType').selectOption('findAndFix');
        await page.locator('#filterExerciseItem').fill('threw');
        assert.equal(await page.locator('#exercisesTableBody tr').count(), 1, 'object archive payload is searchable');
        await page.locator('#exercisesTableBody tr').click();
        assert.match(await page.locator('.sr-inline-popup').innerText(), /Find and Fix/);
        assert.match(await page.locator('.sr-inline-popup').innerText(), /success/);
        await page.locator('.sr-inline-popup .modal-close').click();
        await page.locator('#filterExerciseItem').fill('');
        await page.locator('#filterExerciseType').selectOption('');
        const out = path.join(os.tmpdir(), 'classroom-dashboard-non-spelling');
        fs.mkdirSync(out, { recursive: true });
        await page.screenshot({ path: path.join(out, 'exercises.png') });
        await page.getByRole('button', { name: 'SR State', exact: true }).click();
        await page.locator('#srCategoryFilter').selectOption('missingWord');
        assert.equal(await page.locator('#srTableBody tr').count(), 2, 'completed and failed-only boards are shown');
        await page.locator('#srItemSearch').fill('sister');
        assert.equal(await page.locator('#srTableBody tr').count(), 1, 'search uses readable event content');
        assert.match(await page.locator('#srTableBody').innerText(), /failure/);
        assert.equal(await page.locator('#srTableBody .sr-result-fail').count(), 1);
        await page.locator('#srItemSearch').fill('');
        assert.doesNotMatch(await page.locator('#srTableBody').innerText(), /non-spelling:/, 'failed-only board resolves from curriculum');
        await page.locator('#srCategoryFilter').selectOption('findAndFix');
        assert.equal(await page.locator('#srTableBody tr').count(), 2);
        assert.match(await page.locator('#srTableBody').innerText(), /F999/i, 'unknown catalog item retains a useful location and ID');
        await page.locator('#srCategoryFilter').selectOption('sentences');
        assert.equal(await page.locator('#srTableBody tr').count(), 1, 'legacy sentences stay separate from typed boards');
        await page.locator('#srCategoryFilter').selectOption('');
        assert.equal(await page.locator('#srTableBody tr').count(), 6, 'no SR entries are hidden or invented');
        await page.screenshot({ path: path.join(out, 'sr-state.png') });
        await page.getByRole('button', { name: 'Sessions', exact: true }).click();
        await page.locator('#sessionsTableBody tr').click();
        assert.match(await page.locator('#sessionExercisesBody').innerText(), /Missing Words/);
        assert.doesNotMatch(await page.locator('#sessionExercisesBody').innerText(), /"sentences"/);
        // Render hostile text as text; quoted payloads must not break SR click handlers.
        await page.evaluate(() => {
            const ex = { type: 'exercise', exerciseType: 'missingWord', itemDetails: { ...JSON.parse(currentStudent.analytics.find(e => e.exerciseType === 'missingWord').itemDetails), sentences: ['<img src=x onerror="window.__injected=true"> ___'], answers: ['safe'] } };
            window._allExercises = [ex]; applyExerciseFilters();
        });
        assert.equal(await page.locator('#exercisesTableBody img').count(), 0);
        assert.equal(await page.evaluate(() => !!window.__injected), false);
        assert.deepEqual(errors, []);
        assert.deepEqual(mutations, [], 'dashboard fixes never write student data');
        console.log('PASS: dashboard typed exercises, archived/object/JSON details, SR filters/search/popups, failed-only catalog lookup, escaping and legacy rows. Screenshots: ' + out);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
