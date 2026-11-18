'use strict';
const assert = require('node:assert/strict');
const core = require('./api/src/functions/shared/previewNotesCore');
const fs = require('node:fs'), vm = require('node:vm');
let checks = 0;
function ok(value, label) { assert.ok(value, label); checks++; }
const marker = { id: 'pu3-u9-p111', book: 'PU3', unit: '9', page: '111', version: 1, wordCount: 5, exerciseCount: 5 };
const event = { type: 'session', sessionType: 'study', eventId: 'note-session', timestamp: '2026-10-27T05:00:00.000Z', data: { previewNote: marker } };
const student = { id: 'fixture', analytics: [] };
core.apply(student, [event]);
ok(student.previewNotes[marker.id], 'completed normal Study session derives durable note progress');
const original = JSON.stringify(student.previewNotes);
core.apply(student, [event, event]);
ok(original === JSON.stringify(student.previewNotes), 'duplicate delivery is idempotent');
core.apply(student, []); ok(original === JSON.stringify(student.previewNotes), 'completion remains after analytics archival');
for (const invalid of [
  { ...event, type: 'exercise' }, { ...event, sessionType: 'game' },
  { ...event, data: { previewNote: { ...marker, id: '__proto__' } } },
  { ...event, data: { previewNote: { ...marker, wordCount: 4 } } },
  { ...event, data: { previewNote: { ...marker, exerciseCount: 4 } } },
  { ...event, data: { previewNote: { ...marker, page: '109' } } },
  { ...event, data: { previewNote: { ...marker, version: 999 } } }
]) ok(Object.keys(core.fromEvents([invalid])).length === 0, 'partial, wrong-page or unknown marker cannot complete notes');
ok(Object.keys(core.normalize(Object.fromEntries(Array.from({length:1000},(_,i) => ['unknown'+i, {version:1,completedAt:event.timestamp}])))).length === 0, 'storage bounded by the registered catalog');
const parksMarker = { id: 'think0-u4-p44', book: 'Think0', unit: '4', page: '44', version: 1, wordCount: 25, exerciseCount: 6 };
const parksEvent = { ...event, data: { previewNote: parksMarker } };
ok(core.fromEvents([parksEvent])[parksMarker.id], 'Parks completion is recognized');
for (const invalid of [{ wordCount: 5 }, { exerciseCount: 5 }, { page: '45' }, { version: 2 }])
  ok(!core.fromEvents([{ ...parksEvent, data: { previewNote: { ...parksMarker, ...invalid } } }])[parksMarker.id], 'partial or wrong Parks completion is rejected');
const raceMarker = { id:'pu2-u1-p14', book:'PU2', unit:'1', page:'14', version:1, wordCount:14, exerciseCount:5 };
const raceEvent = { ...event, data: { previewNote: raceMarker } };
ok(core.fromEvents([raceEvent])[raceMarker.id], 'Race completion is recognized');
for (const invalid of [{wordCount:13}, {exerciseCount:4}, {page:'15'}, {version:2}])
  ok(!core.fromEvents([{...raceEvent,data:{previewNote:{...raceMarker,...invalid}}}])[raceMarker.id], 'partial or wrong Race completion is rejected');
