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
assert.equal(vm.runInContext("TEACHING_CONTENT.PU3['2']['28'].nonSpellingExercises.some(e => e.id)", sandbox), false, 'Unit 2 is still suggestions only');
assert.ok(!unit1.some(e => ['M6', 'M9', 'M10', 'F9', 'F10'].includes(e.id)), 'rejected boards remain excluded');
for (const item of unit1) {
    if (item.answers) assert.equal(item.sentences.join(' ').split('___').length - 1, item.answers.length, item.id + ' has one target per blank');
    else assert.equal(item.sentence.split(' ').filter(word => word.replace(/[.,!?]+$/, '').toLowerCase() === item.wrongWord).length, 1, item.id + ' identifies exactly one wrong token');
}
for (let sample = 0; sample < 100; sample++) {
    const picked = content.select('PU3', 1, 16, 5);
    assert.equal(picked.length, 5);
    assert.ok(new Set(picked.map(e => e.type)).size >= 3, 'Unit 1 selects a varied five-board round');
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
