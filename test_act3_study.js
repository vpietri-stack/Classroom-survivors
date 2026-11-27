const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright-core');

const root = __dirname;
let checks = 0;
function ok(cond, msg) {
    assert.ok(cond, msg);
    checks++;
    console.log('PASS ' + msg);
}

// --- 1. Static curriculum, gap-index & translation checks ---
const sandbox = {
    TEACHING_CONTENT: {},
    AVAILABLE_CONTENT: {},
    console
};
vm.createContext(sandbox);
for (const file of ['sr_engine.js', 'teaching_content.js', 'content_act3.js', 'translations.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}

const bookSeries = vm.runInContext('BOOK_SERIES', sandbox);
const availableContent = vm.runInContext('AVAILABLE_CONTENT', sandbox);
const teachingContent = vm.runInContext('TEACHING_CONTENT', sandbox);
ok(Array.isArray(bookSeries.Act3) && bookSeries.Act3[0] === 'Act3', 'BOOK_SERIES includes Act3');
assert.deepEqual(Array.from(availableContent.Act3['1']), ['3', '4', '5', '6']);
checks++;
console.log('PASS AVAILABLE_CONTENT.Act3["1"] has pages 3..6');
assert.deepEqual(Array.from(availableContent.Act3['2']), ['11', '12', '13', '14']);
checks++;
console.log('PASS AVAILABLE_CONTENT.Act3["2"] has pages 11..14');

const expectedGaps = {
    // Page 3
    'morning': 'mn',
    'afternoon': 'atn',
    'evening': 'en',
    'airport': 'ap',
    'library': 'lb',
    'supermarket': 'spmk',
    'zoo': 'zo',
    'museum': 'msu',
    'good': 'go',
    'where': 'wr',
    'are': 'ar',
    'you': 'yo',
    'going': 'gi',
    'we': 'we',
    'to': 'to',
    'the': 'th',
    'me': 'me',
    'too': 'to',
    'how': 'ho',
    'about': 'ab',
    // Page 4
    'bakery': 'bkr',
    'fire station': 'fst',
    'hospital': 'hpt',
    'toy store': 'ts',
    'police station': 'plst',
    'is': 'is',
    "it's": 'is',
    'next to': 'nt',
    'school': 'sc',
    // Page 5
    'pilot': 'pl',
    'librarian': 'lbra',
    'shop assistant': 'sast',
    'zookeeper': 'zkp',
    'guide': 'gu',
    'baker': 'bk',
    'this': 'th',
    'what': 'wh',
    'does': 'do',
    'he': 'he',
    'she': 'sh',
    'do': 'do',
    // Page 6
    'firefighter': 'fft',
    'doctor': 'dt',
    'cashier': 'cs',
    'police officer': 'plofc',
    'teacher': 'tc',
    'who': 'wh',
    'see': 'se',
    // Page 11
    'classroom': 'cr',
    'classmate': 'cm',
    'chair': 'ch',
    'board': 'bo',
    'book': 'bo',
    'hi': 'hi',
    'our': 'ou',
    'my': 'my',
    'look': 'lo',
    'at': 'at',
    // Page 12
    'quiet': 'qe',
    'run': 'ru',
    'walk': 'wa',
    'open': 'op',
    'close': 'cl',
    'pick up': 'pu',
    'slowly': 'sl',
    'be': 'be',
    "don't": 'dt',
    'your': 'yo',
    'listen': 'ls',
    'marker': 'mk',
    'have': 'ha',
    // Page 13
    'eraser': 'ers',
    'glue stick': 'gs',
    'notebook': 'nb',
    'crayon': 'co',
    'backpack': 'bp',
    'red': 're',
    'yellow': 'yl',
    'blue': 'bl',
    'green': 'gr',
    'orange': 'oa',
    'purple': 'pp',
    'big': 'bi',
    'small': 'sm',
    'no': 'no',
    "isn't": 'in',
    'color': 'cl',
    // Page 14
    'hello': 'hl',
    'boys': 'bo',
    'girls': 'gi',
    'and': 'an',
    'new': 'ne',
    'nice': 'ni',
    'meet': 'me',
    'show': 'sh',
    'thank you': 'ty',
    'pencil': 'pc'
};

const translations = vm.runInContext('LOCAL_TRANSLATIONS', sandbox);
let totalVocab = 0;
let totalSents = 0;
for (const [unit, pageList] of [['1', ['3', '4', '5', '6']], ['2', ['11', '12', '13', '14']]]) {
    const pages = teachingContent.Act3[unit];
    for (const p of pageList) {
        const pageData = pages[p];
        ok(pageData && pageData.vocab.length >= 5 && pageData.sentences.length >= 5, `Act3 U${unit} p${p} has >=5 vocab and >=5 sentences`);
        for (const w of pageData.vocab) {
            totalVocab++;
            ok(Boolean(translations[w]), `translation exists for vocab "${w}"`);
            const indices = sandbox.getAct3GapIndices(w);
            const letters = indices.map(i => w[i].toLowerCase()).join('');
            assert.equal(letters, expectedGaps[w], `gap letters for "${w}" should be "${expectedGaps[w]}", got "${letters}"`);
        }
        for (const s of pageData.sentences) {
            totalSents++;
            ok(Boolean(translations[s]), `translation exists for sentence "${s}"`);
        }
    }
}
ok(totalVocab === 97, `verified all ${totalVocab} Act3 Topic 1+2 vocab items`);
ok(totalSents === 72, `verified all ${totalSents} Act3 Topic 1+2 sentences`);

// --- 2. End-to-end Playwright browser test ---
const mime = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.woff2': 'font/woff2',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
        .replace(/^\/Classroom-survivors-preview/, '');
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
    }
    fs.readFile(file, (err, buf) => {
        if (err) {
            res.writeHead(404);
            res.end();
            return;
        }
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
        res.end(buf);
    });
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true
    });
    const pageErrors = [];
    try {
        const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
        await context.route('**/*', async route => {
            const url = route.request().url();
            if (url.includes('/api/') && !url.includes('/api/src/')) {
                if (route.request().method() === 'OPTIONS') {
                    return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
                }
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ enabled: false, addedEventIds: [], duplicateEventIds: [] })
                });
            }
            return url.startsWith(base) && !url.includes('/models/') && !url.includes('/lib/wasm/')
                ? route.continue()
                : route.abort();
        });

        const page = await context.newPage();
        page.on('pageerror', err => pageErrors.push(err.message));
        await page.goto(base + '/Classroom-survivors-preview/index.html');
        await page.waitForFunction(() => window.Act3Study && window.StudyRuntime && typeof initStudyMode === 'function');

        await page.evaluate(() => {
            window.__ttsCalls = [];
            window.playTTS = () => { window.__ttsCalls.push(currentTTSWord); };
            window.synthGem = () => {};
            window.synthError = () => {};
            window.playHappySound = () => {};
            window.SpeechStatus = { isReady: () => false, start: () => {} };
            if (window.AdaptiveSpeech) AdaptiveSpeech.enabled = false;
            if (window.HWRecognition) HWRecognition.load = () => Promise.resolve();
            if (navigator.geolocation) navigator.geolocation.getCurrentPosition = () => {};
            setSessionToken('x.' + btoa(JSON.stringify({ sub: 'act3_test_student' })) + '.x');
            saveUserToLocalAndStart({
                id: 'act3_test_student',
                role: 'student',
                name: 'Act3 Tester',
                fullName: 'Act3 Tester',
                avatar: '🐼',
                book: 'Act3',
                unit: '1',
                page: '3',
                sessionCount: 1,
                srState: { vocab: {}, sentences: {}, sentencePairs: {} },
                analytics: []
            });
        });
        await page.locator('#preview-notes-overlay').waitFor();
        const started = await page.evaluate(() => {
            PreviewNotes.close();
            return initStudyMode();
        });
        ok(started === true, 'initStudyMode starts cleanly for Act3 U1 p3');
        const initState = await page.evaluate(() => ({
            active: STUDY_STATE.active,
            act3: !!STUDY_STATE.act3,
            wordsLen: STUDY_STATE.words.length,
            sentsLen: STUDY_STATE.sentences.length,
            selectedClassContent,
            round: STUDY_STATE.round
        }));
        ok(initState.active && initState.act3 && initState.wordsLen === 5 && initState.sentsLen === 5,
            'Act3 session picks 5 vocab and 5 sentences (got ' + JSON.stringify(initState) + ')');

        // Also test SpeechUI gate branch on Round A word 1 by mocking SpeechUI.isReady() briefly, then continuing.
        const gateMounted = await page.evaluate(() => {
            if (!window.SpeechUI || !window.SpeechUI.makeSentenceGate) return false;
            const origReady = SpeechUI.isReady;
            const origRec = window.Recorder && Recorder.isSupported;
            SpeechUI.isReady = () => true;
            if (window.Recorder) Recorder.isSupported = () => true;
            Act3Study.restore({ state: STUDY_STATE, speech: null });
            const hasGate = !!document.querySelector('#act3-a-controls .speech-sentence-gate, #act3-a-controls .speech-practice');
            SpeechUI.isReady = origReady;
            if (window.Recorder && origRec) Recorder.isSupported = origRec;
            Act3Study.restore({ state: STUDY_STATE, speech: null });
            return hasGate;
        });
        ok(gateMounted, 'Round A mounts SpeechUI gate when speech is ready');

        // Round A: Listen & Repeat (5 words)
        ok((await page.locator('#study-title').textContent()) === 'Round A: Listen & Repeat', 'Round A title matches');
        for (let i = 0; i < 5; i++) {
            const trText = await page.locator('#act3-a-translation').textContent();
            ok(trText.trim().length > 0, `Round A word ${i + 1} shows Chinese translation`);
            await page.locator('#act3-a-next').click();
        }

        // Round B: Handwriting (guide visible directly + exact syllable gaps)
        await page.waitForFunction(() => STUDY_STATE.act3 && STUDY_STATE.act3.stage === 'B' && STUDY_STATE.round === 'D' && !!roundDTrace);
        ok((await page.locator('#study-title').textContent()) === 'Round B: Handwriting', 'Round B title matches');
        const roundBCheck = await page.evaluate(() => {
            const word = STUDY_STATE.words[0];
            return {
                guided: roundDGuided,
                traceGuided: roundDTrace && roundDTrace.exportRecovery && roundDTrace.exportRecovery().guided === true,
                statusText: document.getElementById('handwriting-status').textContent,
                gapsMatch: JSON.stringify(roundDGapOrder) === JSON.stringify(getAct3GapIndices(word))
            };
        });
        ok(roundBCheck.guided && roundBCheck.traceGuided && roundBCheck.statusText === '沿着提示写一写', 'Round B shows handwriting guide directly');
        ok(roundBCheck.gapsMatch, 'Round B uses exact Act3 syllable gap indices');

        while (await page.evaluate(() => STUDY_STATE.act3 && STUDY_STATE.act3.stage === 'B')) {
            await page.evaluate(() => {
                if (!STUDY_STATE.isTransitioning && roundDCursor < roundDGapOrder.length) {
                    roundDAcceptLetter(roundDSlots[roundDGapOrder[roundDCursor]].char, {});
                }
            });
            await page.waitForTimeout(160);
        }

        // Round C: Missing Letters (only missing letters in bank, no dummy letters; CLEAR works during freeze)
        await page.waitForFunction(() => STUDY_STATE.act3 && STUDY_STATE.act3.stage === 'C');
        ok((await page.locator('#study-title').textContent()) === 'Round C: Missing Letters', 'Round C title matches');
        for (let i = 0; i < 5; i++) {
            await page.waitForFunction(idx => STUDY_STATE.act3.stage === 'C' && STUDY_STATE.act3.index === idx && !STUDY_STATE.isTransitioning, i);
            const info = await page.evaluate(() => {
                const word = STUDY_STATE.words[STUDY_STATE.act3.index];
                const authored = getAct3GapIndices(word);
                const gaps = STUDY_STATE.act3.missingGaps;
                const expected = gaps.map(idx => word[idx]);
                const bank = Array.from(document.querySelectorAll('#act3-missing-bank button')).map(b => b.innerText);
                const tr = document.getElementById('act3-c-translation').textContent;
                return { word, expected, bank, tr, authored, gaps };
            });
            ok(info.tr.trim().length > 0, `Round C word "${info.word}" shows translation`);
            const minGaps = Math.min(3, (info.word.match(/[a-z]/gi) || []).length);
            ok(info.authored.every(i => info.gaps.includes(i)) &&
                info.gaps.length === Math.max(info.authored.length, minGaps),
                'Round C preserves authored gaps and reaches the minimum');
            assert.deepEqual([...info.bank].sort(), [...info.expected].sort(), `Round C bank has only exact missing letters for "${info.word}"`);

            // On first word with at least 2 distinct missing letters, test wrong-check freeze + CLEAR recovery
            if (i === 0 && new Set(info.expected).size >= 2) {
                const wrongOrder = info.expected.slice();
                const swap = wrongOrder.findIndex(ch => ch !== wrongOrder[0]);
                [wrongOrder[0], wrongOrder[swap]] = [wrongOrder[swap], wrongOrder[0]];
                for (const ch of wrongOrder) {
                    await page.locator('#act3-missing-bank button').filter({ hasText: new RegExp('^' + ch + '$') }).first().click();
                }
                await page.locator('#act3-c-check').click();
                ok(await page.evaluate(() => STUDY_STATE.act3.missingFrozen === true), 'Round C freezes on wrong check');
                await page.locator('#act3-c-clear').click();
                ok(await page.evaluate(() => STUDY_STATE.act3.missingFrozen === false && document.querySelectorAll('#act3-missing-bank button').length === STUDY_STATE.act3.missingGaps.length),
                    'Round C CLEAR restores bank and unfreezes during wrong reveal');
            }

            for (const ch of info.expected) {
                await page.locator('#act3-missing-bank button').filter({ hasText: new RegExp('^' + ch + '$') }).first().click();
            }
            await page.locator('#act3-c-check').click();
        }

        // Round D: Word Recognition (3 choices, re-queue on miss)
        await page.waitForFunction(() => STUDY_STATE.act3 && STUDY_STATE.act3.stage === 'D');
        ok((await page.locator('#study-title').textContent()) === 'Round D: Word Recognition', 'Round D title matches');
        let testedWrongTap = false;
        let recSafety = 0;
        while (await page.evaluate(() => STUDY_STATE.act3 && STUDY_STATE.act3.stage === 'D')) {
            if (++recSafety > 20) throw new Error('Round D did not finish');
            await page.waitForFunction(() => !STUDY_STATE.isTransitioning);
            const stateInfo = await page.evaluate(() => ({
                target: STUDY_STATE.act3.recQuestion && STUDY_STATE.act3.recQuestion.word,
                options: Array.from(document.querySelectorAll('#act3-d-options button')).map(b => b.innerText),
                tr: document.getElementById('act3-d-translation').textContent
            }));
            ok(stateInfo.options.length === 3, 'Round D presents 3 choices');
            ok(stateInfo.tr.trim().length > 0, 'Round D displays translation');
            if (!testedWrongTap) {
                const wrong = stateInfo.options.find(o => o !== stateInfo.target);
                await page.locator('#act3-d-options button').filter({ hasText: wrong }).first().click();
                ok(await page.evaluate(() => STUDY_STATE.act3.recQuestion.failed === true), 'Round D marks wrong tap as failed');
                testedWrongTap = true;
            }
            await page.locator('#act3-d-options button').filter({ hasText: stateInfo.target }).first().click();
            await page.waitForTimeout(700);
        }
        ok(recSafety === 6, `Round D re-queued missed word cleanly (6 turns total, got ${recSafety})`);

        ok(await page.evaluate(() => srStudyResults.length === 5 &&
            srStudyResults.every(r => r.type === 'vocab' && r.key.startsWith('act3:recognition:'))),
            'Only recognition records vocabulary SR');

        // Round E: Sentence Scramble with listening available (no Round F afterwards)
        await page.waitForFunction(() => STUDY_STATE.act3 && STUDY_STATE.act3.stage === 'E' && STUDY_STATE.round === 'E');
        ok((await page.locator('#study-title').textContent()) === 'Round E: Sentence Scramble', 'Round E title matches');
        for (let i = 0; i < 5; i++) {
            await page.waitForFunction(idx => STUDY_STATE.currentSentenceIndex === idx && !STUDY_STATE.isTransitioning, i);
            const sentInfo = await page.evaluate(() => ({
                hasAudioBtn: !!document.querySelector('#study-game-area button[aria-label="Play Audio"]'),
                tts: currentTTSWord,
                expected: Array.from(document.querySelectorAll('#sentence-drop-zone .sentence-slot')).map(s => s.dataset.expected),
                tr: document.getElementById('roundE-translation').textContent
            }));
            ok(sentInfo.hasAudioBtn, `Round E sentence ${i + 1} has listen button`);
            ok(sentInfo.tts === sentInfo.expected.join(' '), `Round E sentence ${i + 1} sets currentTTSWord`);
            ok(sentInfo.tr.trim().length > 0, `Round E sentence ${i + 1} shows translation`);

            for (const tok of sentInfo.expected) {
                const idx = await page.evaluate(t => {
                    const tiles = Array.from(document.querySelectorAll('#sentence-word-bank .study-word-tile'));
                    return tiles.findIndex(el => el.dataset.word === t);
                }, tok);
                await page.locator('#sentence-word-bank .study-word-tile').nth(idx).click();
            }
            await page.locator('#study-game-area button').filter({ hasText: /^CHECK$/ }).click();
        }

        await page.waitForFunction(() => STUDY_STATE.srFinalized === true && document.getElementById('study-title')?.textContent === 'Session Complete');
        ok((await page.locator('#study-title').textContent()) === 'Session Complete', 'Act3 completes directly after Round E without Round F');
        ok(pageErrors.length === 0, 'zero uncaught browser page errors: ' + pageErrors.join('; '));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(`Act3 Study tests: ${checks} checks passed.`);
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
