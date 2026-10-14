'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
let seed = 93417;
const randomMath = Object.create(Math);
randomMath.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const sandbox = {
    console, Math: randomMath, API_BASE_URL: '', document: { addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, getCurrentSession: () => 5
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ['sr_engine.js', 'teaching_content.js', 'content_pu1.js', 'content_pu2.js', 'content_pu3.js', 'content_think0.js', 'content_think1.js', 'content_think2.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
}
const vocabSnapshot = () => vm.runInContext("JSON.stringify(Object.fromEntries(Object.entries(TEACHING_CONTENT).map(([b,us]) => [b,Object.fromEntries(Object.entries(us).map(([u,ps]) => [u,Object.fromEntries(Object.entries(ps).map(([p,c]) => [p,c.vocab]))]))])))", sandbox);
const before = vocabSnapshot();
vm.runInContext(fs.readFileSync('non_spelling_content.js', 'utf8'), sandbox);
const content = sandbox.NonSpellingContent;
assert.equal(vocabSnapshot(), before, 'normalization never changes vocabulary');
assert.equal(content.buildPool('PU3', 9, 107).entries.some(e => e.item.page === '109'), false, 'page 109 exercises never leak into earlier pages');
assert.equal(content.buildPool('PU3', 9, 109).entries.filter(e => e.item.id && e.item.page === '109').length, 14, 'six missing-word and eight fix items belong to PU3 p109');
const unit1 = content.buildPool('PU3', 1, 16).entries.filter(e => e.item.id).map(e => e.item);
assert.equal(unit1.filter(e => e.type === 'missing-word').length, 20, 'all twenty approved Unit 1 missing boards belong to page 16');
assert.equal(unit1.filter(e => e.type === 'find-fix').length, 22, 'all twenty-two approved Unit 1 fixes belong to page 16');
assert.ok(unit1.every(e => e.unit === '1' && e.page === '16'), 'Unit 1 authored items have the exact approved placement');
assert.equal(new Set(unit1.map(e => e.key)).size, 42, 'reused page-local M/F IDs retain distinct SR keys');
assert.equal(content.buildPool('PU3', 0, 5).entries.some(e => e.item.id), false, 'Unit 1 content never appears before Unit 1');
const unit2 = content.buildPool('PU3', 2, 28).entries.filter(e => e.item.id && e.item.unit === '2').map(e => e.item);
assert.equal(unit2.filter(e => e.type === 'missing-word').length, 16, 'sixteen approved Unit 2 missing boards belong to page 28');
assert.equal(unit2.filter(e => e.type === 'find-fix').length, 20, 'twenty approved Unit 2 fixes belong to page 28');
assert.ok(unit2.every(e => e.page === '28'), 'Unit 2 authored content stays under page 28');
assert.equal(new Set([...unit1, ...unit2].map(e => e.key)).size, 78, 'Unit 1 and Unit 2 retain distinct SR keys');
assert.equal(unit2.find(e => e.id === 'M2').sentences[1], 'These are the pancakes ___ we ate.', 'M2 retains the approved pancakes replacement');
assert.equal(unit2.find(e => e.id === 'F9').sentence, "He's the teacher who teaches me English last year.");
assert.equal(unit2.find(e => e.id === 'F11').sentence, 'This is the tree house which they build last summer.');
const unit3 = content.buildPool('PU3', 3, 40).entries.filter(e => e.item.id && e.item.unit === '3').map(e => e.item);
assert.equal(unit3.filter(e => e.type === 'missing-word').length, 22, 'Unit 3 has the approved 22 missing boards');
const fixes3 = unit3.filter(e => e.type === 'find-fix');
assert.equal(fixes3.length, 27, 'Unit 3 has the approved 27 distinct fixes');
assert.equal(new Set(fixes3.map(e => e.sentence)).size, 27, 'no duplicate fix sentences');
assert.ok(!fixes3.some(e => e.id === 'F27'), 'F27 duplicate remains excluded');
assert.ok(!fixes3.find(e => e.id === 'F28').sentence.includes('but'), 'F28 omits the rejected conjunction');
assert.equal(unit3.find(e => e.id === 'M22').answers.length, 4, 'M22 retains four blanks');
assert.equal(new Set([...unit1, ...unit2, ...unit3].map(e => e.key)).size, 127, 'all three units retain scoped SR keys');
assert.ok(unit3.every(e => e.page === '40'), 'Unit 3 belongs to page 40');
const unit4 = content.buildPool('PU3', 4, 54).entries.filter(e => e.item.id && e.item.unit === '4').map(e => e.item);
assert.equal(unit4.filter(e => e.answers).length, 16, 'Unit 4 has 16 approved missing boards');
assert.equal(unit4.filter(e => e.answer).length, 20, 'Unit 4 has 20 approved fixes');
assert.ok(unit4.every(e => e.page === '54'), 'Unit 4 stays under page 54');
assert.equal(unit4.filter(e => e.prefixes).length, 13, 'only the 13 requested boards prefill letters');
for (const item of unit4.filter(e => e.prefixes)) assert.deepEqual(item.prefixes, item.answers.map(a => a[0]));
assert.equal(unit4.find(e => e.id === 'F14').wrongWord, 'then', 'F14 avoids the ambiguous as repair');
assert.equal(new Set([...unit1, ...unit2, ...unit3, ...unit4].map(e => e.key)).size, 163, 'four units retain scoped keys');
assert.equal(content.buildPool('PU3', 3, 40).entries.some(e => e.item.unit === '4'), false, 'Unit 4 cannot appear early');
const unit5 = content.buildPool('PU3', 5, 66).entries.filter(e => e.item.id && e.item.unit === '5').map(e => e.item);
assert.equal(unit5.filter(e => e.answers).length, 16, 'Unit 5 has 16 approved missing boards');
assert.equal(unit5.filter(e => e.answer).length, 20, 'Unit 5 has 20 approved fixes');
for (const [page, missing, fixes] of [['57', 3, 4], ['59', 4, 6], ['66', 9, 10]]) {
    assert.equal(unit5.filter(e => e.page === page && e.answers).length, missing, page + ' missing count');
    assert.equal(unit5.filter(e => e.page === page && e.answer).length, fixes, page + ' fix count');
    assert.ok(!content.buildPool('PU3', 5, page).entries.some(e => e.item.unit === '5' && Number(e.item.page) > Number(page)), 'later Unit 5 pages never appear early');
}
assert.equal(unit5.filter(e => e.prefixes).length, 13, 'Unit 5 preserves the approved initial hints');
assert.equal(new Set(unit5.filter(e => e.answer).map(e => e.sentence)).size, 20, 'no duplicate Unit 5 fixes');
assert.equal(new Set([...unit1, ...unit2, ...unit3, ...unit4, ...unit5].map(e => e.key)).size, 199, 'all approved boards retain scoped keys');
assert.ok(!content.buildPool('PU3', 4, 54).entries.some(e => e.item.unit === '5'), 'Unit 5 stays out of Unit 4');
const unit6 = content.buildPool('PU3', 6, 73).entries.filter(e => e.item.id && e.item.unit === '6').map(e => e.item);
assert.equal(unit6.filter(e => e.answers).length, 26, 'Unit 6 has 26 approved missing boards');
assert.equal(unit6.filter(e => e.answer).length, 34, 'Unit 6 has 34 approved fixes');
for (const [page, missing, fixes] of [['69', 6, 6], ['71', 4, 6], ['73', 16, 22]]) {
    assert.equal(unit6.filter(e => e.page === page && e.answers).length, missing, page + ' missing count');
    assert.equal(unit6.filter(e => e.page === page && e.answer).length, fixes, page + ' fix count');
    assert.ok(!content.buildPool('PU3', 6, page).entries.some(e => e.item.unit === '6' && Number(e.item.page) > Number(page)), 'later Unit 6 pages never appear early');
}
assert.equal(unit6.filter(e => e.prefixes).length, 22, 'Unit 6 preserves initial hints');
assert.equal(unit6.find(e => e.id === 'M11').sentences[0], 'You should ___ the guitar every day to get good.');
assert.ok(unit6.find(e => e.id === 'M21').sentences[0].includes('password'), 'wifi uses familiar password context');
assert.ok(unit6.find(e => e.id === 'M25').sentences.join(' ').includes('CTRL + V'), 'copy/paste retains the approved shortcuts');
for (const [id, wrong, answer] of [['F23','dictionary','laptop'],['F25','glues','apps'],['F26','in','on'],['F27','hifi','wifi'],['F30','bin','dictionary']]) {
    const item = unit6.find(e => e.id === id); assert.equal(item.wrongWord, wrong); assert.equal(item.answer, answer);
}
assert.equal(new Set([...unit1, ...unit2, ...unit3, ...unit4, ...unit5, ...unit6].map(e => e.key)).size, 259, 'all approved boards retain scoped keys');
assert.ok(!content.buildPool('PU3', 5, 66).entries.some(e => e.item.unit === '6'), 'Unit 6 stays out of Unit 5');
const unit7 = content.buildPool('PU3', 7, 87).entries.filter(e => e.item.id && e.item.unit === '7').map(e => e.item);
assert.equal(unit7.filter(e => e.answers).length, 26, 'Unit 7 has 26 approved missing boards');
assert.equal(unit7.filter(e => e.answer).length, 32, 'Unit 7 has 32 approved fixes');
for (const [page, missing, fixes] of [['83', 5, 10], ['85', 10, 12], ['87', 11, 10]]) {
    assert.equal(unit7.filter(e => e.page === page && e.answers).length, missing, page + ' missing count');
    assert.equal(unit7.filter(e => e.page === page && e.answer).length, fixes, page + ' fix count');
    assert.ok(!content.buildPool('PU3', 7, page).entries.some(e => e.item.unit === '7' && Number(e.item.page) > Number(page)), 'later Unit 7 pages never appear early');
}
assert.equal(unit7.filter(e => e.prefixes).length, 15, 'Unit 7 preserves the approved initial hints');
assert.deepEqual(Array.from(unit7.find(e => e.id === 'M5').prefixes), ['a', ''], 'M5 prefills only its first blank');
for (const id of ['M23','M24','M25','M26']) {
    const item = unit7.find(e => e.id === id); assert.equal(item.page, '85'); assert.equal(item.prefixes, undefined);
    assert.deepEqual(Array.from(item.answers).sort(), ['if', 'when'], 'connector boards retain both unhinted words');
}
for (const [id, wrong, answer] of [['F29','when','if'],['F30','if','when'],['F31','if','when'],['F32','when','if']]) {
    const item = unit7.find(e => e.id === id); assert.equal(item.wrongWord, wrong); assert.equal(item.answer, answer);
}
assert.equal(new Set([...unit1, ...unit2, ...unit3, ...unit4, ...unit5, ...unit6, ...unit7].map(e => e.key)).size, 317, 'all approved boards retain scoped keys');
assert.equal(new Set(unit7.filter(e => e.answer).map(e => e.sentence)).size, 32, 'no duplicate Unit 7 fixes');
assert.ok(!content.buildPool('PU3', 6, 73).entries.some(e => e.item.unit === '7'), 'Unit 7 stays out of Unit 6');
const unit8 = content.buildPool('PU3', 8, 99).entries.filter(e => e.item.id && e.item.unit === '8').map(e => e.item);
assert.equal(unit8.filter(e => e.answers).length, 23, 'Unit 8 has 23 approved missing boards');
assert.equal(unit8.filter(e => e.answer).length, 32, 'Unit 8 has 32 approved fixes');
for (const [page, missing, fixes] of [['95', 4, 4], ['97', 8, 10], ['98', 6, 10], ['99', 5, 8]]) {
    assert.equal(unit8.filter(e => e.page === page && e.answers).length, missing, page + ' missing count');
    assert.equal(unit8.filter(e => e.page === page && e.answer).length, fixes, page + ' fix count');
    assert.ok(!content.buildPool('PU3', 8, page).entries.some(e => e.item.unit === '8' && Number(e.item.page) > Number(page)), 'later Unit 8 pages never appear early');
}
assert.equal(unit8.filter(e => e.prefixes).length, 17, 'Unit 8 preserves approved initial hints');
assert.ok(!unit8.some(e => e.id === 'M10'), 'rejected umbrella/rain board is omitted');
assert.deepEqual(Array.from(unit8.find(e => e.id === 'M5').answers), ["'m", "'s"]);
assert.deepEqual(Array.from(unit8.find(e => e.id === 'M6').answers), ["'re", "'s"]);
assert.ok(unit8.find(e => e.id === 'M5').sentences[0].startsWith('I___'), 'contraction slot attaches to its pronoun');
assert.deepEqual(Array.from(unit8.find(e => e.id === 'M15').sentences), ['We go to the ___', 'to get ___.']);
const postBoard = unit8.find(e => e.id === 'M16');
assert.deepEqual(Array.from(postBoard.sentences), ['We buy ___ at the ___ ___.']);
assert.deepEqual(Array.from(postBoard.answers), ['stamps', 'post', 'office']);
assert.equal(new Set([...unit1, ...unit2, ...unit3, ...unit4, ...unit5, ...unit6, ...unit7, ...unit8].map(e => e.key)).size, 372, 'all approved boards retain scoped keys');
assert.equal(new Set(unit8.filter(e => e.answer).map(e => e.sentence)).size, 32, 'no duplicate Unit 8 fixes');
assert.ok(!content.buildPool('PU3', 7, 87).entries.some(e => e.item.unit === '8'), 'Unit 8 stays out of Unit 7');
assert.ok(!unit1.some(e => ['M6', 'M9', 'M10', 'F9', 'F10'].includes(e.id)), 'rejected boards remain excluded');
for (const item of [...unit1, ...unit2, ...unit3, ...unit4, ...unit5, ...unit6, ...unit7, ...unit8]) {
    if (item.answers) assert.equal(item.sentences.join(' ').split('___').length - 1, item.answers.length, item.id + ' has one target per blank');
    else if (Number.isInteger(item.wrongIndex)) assert.equal(item.sentence.split(' ')[item.wrongIndex].replace(/[.,!?]+$/, '').toLowerCase(), item.wrongWord, item.id + ' explicitly identifies its repeated wrong token');
    else assert.equal(item.sentence.split(' ').filter(word => word.replace(/[.,!?]+$/, '').toLowerCase() === item.wrongWord).length, 1, item.id + ' identifies exactly one wrong token');
}
for (let sample = 0; sample < 100; sample++) {
    const picked = content.select('PU3', 1, 16, 5);
    assert.equal(picked.length, 5);
    assert.ok(new Set(picked.map(e => e.type)).size >= 3, 'Unit 1 selects a varied five-board round');
    const next = content.select('PU3', 2, 28, 5);
    assert.equal(next.length, 5);
    assert.ok(new Set(next.map(e => e.type)).size >= 3, 'Unit 2 selects a varied five-board round');
    const third = content.select('PU3', 3, 40, 5);
    assert.equal(third.length, 5);
    assert.ok(new Set(third.map(e => e.type)).size >= 3, 'Unit 3 selects a varied five-board round');
}
for (let sample = 0; sample < 400; sample++) {
    const picked = content.select('PU3', 9, 109, 5);
    assert.equal(picked.length, 5);
    assert.ok(new Set(picked.map(p => p.type)).size >= 3, 'five boards include at least three eligible types');
    assert.equal(new Set(picked.map(p => p.type + ':' + p.key)).size, 5, 'boards are unique');
    const pairKeys = picked.flatMap(p => p.pairs || []).map(sandbox.itemKey);
    assert.equal(new Set(pairKeys).size, pairKeys.length, 'matching pairs are never repeated within the round');
    for (const board of picked.filter(p => p.type === 'sentence-match')) assert.equal(board.pairs.length, 3, 'one matching board contains three pairs');
}
vm.runInContext(`
TEACHING_CONTENT.pilot = { '1': {
  '1': { vocab: ['old'], sentences: Array.from({length:12}, (_,i) => 'Old sentence '+i+'.'), sentencePairs: [] },
  '2': { vocab: ['new'], sentences: Array.from({length:12}, (_,i) => 'New sentence '+i+'.'), sentencePairs: [], nonSpellingExercises: [
    ...Array.from({length:5}, (_,i) => ({type:'missing-word',id:'m'+i,sentences:['I ___ here.'],answers:['am']})),
    ...Array.from({length:5}, (_,i) => ({type:'find-fix',id:'f'+i,sentence:'I is here.',wrongWord:'is',answer:'am'})),
    { type:'sentence-match',pairs:Array.from({length:6}, (_,i)=>({a:'Question '+i,b:'Answer '+i})) },
    ...Array.from({length:12}, (_,i) => ({type:'sentence-scramble',sentence:'New sentence '+i+'.'}))
  ] },
  '3': { vocab:['future'],sentences:['Future sentence.'],sentencePairs:[] }
} };
AVAILABLE_CONTENT.pilot = { '1':[1,2,3] };
`, sandbox);
const pool = content.buildPool('pilot', 1, 2).entries;
assert.equal(pool.some(e => e.item.page === '3'), false, 'future curriculum stays excluded');
const cooledTyped = { sentences: {}, sentencePairs: {} };
for (const e of pool.filter(e => e.item.id)) cooledTyped.sentences[e.key] = { dueAfterSession: 10, lastResult: 'success' };
for (let i = 0; i < 40; i++) {
    const picked = content.select('pilot', 1, 2, 5, { srState: cooledTyped, session: 5 });
    assert.equal(picked.length, 5);
    assert.equal(picked.some(p => p.id), false, 'cooldown types are not pulled merely to force variety');
    assert.equal(new Set(picked.map(p => p.type)).size, 2, 'two eligible types remain a valid round');
}
const allCooled = { sentences: {}, sentencePairs: {} };
for (const e of pool) {
    for (const key of e.item.pairs ? e.item.pairs.map(sandbox.itemKey) : [e.key]) {
        allCooled[e.item.srType][key] = { dueAfterSession: 10, lastResult: 'success' };
    }
}
const due = pool.find(e => e.item.type === 'sentence-scramble');
allCooled.sentences[due.key] = { dueAfterSession: 4, lastResult: 'failure' };
const shortage = content.select('pilot', 1, 2, 5, { srState: allCooled, session: 5 });
assert.equal(shortage.length, 5, 'cooldown fills real shortages');
assert.ok(shortage.some(e => e.key === due.key), 'due failure stays in the shortage-filled round');
const duePair = pool.find(e => e.item.pairs).item.pairs[0];
allCooled.sentencePairs[sandbox.itemKey(duePair)] = { dueAfterSession: 4, lastResult: 'failure' };
const duePairRound = content.select('pilot', 1, 2, 5, { srState: allCooled, session: 5 });
assert.ok(duePairRound.some(e => e.pairs && e.pairs.some(p => sandbox.itemKey(p) === sandbox.itemKey(duePair))), 'one due matching pair is still reviewed with cooldown board partners');
const partialBoard = content.buildPool('pilot', 1, 2, { srState: allCooled, session: 5 }).entries.find(e => e.item.pairs && e.item.pairs.some(p => sandbox.itemKey(p) === sandbox.itemKey(duePair)));
assert.equal(partialBoard.varietyEligible, false, 'cooldown partners cannot be used solely for the variety quota');
const floor = content.select('pilot', 1, 2, 5, { srState: allCooled, session: 0 });
assert.equal(floor.length, 5, 'all-cooldown pool still produces a full round');
const legacyOnly = content.select('pilot', 1, 1, 5);
assert.ok(legacyOnly.every(e => e.type === 'sentence-scramble'), 'a page with just one type still works');
let nearest = 0;
for (let i = 0; i < 400; i++) {
    const picked = content.select('pilot', 1, 2, 1, { srState: cooledTyped, session: 5 });
    if (picked[0].page === '2') nearest++;
}
assert.ok(nearest > 320, 'nearer pages receive greater sampling weight');
const typed = pool.find(e => e.item.type === 'missing-word').item;
const oldState = { vocab: { old: { lastResult: 'success' } }, sentences: { old: { lastResult: 'success' } }, sentencePairs: {} };
const updated = sandbox.updateSRStateForSession(oldState, [{ type: 'sentences', key: typed.key, firstAttempt: false }], 5);
const delta = sandbox.extractSRDelta(updated, 5);
const merged = sandbox.mergeSRDelta(oldState, delta);
assert.equal(merged.sentences[typed.key].lastResult, 'failure', 'new IDs survive the existing SR delta wire format');
assert.equal(merged.sentences.old.lastResult, 'success', 'legacy sentence history survives new updates');
assert.equal(merged.vocab.old.lastResult, 'success', 'legacy vocabulary history survives new updates');
function enabledAt(address) {
    const location = new URL(address);
    const context = { window: { location }, URLSearchParams };
    vm.createContext(context);
    return vm.runInContext(fs.readFileSync('config.js', 'utf8') + '\nNON_SPELLING_ENABLED;', context);
}
assert.equal(enabledAt('https://vpietri-stack.github.io/Classroom-survivors/index.html'), false, 'production keeps the existing flow during preview testing');
assert.equal(enabledAt('https://vpietri-stack.github.io/Classroom-survivors-preview/index.html'), true, 'preview enables the mixed flow');
assert.equal(enabledAt('http://localhost:8123/index.html'), true, 'local development enables the mixed flow');
assert.equal(enabledAt('https://vpietri-stack.github.io/Classroom-survivors-preview/index.html?nonspelling=0'), false, 'preview can still verify the legacy flow');
console.log('Mixed non-spelling selection: 400 varied rounds, cooldown, proximity, vocabulary and SR compatibility passed.');