const sandbox = { window: null, console, Math, API_BASE_URL: '', document: { addEventListener() {} }, localStorage: { getItem:()=>null,setItem(){},removeItem(){} }, getCurrentSession:()=>10 };
sandbox.window = sandbox; vm.createContext(sandbox);
for (const file of ['sr_engine.js','teaching_content.js','content_pu3.js','non_spelling_content.js']) vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
const pool = sandbox.NonSpellingContent.buildPool('PU3','9','111',{pageOnly:true}).entries;
ok(pool.filter(e=>e.item.type==='missing-word').length === 8, 'all eight existing p111 missing-word boards retained');
ok(pool.filter(e=>e.item.type==='find-fix').length === 14, 'all fourteen existing p111 find/fix boards retained');
ok(new Set(pool.map(e=>e.item.type)).size === 4, 'all four non-spelling types eligible');
const seenTypes = new Set(), seenBoards = new Set();
for(let i=0;i<200;i++) {
  const selected = sandbox.NonSpellingContent.selectPage('PU3','9','111',5);
  ok(selected.length === 5 && new Set(selected.map(e=>e.key)).size === 5, 'five distinct boards');
  ok(selected.every(e=>e.book==='PU3' && e.unit==='9' && e.page==='111'), 'never backfills from another page');
  selected.forEach(e=>{seenTypes.add(e.type);seenBoards.add(e.key);});
}
ok(seenTypes.size === 4 && seenBoards.size >= 30, 'random sampling reaches all types and existing boards');
const m8 = pool.find(e=>e.item.type==='missing-word' && e.item.id==='M8').item;
ok(m8.answers.join('/') === 'frightened/frightening' && m8.prefixes.join('/') === 'f/f', 'existing answers and locked prefixes unchanged');
for (const [pathname, prefix] of [['/Classroom-survivors/', 'production:'], ['/Classroom-survivors-preview/', 'preview:']]) {
  const saved = {};
  const context = { window: null, PreviewNotesState: core, console, location: { pathname, hostname: 'vpietri-stack.github.io', protocol: 'https:' },
    authActiveUser: { id: 'same-student', role: 'student', previewNotes: {} },
    document: { getElementById: () => null }, addEventListener() {},
    localStorage: { getItem: () => null, setItem: (key, value) => { saved[key] = value; } } };
  context.window = context; vm.createContext(context);
  vm.runInContext(fs.readFileSync('preview_notes.js', 'utf8'), context);
  ok(context.PreviewNotes.enabled(), 'registered notes enabled at deployed site path ' + pathname);
  context.PreviewNotes.markComplete(marker);
  ok(!!saved['csPreviewNotes:' + prefix + 'same-student'], 'completion cache stays in its deployed environment');
  context.location.pathname = '/another-project/';
  ok(!context.PreviewNotes.enabled(), 'unrelated hosted paths stay disabled');
}
{
  const saved = {};
  const dynamicCatalog = core.catalog.concat([
    { id: 'pu4-u10-p100', book: 'PU4', unit: '10', page: '100', version: 1, title: 'Power Up 4 · Unit 10 · 第100页', reader: 'pu3_u2_p19_notes.html' },
    { id: 'pu3-u10-p120', book: 'PU3', unit: '10', page: '120', version: 1, title: 'Power Up 3 · Unit 10 · 第120页', reader: 'pu3_u2_p19_notes.html' }
  ]);
  const dynamicCore = { ...core, catalog: dynamicCatalog };
  const context = { window: null, PreviewNotesState: dynamicCore, console, location: { pathname: '/Classroom-survivors/', hostname: 'vpietri-stack.github.io', protocol: 'https:' },
    authActiveUser: { id: 'student-a', role: 'student', previewNotes: {} },
    document: { getElementById: () => null }, addEventListener() {},
    localStorage: { getItem: () => null, setItem: (key, value) => { saved[key] = value; } } };
  context.window = context; vm.createContext(context);
  vm.runInContext(fs.readFileSync('preview_notes.js', 'utf8'), context);
  ok(context.PreviewNotes.bookLabel('Think0') === 'Think S', 'Think0 book displays as Think S');
  ok(context.PreviewNotes.bookLabel('PU1') === 'Power Up 1' && context.PreviewNotes.bookLabel('PU3') === 'Power Up 3', 'Power Up books keep readable names');
  const tree = context.PreviewNotes.buildCatalogTree();
  ok(tree.books.map(b => b.book).join(',') === 'PU1,PU2,PU3,Think0,PU4', 'catalog tree orders books cleanly and automatically includes future books');
  const pu3Units = tree.books.find(b => b.book === 'PU3').units.map(u => u.unit);
  ok(pu3Units.join(',') === '0,1,2,3,4,5,6,7,8,9,10', 'units sort numerically including unit 0 and unit 10');
  const thinkUnits = tree.books.find(b => b.book === 'Think0').units[0].notes.map(n => n.page);
  ok(thinkUnits.join(',') === '44,WB-41', 'student book pages appear before workbook pages within a unit');
  for (const note of core.catalog) {
    const meta = context.PreviewNotes.unitMeta(note.book, note.unit);
    ok(meta && meta.en && meta.zh, 'unit metadata has English and Chinese titles for ' + note.id);
    ok(/[\u4e00-\u9fff]/.test(note.title) && /[A-Za-z]/.test(note.title), 'catalog note title is bilingual for ' + note.id);
  }
  const { ALLOWED_IDS } = require('./friendly_farm_loader.js');
  ok(ALLOWED_IDS.size === 30, 'friendly_farm_loader exposes 30 allowed lesson ids');
  for (const id of ALLOWED_IDS) {
    const note = core.catalog.find(n => n.id === id);
    ok(note && note.libraryOnly === true, id + ' exists in catalog as libraryOnly');
    ok(note.reader === 'friendly_farm_notes.html?id=' + id, id + ' uses shared comic reader URL');
    ok(!core.atPage(note.book, note.unit, note.page), id + ' never gates student placement atPage');
    const fakeEntry = { [id]: { version: note.version, completedAt: '2026-01-01T00:00:00.000Z' } };
    ok(!core.normalize(fakeEntry)[id], id + ' is ignored by normalize');
    const fakeEvent = [{ type: 'session', sessionType: 'study', timestamp: '2026-01-01T00:00:00.000Z', data: { previewNote: { id, version: note.version, book: note.book, unit: note.unit, page: note.page, wordCount: 5, exerciseCount: 5 } } }];
    ok(!core.fromEvents(fakeEvent)[id], id + ' is ignored by fromEvents');
  }
  const previewNotesSrc = fs.readFileSync('preview_notes.js', 'utf8');
  for (const note of core.catalog) {
    ok(previewNotesSrc.includes(`'${note.id}':`) || previewNotesSrc.includes(`"${note.id}":`), 'NOTE_THUMBS has thumbnail entry for ' + note.id);
  }
  const srcMatch = previewNotesSrc.match(/images\/notes_thumbs\/[^'"]+\.webp/g) || [];
  ok(srcMatch.length >= 86 && srcMatch.every(rel => fs.existsSync(rel)), 'all book page thumbnails exist on disk');
}
console.log(checks+' preview-note state/content checks passed');
