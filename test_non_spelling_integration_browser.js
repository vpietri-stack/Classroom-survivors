'use strict';
const assert = require('assert/strict');
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const url = pathToFileURL(path.join(__dirname, 'index.html')).href + '?testMode=true&studentBook=PU3&studentUnit=9&studentPage=109';
let assertions = 0;
function ok(value, description) { assert.ok(value, description); assertions++; console.log('PASS: ' + description); }
async function click(page, selector) { await page.locator(selector).click(); }
async function type(page, text) { for (const letter of text) await click(page, '[data-letter="' + letter + '"]'); }
async function fillMissing(page, answers) {
    for (let i = 0; i < answers.length; i++) { await click(page, '[data-box="' + i + '"]'); await type(page, answers[i]); }
}
async function fillFix(page, index, text) {
    await click(page, '[data-word="' + index + '"]'); await click(page, '#bin'); await type(page, text);
}
async function waitBoard(page, index) { await page.waitForFunction(i => STUDY_STATE.currentNonSpellingIndex === i, index); }
(async () => {
    const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true,
        args: ['--allow-file-access-from-files', '--disable-web-security'] });
    const errors = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1102, height: 892 } });
        // No test traffic may reach either live or preview services/model hosts.
        await page.route(/^https?:/, route => route.abort());
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
        await page.waitForFunction(() => window.NonSpellingFlow && window.NonSpellingWidget);
        await page.evaluate(() => {
            window.playTTS = () => {}; window.synthError = () => {}; window.playHappySound = () => {};
            window.SpeechStatus = { isReady: () => false };
            window.__savedRequests = [];
            apiFetch = async (url, options = {}) => {
                const body = options.body ? JSON.parse(options.body) : {};
                window.__savedRequests.push(body);
                return { ok: true, status: 200, json: async () => ({ success: true, addedEventIds: (body.events || []).map(e => e.eventId), duplicateEventIds: [], srSeq: body.srSeq }) };
            };
            authActiveUser = { id: 'non-spelling-test', role: 'student', sessionCount: 3, srState: { vocab: {}, sentences: {}, sentencePairs: {} }, targets: [] };
            isTestMode = false;
            selectedClassContent = { book: 'PU3', unit: '9', page: '109' };
            selectedStudent = 'Preview Test';
            initStudyMode();
            window.__initialTypes = STUDY_STATE.nonSpellingExercises.map(e => e.type);
            const pool = NonSpellingContent.buildPool('PU3', '9', '109').entries.map(e => e.item);
            window.__fixtureBoards = [pool.find(e => e.id === 'M1'), pool.find(e => e.id === 'F1'), pool.find(e => e.type === 'sentence-scramble'), pool.find(e => e.type === 'sentence-match'), pool.find(e => e.id === 'M2')];
            STUDY_STATE.nonSpellingExercises = window.__fixtureBoards;
            startRoundE();
        });
        ok(await page.evaluate(() => STUDY_STATE.words.length === 5 && new Set(window.__initialTypes).size >= 3), 'real Study init keeps five vocabulary words and selects a varied Round D');
        ok(await page.locator('#study-progress-indicator > *').count() === 4, 'mixed Study uses four progress markers');
        await click(page, '#check');
        ok(await page.evaluate(() => srStudyResults.length === 0), 'empty checks do not record SR outcomes');
        await fillMissing(page, ['after', 'before']); await click(page, '#check');
        ok(await page.evaluate(() => srStudyResults[0].firstAttempt === false), 'first submitted mistake immediately records an SR failure');
        await page.waitForTimeout(3100);
        ok(await page.evaluate(() => NonSpellingWidget.getState().input.every(value => value === '')), 'wrong missing-word board resets all blanks in the real app');
        await fillMissing(page, ['before', 'after']); await click(page, '#check');
        await waitBoard(page, 1);
        ok(await page.evaluate(() => srStudyResults.length === 1 && !srStudyResults[0].firstAttempt), 'retry success keeps the original failure without duplicate SR records');
        await fillFix(page, 0, 'before'); await click(page, '#check');
        ok(await page.locator('#bin.word-wrong').count() === 1 && await page.locator('.nse-answer.spelling-correct').count() === 1, 'real find/fix separates word-selection and spelling results');
        await click(page, '#clear'); await fillFix(page, 4, 'befor'); await click(page, '#check');
        await page.waitForTimeout(950);
        ok(!(await page.locator('#bin-label').isVisible()) && await page.locator('.letter.wrong').count() === 1, 'bin celebration remains independent when replacement spelling is wrong');
        await click(page, '#clear'); await fillFix(page, 4, 'before'); await click(page, '#check');
        await waitBoard(page, 2);
        const sentence = await page.evaluate(() => STUDY_STATE.sentences[0]);
        for (const word of (Array.isArray(sentence) ? sentence[0] : sentence).split(' ')) {
            await page.locator('#sentence-word-bank .study-word-tile').filter({ hasText: new RegExp('^' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
        }
        await page.evaluate(() => checkRoundE()); await waitBoard(page, 3);
        ok(await page.locator('.sentence-b-slot').count() === 3, 'one mixed matching board has three pairs');
        for (let i = 0; i < 3; i++) {
            await click(page, '.sentence-b-tile[data-correct-index="' + i + '"]');
            await click(page, '.sentence-b-slot[data-target-index="' + i + '"]');
        }
        await page.evaluate(() => checkRoundF()); await waitBoard(page, 4);
        ok(await page.evaluate(() => srStudyResults.filter(e => e.type === 'sentencePairs').length === 3), 'matching counts as one board while retaining three independent pair results');
        await fillMissing(page, ['before', 'after']); await click(page, '#check');
        await page.waitForFunction(() => STUDY_STATE.srFinalized && document.getElementById('study-title').textContent === 'Session Complete');
        ok(await page.evaluate(() => STUDY_STATE.currentNonSpellingIndex === 5), 'five mixed boards complete Study without a separate matching round');
        ok(await page.evaluate(() => authActiveUser.srState.sentences[window.__fixtureBoards[0].key].lastResult === 'failure'), 'completion stores the new exercise SR failure through the real finalizer');
        ok(await page.evaluate(() => window.__savedRequests.some(body => body.srDelta && body.srState.sentences[window.__fixtureBoards[0].key])), 'new exercise outcomes ride the existing SR delta wire payload');
        // Observe a failure, leave Study, and prove that a later widget cannot be reset by the old timer.
        await page.evaluate(() => { initStudyMode(); STUDY_STATE.nonSpellingExercises = [window.__fixtureBoards[0]]; startRoundE(); });
        await fillMissing(page, ['after', 'before']); await click(page, '#check');
        const sessionsBefore = await page.evaluate(() => authActiveUser.sessionCount);
        await page.evaluate(() => exitStudyMode());
        ok(await page.evaluate(() => !NonSpellingWidget.isActive() && authActiveUser.srState.sentences[window.__fixtureBoards[0].key].lastResult === 'failure'), 'exit cancels the widget and keeps observed failure progress');
        ok(await page.evaluate(() => authActiveUser.sessionCount) === sessionsBefore, 'partial Study does not advance the session counter');
        await page.evaluate(() => { initStudyMode(); STUDY_STATE.nonSpellingExercises = [window.__fixtureBoards[0]]; startRoundE(); });
        await type(page, 'b'); await page.waitForTimeout(3100);
        ok(await page.evaluate(() => NonSpellingWidget.getState().input[0] === 'b'), 'old reveal timers cannot clear a new Study draft');
        await page.evaluate(() => {
            exitStudyMode();
            window.__rewards = [];
            completeGomokuMove = success => window.__rewards.push(success);
            window.__forcePilot = id => {
                srInSessionFailures.clear(); srInSessionSuccesses.clear();
                const srState = { vocab: {}, sentences: {}, sentencePairs: {} };
                const entries = NonSpellingContent.buildPool('PU3', '9', '109').entries;
                for (const e of entries) {
                    for (const key of e.item.pairs ? e.item.pairs.map(itemKey) : [e.key]) srState[e.item.srType][key] = { dueAfterSession: 999, lastResult: 'success' };
                }
                const chosen = entries.find(e => e.item.id === id).item;
                srState.sentences[chosen.key] = { dueAfterSession: 0, lastResult: 'failure' };
                authActiveUser.srState = srState;
                startMiniGame('scramble', 'gomoku');
            };
            window.__forcePilot('M1');
        });
        ok(await page.locator('#grammarGame.nse-typed').isVisible(), 'normal game challenge dispatch selects a new typed exercise');
        await fillMissing(page, ['before', 'after']); await click(page, '#check');
        ok(await page.locator('#next').textContent() === 'CONTINUE!', 'Gomoku uses its normal continue action');
        await page.locator('#next').click({ force: true });
        ok(await page.evaluate(() => window.__rewards.length === 1 && window.__rewards[0] && !NonSpellingWidget.isActive()), 'typed success reaches the real claimReward bridge and cleans up the widget');
        await page.setViewportSize({ width: 319, height: 892 });
        await page.evaluate(() => { document.body.classList.add('kid-friendly'); window.__forcePilot('F1'); });
        await fillFix(page, 0, 'before'); await click(page, '#check');
        ok(!(await page.locator('#result-action').isVisible()), 'a wrong game answer does not offer a reward');
        await click(page, '#clear'); await fillFix(page, 4, 'before'); await click(page, '#check');
        ok(await page.evaluate(() => srGameResults.some(e => e.key.includes(':f1') && !e.firstAttempt)), 'game retry preserves its first failed SR result');
        const screenshots = path.join(os.tmpdir(), 'classroom-non-spelling-integrated'); fs.mkdirSync(screenshots, { recursive: true });
        await page.waitForTimeout(950); await page.screenshot({ path: path.join(screenshots, 'phone-game-fix.png'), fullPage: true });
        ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'real app typed challenge fits a 319px phone');
        await page.locator('#next').click({ force: true });
        ok(await page.evaluate(() => window.__rewards.length === 2 && !document.getElementById('exercise-widget')), 'second typed challenge resumes the game without leaking controls');
        await page.evaluate(() => { startGrammarGame('I washed my hands before I ate lunch.'); });
        ok(await page.locator('#sentence-container').isVisible() && await page.locator('#grammar-actions').isVisible(), 'legacy grammar UI is restored after typed challenges');
        const approved = await page.evaluate(() => {
            const items = TEACHING_CONTENT.PU3['1']['16'].nonSpellingExercises.filter(e => e.id);
            const host = document.querySelector('#grammarGame .minigame-container');
            host.replaceChildren();
            document.getElementById('grammarGame').classList.add('nse-typed');
            return items;
        });
        for (const item of approved) {
            await page.evaluate(item => {
                NonSpellingWidget.mount(document.querySelector('#grammarGame .minigame-container'), item, { presentation: 'game', onCheck() {}, onNext() {} });
            }, item);
            const enter = async answer => {
                // Exercise both physical typing and the on-screen apostrophe key.
                if (item.id === 'M20' || item.id === 'F21') await type(page, answer);
                else await page.keyboard.type(answer);
            };
            if (item.answers) {
                for (const [index, answer] of item.answers.entries()) {
                    await click(page, '[data-box="' + index + '"]');
                    await enter(answer);
                }
            } else {
                const index = item.sentence.split(' ').findIndex(word => word.replace(/[.,!?]+$/, '').toLowerCase() === item.wrongWord);
                await click(page, '[data-word="' + index + '"]');
                await click(page, '#bin');
                await enter(item.answer);
            }
            await click(page, '#check');
            ok(await page.evaluate(() => NonSpellingWidget.getState().solved), 'approved Unit 1 ' + item.id + ' solves through the real widget');
            ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Unit 1 ' + item.id + ' fits the 319px phone');
        }
        await page.evaluate(item => {
            NonSpellingWidget.mount(document.querySelector('#grammarGame .minigame-container'), item, { presentation: 'game', onCheck() {}, onNext() {} });
        }, approved.find(e => e.id === 'M19'));
        await click(page, '[data-box="0"]');
        await page.keyboard.type('couldn');
        await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '’', bubbles: true })));
        await page.keyboard.type('t');
        ok(await page.evaluate(() => NonSpellingWidget.getState().input[0] === "couldn't"), 'smart apostrophe input uses the same contracted answer as the on-screen keyboard');
        await page.evaluate(() => NonSpellingWidget.destroy());
        ok(errors.length === 0, 'no real-app browser script errors: ' + errors.join('; '));
        console.log(assertions + ' real-app integration checks passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
