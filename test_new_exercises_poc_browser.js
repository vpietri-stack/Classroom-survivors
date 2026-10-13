'use strict';
const assert = require('assert/strict');
const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const url = process.argv[2] || pathToFileURL(path.join(__dirname, 'new_exercises_poc.html')).href;
const screenshots = path.join(os.tmpdir(), 'classroom-new-exercises-poc');
let assertions = 0;
function ok(condition, text) { assert.ok(condition, text); assertions++; console.log('PASS: ' + text); }
async function state(page) { return page.evaluate(() => window.ExercisePOC.getState()); }
async function session(page) { return page.evaluate(() => window.ExercisePOC.getSession()); }
async function advance(page, touch = false) {
  const before = await state(page);
  const exercise = (await session(page))[before.cursor];
  if (exercise.presentation === 'study') {
    await page.waitForFunction(index => window.ExercisePOC.getState().cursor > index, before.cursor);
  } else if (touch) await page.locator('#next').tap({ force: true });
  else await page.locator('#next').click({ force: true }); // Production button intentionally bounces.
}
async function type(page, answer, touch = false) {
  for (const letter of answer) {
    const key = page.locator('[data-letter="' + letter + '"]');
    if (touch) await key.tap(); else await key.click();
  }
}
async function binWord(page, index, touch = false) {
  const word = page.locator('[data-word="' + index + '"]');
  if (touch) { await word.tap(); await page.locator('#bin').tap(); }
  else { await word.click(); await page.locator('#bin').click(); }
}
async function solve(page, touch = false) {
  const s = await state(page);
  const exercise = (await session(page))[s.cursor];
  if (exercise.type === 'missing') {
    for (let i = 0; i < exercise.answers.length; i++) {
      const box = page.locator('[data-box="' + i + '"]');
      if (touch) await box.tap(); else await box.click();
      await type(page, exercise.answers[i], touch);
    }
  } else {
    const index = exercise.sentence.split(' ').findIndex(word => word.replace(/[.,!?]+$/, '').toLowerCase() === exercise.wrongWord);
    await binWord(page, index, touch);
    await type(page, exercise.answer, touch);
  }
  if (touch) await page.locator('#check').tap(); else await page.locator('#check').click();
  ok((await state(page)).solved, exercise.id + ' accepts its intended answer');
}
async function findSet(page, id, presentation = 'study') {
  for (let i = 0; i < 80; i++) {
    if ((await session(page)).some(exercise => exercise.id === id && exercise.presentation === presentation)) return;
    await page.locator('#new-set').click();
  }
  throw new Error('Could not sample ' + id);
}
async function advanceTo(page, id, presentation = 'study') {
  await findSet(page, id, presentation);
  while (true) {
    const exercise = (await session(page))[(await state(page)).cursor];
    if (exercise.id === id && exercise.presentation === presentation) break;
    await solve(page);
    await advance(page);
  }
}
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  ok(dimensions.content <= dimensions.width, label + ' has no horizontal overflow');
}
async function shellParity(page, reference, selector, label) {
  const readStyle = selector => {
    const css = getComputedStyle(document.querySelector(selector));
    return Object.fromEntries(['backgroundImage', 'fontFamily', 'borderRadius', 'padding', 'color', 'width', 'boxShadow'].map(key => [key, css[key]]));
  };
  const actual = await page.evaluate(readStyle, selector);
  const expected = await reference.evaluate(readStyle, selector);
  ok(JSON.stringify(actual) === JSON.stringify(expected), label + ' shell matches the real index.html styling');
}

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const errors = [];
  try {
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await desktop.addInitScript(() => localStorage.setItem('theme-kid-friendly', 'false'));
    desktop.on('pageerror', error => errors.push(error.message));
    await desktop.goto(url);
    const shells = await desktop.evaluate(source => {
      const document = new DOMParser().parseFromString(source, 'text/html');
      return ['studyModeOverlay', 'grammarGame'].map(id => {
        const shell = document.getElementById(id);
        shell.classList.remove('hidden');
        return shell.outerHTML;
      }).join('');
    }, fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'));
    const reference = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const asset = name => new URL(name, url).href;
    await reference.setContent('<head><script src="' + asset('lib/tailwind.js') + '"></script><link rel="stylesheet" href="' + asset('fonts/fonts.css') + '"><link rel="stylesheet" href="' + asset('style.css') + '"></head><body>' + shells + '</body>');
    await reference.waitForTimeout(300);
    await shellParity(desktop, reference, '#studyModeOverlay', 'desktop Study');
    for (let i = 0; i < 12; i++) {
      const exercises = await session(desktop);
      ok(exercises.length === 8 && ['study', 'game'].every((presentation, index) => {
        const group = exercises.slice(index * 4, index * 4 + 4);
        return group.every(exercise => exercise.presentation === presentation) && group.slice(0, 2).every(exercise => exercise.type === 'missing') && group.slice(2).every(exercise => exercise.type === 'fix');
      }), 'sample has M M F F in Study, then M M F F in Game');
      ok([exercises.slice(0, 4), exercises.slice(4)].every(group => new Set(group.map(exercise => exercise.id)).size === 4), 'sample has no repeated exercise within either presentation');
      await desktop.reload();
    }
    await advanceTo(desktop, 'M1');
    await desktop.locator('#check').click();
    ok((await session(desktop))[(await state(desktop)).cursor].attempts === 0, 'empty CHECK does not consume an attempt');
    const keyCount = await desktop.locator('.key').count();
    await type(desktop, 'before');
    ok(await desktop.locator('.key').count() === keyCount && (await state(desktop)).input[0] === 'before', 'letter keys are reusable, including repeated e');
    await desktop.locator('[data-box="1"]').click();
    await type(desktop, 'before');
    await desktop.locator('#check').click();
    ok(!(await state(desktop)).solved && (await state(desktop)).locked, 'same word in both blanks fails and freezes editing');
    ok(await desktop.locator('[data-box="0"] .correct').count() === 6 && await desktop.locator('[data-box="1"] .wrong').count() > 0, 'letter feedback is graded per blank and position');
    await desktop.locator('#check').click({ force: true });
    ok((await session(desktop))[(await state(desktop)).cursor].attempts === 1, 'repeated CHECK during feedback is ignored');
    await desktop.waitForTimeout(3100);
    ok((await state(desktop)).input.every(value => value === '') && !(await state(desktop)).locked, 'automatic reset clears correct and wrong blanks together');
    await desktop.keyboard.type('BEFORE');
    await desktop.locator('[data-box="1"]').click();
    await desktop.keyboard.type('after');
    await desktop.keyboard.press('Enter');
    ok((await state(desktop)).solved && !(await session(desktop))[(await state(desktop)).cursor].firstAttempt, 'physical keyboard works and later success preserves first failure');
    await desktop.locator('#new-set').click();
    await advanceTo(desktop, 'F1');
    ok(await desktop.locator('.word').count() === 8, 'all words in F1 are selectable');
    await binWord(desktop, 0);
    const keys = await desktop.locator('.key').allTextContents();
    ok(keys.length === 5 && [...keys].sort().join('') === 'befor', 'find/fix keyboard contains only unique target letters, without fillers');
    await type(desktop, 'before');
    await desktop.locator('#check').click();
    ok(!(await state(desktop)).solved && await desktop.locator('#bin.word-wrong').count() === 1 && await desktop.locator('.letter.correct').count() === 6, 'wrong selected word and correct replacement spelling are shown independently');
    ok((await desktop.locator('#feedback').textContent()).includes('新单词拼对了'), 'wrong-selection feedback explains the two results');
    ok(await desktop.locator('#bin-mark.fa-times-circle').isVisible() && !(await desktop.locator('#bin-undo').isVisible()), 'wrong bin selection has a clear cross and hides undo while frozen');
    ok(await desktop.locator('#bin-label').isVisible() && await desktop.locator('.nse-bin-body').evaluate(body => getComputedStyle(body).fill) === 'rgb(248, 113, 113)', 'wrong selection leaves the removed word visible beside a red bin');
    ok(await desktop.locator('[data-box="0"].spelling-correct').count() === 1 && await desktop.locator('[data-box="0"].all-correct').count() === 0, 'correct spelling can be green without a completion check when the selected word is wrong');
    await desktop.waitForTimeout(3100);
    ok((await state(desktop)).binnedWord === null && await desktop.locator('.word').count() === 8 && await desktop.locator('.key').count() === 0, 'find/fix reset restores the original word and hides keyboard');
    const wrong = desktop.locator('[data-word="4"]');
    const wordRect = await wrong.boundingBox();
    const binRect = await desktop.locator('#bin').boundingBox();
    await desktop.mouse.move(wordRect.x + wordRect.width / 2, wordRect.y + wordRect.height / 2);
    await desktop.mouse.down();
    await desktop.mouse.move(binRect.x + binRect.width / 2, binRect.y + binRect.height / 2, { steps: 12 });
    await desktop.mouse.up();
    ok((await state(desktop)).binnedWord === 4, 'dragging a word to the bin works');
    await type(desktop, 'befor');
    await desktop.locator('#check').click();
    ok(await desktop.locator('#bin.word-correct').count() === 1 && await desktop.locator('.letter.wrong').count() === 1, 'right word selection and missing replacement letter have separate feedback');
    ok(await desktop.locator('#bin-mark.fa-check-circle').isVisible(), 'correct bin selection has a visible check even when spelling needs fixing');
    const binFeedback = await desktop.evaluate(() => {
      const label = document.getElementById('bin-label');
      const icon = document.querySelector('.nse-bin-icon').getBoundingClientRect();
      const mark = document.getElementById('bin-mark').getBoundingClientRect();
      return { fill: getComputedStyle(document.querySelector('.nse-bin-body')).fill, wordFill: getComputedStyle(label).backgroundImage, strike: getComputedStyle(label).textDecorationLine, markGap: mark.left - icon.right };
    });
    ok(binFeedback.fill === 'rgb(74, 222, 128)' && binFeedback.wordFill === 'none' && binFeedback.strike === 'line-through', 'correct selection colours the bin green and crosses out the neutral word');
    ok(Math.abs(binFeedback.markGap) < 12, 'selection checkmark sits beside the bin icon');
    await desktop.waitForTimeout(950);
    ok(!(await desktop.locator('#bin-label').isVisible()) && await desktop.locator('#bin-mark').isVisible(), 'short swallow animation removes the word and leaves the bin check visible');
    await desktop.locator('#clear').click();
    ok(!(await state(desktop)).locked && (await state(desktop)).binnedWord === null, 'CLEAR stays usable during wrong feedback');
    ok(await desktop.locator('#bin-label').isVisible() && await desktop.locator('#bin-label').textContent() === 'Bin', 'CLEAR restores the bin after the swallow animation');
    await solve(desktop);
    await advance(desktop);
    while ((await state(desktop)).cursor < 8) { await solve(desktop); await advance(desktop); }
    ok(await desktop.locator('#summary').isVisible(), 'all eight exercises lead to the summary');
    await desktop.locator('#new-set').click();
    await advanceTo(desktop, 'M1');
    await type(desktop, 'after');
    await desktop.locator('[data-box="1"]').click();
    await type(desktop, 'before');
    await desktop.locator('#check').click();
    await desktop.locator('#new-set').click();
    const newFirstLetter = (await desktop.locator('.key').first().textContent());
    await type(desktop, newFirstLetter);
    await desktop.waitForTimeout(3100);
    ok((await state(desktop)).input[0] === newFirstLetter, 'old feedback timers cannot clear a freshly picked set');
    await noOverflow(desktop, 'desktop');
    await desktop.screenshot({ path: path.join(screenshots, 'desktop.png'), fullPage: true });

    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await phone.addInitScript(() => localStorage.setItem('theme-kid-friendly', 'false'));
    phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(url);
    const phoneCases = await session(phone);
    for (let i = 0; i < 8; i++) {
      await noOverflow(phone, 'phone ' + phoneCases[i].id);
      await solve(phone, true);
      if ([0, 2, 4, 6].includes(i)) await phone.screenshot({ path: path.join(screenshots, 'phone-' + phoneCases[i].presentation + '-' + phoneCases[i].type + '.png'), fullPage: true });
      const study = phoneCases[i].presentation === 'study';
      if (i === 4) {
        await reference.setViewportSize({ width: 390, height: 844 });
        await shellParity(phone, reference, '#grammarGame .minigame-container', 'phone Game');
      }
      ok(await phone.locator(study ? '#studyModeOverlay' : '#grammarGame').isVisible(), 'correct production shell is visible for ' + phoneCases[i].presentation);
      ok(await phone.locator(study ? '.study-letter-btn' : '.letter-bubble').count() > 0, 'production letter-key component is used for ' + phoneCases[i].presentation);
      if (!study) ok(await phone.locator('#next').textContent() === 'GET POWER UP!', 'game success uses the real power-up action');
      await advance(phone, true);
    }
    ok(await phone.locator('#summary').isVisible(), 'eight-exercise touch-only session completes on phone');
    await phone.locator('#new-set').tap();
    await phone.setViewportSize({ width: 320, height: 568 });
    await noOverflow(phone, '320px phone');
    const targets = await phone.locator('.key').evaluateAll(keys => keys.every(key => { const rect = key.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; }));
    ok(targets, 'small-phone letter keys remain at least 44px');
    await phone.screenshot({ path: path.join(screenshots, 'phone-small.png'), fullPage: true });
    await phone.setViewportSize({ width: 844, height: 390 });
    await noOverflow(phone, 'phone landscape');
    await phone.locator('#themeToggleBtn').tap();
    ok(await phone.locator('body.kid-friendly').count() === 1, 'production kid-friendly theme can be previewed');
    await phone.setViewportSize({ width: 390, height: 844 });
    await solve(phone, true);
    const green = await phone.locator('.letter.correct').first().evaluate(letter => getComputedStyle(letter).color);
    ok(green === 'rgb(255, 255, 255)', 'kid-friendly feedback keeps white lettering readable on green tiles');
    const successStyle = await phone.locator('.nse-answer.all-correct').first().evaluate(answer => ({ fill: getComputedStyle(answer).backgroundImage, shadow: getComputedStyle(answer).boxShadow, badge: getComputedStyle(answer, '::after').content }));
    ok(successStyle.fill.includes('rgb(74, 222, 128)') && successStyle.fill.includes('rgb(22, 163, 74)') && successStyle.shadow.includes('rgb(21, 128, 61)') && successStyle.badge.includes('✓'), 'correct answers use the existing exercises’ raised green gradient and completion check');
    await phone.screenshot({ path: path.join(screenshots, 'phone-kid-friendly.png'), fullPage: true });
    await advance(phone, true);
    const errorExercise = (await session(phone))[(await state(phone)).cursor];
    await type(phone, errorExercise.answers[0] === 'before' ? 'be' : errorExercise.answers[0].slice(0, -1), true);
    await phone.locator('[data-box="1"]').tap();
    await type(phone, errorExercise.answers[1], true);
    await phone.locator('#check').tap();
    const red = await phone.locator('.letter.wrong').first().evaluate(letter => getComputedStyle(letter).color);
    ok(red === 'rgb(255, 255, 255)', 'kid-friendly feedback keeps white lettering readable on red tiles');
    const wrongFill = await phone.locator('.letter.wrong').first().evaluate(letter => getComputedStyle(letter).backgroundImage);
    ok(wrongFill.includes('rgb(248, 113, 113)') && wrongFill.includes('rgb(220, 38, 38)'), 'wrong letters use the same red gradient as existing exercise tiles');
    ok(await phone.locator('.nse-feedback.error .nse-feedback-icon').isVisible(), 'error feedback includes a retry icon alongside its text');
    ok(await phone.locator('body').evaluate(body => getComputedStyle(body).touchAction) === 'pan-y', 'phone preview permits native vertical scrolling');
    const fresh = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await fresh.goto(url);
    ok(await fresh.locator('body.kid-friendly').count() === 1, 'fresh POC starts in the kid-friendly theme');
    ok(await fresh.locator('.nse-sentence').first().evaluate(row => getComputedStyle(row).fontWeight) === '700', 'sentence typography matches the strong exercise tile weight');
    const rowCounts = await fresh.locator('.nse-key-row').evaluateAll(rows => rows.map(row => row.children.length));
    ok(rowCounts.length === 2 && Math.abs(rowCounts[0] - rowCounts[1]) <= 1, 'phone keyboard splits into balanced rows');
    await fresh.screenshot({ path: path.join(screenshots, 'polished-phone-study.png'), fullPage: true });
    await advanceTo(fresh, 'F1');
    const binStyle = await fresh.locator('#bin').evaluate(bin => ({ width: bin.getBoundingClientRect().width, border: getComputedStyle(bin).borderTopStyle, height: bin.getBoundingClientRect().height }));
    ok(binStyle.width < 200 && binStyle.border === 'solid' && binStyle.height >= 44, 'phone bin is a compact raised touch target with a solid edge');
    await fresh.locator('[data-word="4"]').tap();
    ok(await fresh.locator('#bin.ready').count() === 1, 'selected word opens the bin lid and highlights the destination');
    await fresh.locator('#bin').tap();
    ok(await fresh.locator('#bin.has-word').count() === 1 && await fresh.locator('#bin-undo').isVisible(), 'bin holds the removed word and offers undo');
    await fresh.locator('#bin').tap();
    ok((await state(fresh)).binnedWord === null && await fresh.locator('.word').count() === 8, 'tap undo restores the original word');
    await fresh.emulateMedia({ reducedMotion: 'reduce' });
    await binWord(fresh, 4, true);
    await type(fresh, 'befor', true);
    await fresh.locator('#check').tap();
    ok(await fresh.locator('.nse-answer.spelling-wrong').evaluate(answer => getComputedStyle(answer).animationName) === 'none', 'feedback honours reduced-motion preferences');
    ok(!(await fresh.locator('#bin-label').isVisible()) && await fresh.locator('.nse-bin-icon').evaluate(icon => getComputedStyle(icon).animationName) === 'none', 'reduced-motion mode removes the accepted word without the swallow motion');
    await fresh.locator('#clear').tap();
    await advanceTo(fresh, 'F1', 'game');
    await fresh.setViewportSize({ width: 320, height: 568 });
    await solve(fresh, true);
    await fresh.waitForTimeout(400);
    const compactResult = await fresh.evaluate(() => {
      const reward = document.getElementById('next').getBoundingClientRect();
      const theme = document.getElementById('themeToggleBtn').getBoundingClientRect();
      const card = document.querySelector('#grammarGame .minigame-container').getBoundingClientRect();
      const keyTops = [...document.querySelectorAll('.key')].map(key => key.getBoundingClientRect().top);
      return { rewardBottom: reward.bottom, cardBottom: card.bottom, themeTop: theme.top, keyTops };
    });
    ok(compactResult.rewardBottom <= compactResult.cardBottom && compactResult.rewardBottom < compactResult.themeTop, 'small-phone reward stays visible above the floating theme control');
    ok(new Set(compactResult.keyTops).size === 1, 'short find/fix keyboard fits on one row on a short phone');
    ok(errors.length === 0, 'no browser script errors: ' + errors.join('; '));
    console.log('\n' + assertions + ' assertions passed. Screenshots: ' + screenshots);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
