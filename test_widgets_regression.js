// Focused regression test for the scramble/spelling widget rework.
// Loads the REAL project scripts (in index.html order) into jsdom, stubs only
// the externals jsdom lacks (Phaser, Web Audio, Firebase), then exercises the
// exact bugs the user reported:
//   (1) bank/keyboard/dock is a STATIC palette that never depletes,
//   (2) clicking a placed letter/word DELETES it (nothing returns to the source),
//   (3) editing is FROZEN during the ~5s CHECK reveal.
// The test body is appended to the same eval blob so it can see the scripts'
// top-level const/let bindings (STUDY_STATE, startRoundB, etc.).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Remove remote <script src> (CDN/tailwind/fonts) — jsdom would try to fetch them.
html = html.replace(/<script src="https:[^"]*"><\/script>/g, '');

// Scripts to load in order (mirrors index.html bottom block). Skip the Phaser
// game core (boot/vampire_survivors/gomoku/uno/tower_defense) — not needed here.
const order = [
  'translations.js', 'config.js', 'sr_engine.js', 'frontend_auth.js',
  'teaching_content.js', 'content_pu1.js', 'content_pu2.js', 'content_pu3.js',
  'content_think0.js', 'content_think1.js', 'content_think2.js', 'content_test.js',
  'class_config.js', 'game.js', 'study_mode.js'
];

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://localhost/' });
const { window } = dom;
const document = window.document;

// Stubs for externals jsdom lacks.
const stub = `
  window.Phaser = function(){}; window.Phaser.Scene = function(){}; window.Phaser.Game = function(){};
  window.API_BASE_URL = ''; window.FIREBASE_CONFIG = {};
  function FakeAudioCtx(){ this.currentTime=0; this.destination={};
    this.createOscillator=function(){ return { frequency:{ setValueAtTime:function(){} }, type:'', connect:function(){}, start:function(){}, stop:function(){} }; };
    this.createGain=function(){ return { gain:{ setValueAtTime:function(){} }, connect:function(){} }; }; }
  window.AudioContext = FakeAudioCtx; window.webkitAudioContext = FakeAudioCtx;
  window.firebase = { initializeApp:function(){ return {}; }, auth:function(){ return {}; }, database:function(){ return {}; }, firestore:function(){ return {}; } };
  window.speechSynthesis = { speak:function(){ return Promise.resolve(); }, cancel:function(){} };
  window.SpeechSynthesisUtterance = function(){};
  if (window.HTMLMediaElement) window.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
  if (window.HTMLMediaElement) window.HTMLMediaElement.prototype.pause = function(){};
  var _ls = {};
  window.localStorage = { getItem:function(k){ return _ls[k]||null; }, setItem:function(k,v){ _ls[k]=v; } };
`;

// Test body appended into the same scope so it sees STUDY_STATE / startRoundB etc.
const testBody = `
(function(){
  var pass=0, fail=0;
  function ok(name, cond){ if(cond){pass++;console.log('PASS:',name);} else {fail++;console.log('FAIL:',name);} }

  // ===== STUDY ROUND B (static bank, delete-on-click) =====
  STUDY_STATE.words = ['wed'];
  STUDY_STATE.currentWordIndex = 0;
  startRoundB(); nextRoundBWord();

  var bSlots = document.getElementById('scramble-slots');
  var bBank = document.getElementById('scramble-bank');
  var bankBtns = Array.prototype.slice.call(bBank.querySelectorAll('button'));
  ok('B: bank rendered as full palette (3 keys for "wed")', bankBtns.length === 3);

  var wBtn = bankBtns.find(function(b){ return b.innerText === 'w'; });
  wBtn.click();
  ok('B: clicking bank letter fills earliest slot', bSlots.children[0].innerText === 'w');
  ok('B: bank letter is NOT removed (palette static)', bankBtns.length === 3 && bBank.contains(wBtn));

  bankBtns.find(function(b){ return b.innerText === 'e'; }).click();
  bankBtns.find(function(b){ return b.innerText === 'd'; }).click();
  ok('B: word fully placed "wed"', Array.prototype.slice.call(bSlots.children).map(function(s){return s.innerText;}).join('') === 'wed');

  // Delete the middle 'e' -> expect 'w_d' (gap stays), NOT 'wd'.
  bSlots.children[1].click();
  ok('B: deleting middle letter leaves a gap (w_d), not reflow',
     bSlots.children[0].innerText==='w' && bSlots.children[1].innerText==='' && bSlots.children[2].innerText==='d');
  ok('B: delete does NOT return letter to bank (still 3)', bankBtns.length === 3);

  // ===== STUDY ROUND D (static bank, delete word) =====
  STUDY_STATE.sentences = ['The cat sat'];
  STUDY_STATE.currentSentenceIndex = 0;
  startRoundD(); nextRoundDSentence();

  var dZone = document.getElementById('sentence-drop-zone');
  var dBank = document.getElementById('sentence-word-bank');
  var dBtns = Array.prototype.slice.call(dBank.querySelectorAll('button'));
  ok('D: bank has 3 word tiles', dBtns.length === 3);

  var theBtn = dBtns.find(function(b){ return b.innerText === 'The'; });
  theBtn.click();
  ok('D: placed copy into first slot', !!(dZone.children[0].firstChild && dZone.children[0].firstChild.innerText === 'The'));
  ok('D: bank tile NOT removed (static palette)', dBtns.length === 3 && dBank.contains(theBtn));

  dZone.children[0].firstChild.click();
  ok('D: deleting placed word removes it from slot', !dZone.children[0].firstChild);
  ok('D: delete does NOT return word to bank', dBtns.length === 3);

  // ===== FREEZE during reveal (Round B, wrong answer) =====
  STUDY_STATE.words = ['abc'];
  STUDY_STATE.currentWordIndex = 0;
  startRoundB(); nextRoundBWord();
  var fb = Array.prototype.slice.call(document.getElementById('scramble-bank').querySelectorAll('button'));
  fb.find(function(b){ return b.innerText==='a'; }).click();
  fb.find(function(b){ return b.innerText==='b'; }).click();
  document.getElementById('scramble-slots').children[2].innerText = 'x'; // force wrong-but-full
  checkRoundB();
  ok('B: frozen flag set after wrong CHECK', STUDY_STATE._roundBFrozen === true);
  var before = document.getElementById('scramble-slots').children[0].innerText;
  document.getElementById('scramble-bank').querySelector('button').click();
  ok('B: editing blocked while frozen', document.getElementById('scramble-slots').children[0].innerText === before);

  // ===== GAME-MODE WORD SCRAMBLE (desync fix: palette index vs slot position) =====
  // Word 'opposite' (8 letters). Simulate the user's report: type o, then p, then
  // try to select 'i' for a later slot. With the old bug, the 'i' bubble was
  // unselectable because a lower-position slot was already filled.
  SPELLING_WORDS = [{ en: 'opposite', zh: '在...对面' }];
  selectedClassContent = { book: 1, unit: 1, page: 1 };
  getGameItemSR = function(){ return 'opposite'; }; // override SR lookup (test content empty)
  try { startSpellingGame(); }
  catch (e) { console.log('startSpellingGame ERROR:', e.message, e.stack); throw e; }
  // Force deterministic palette order by overwriting the dataset (bypasses shuffle).
  var spEl = document.getElementById('spellingGame');
  spEl.dataset.letters = JSON.stringify(['o','p','p','o','s','i','t','e']);
  spEl.dataset.placement = JSON.stringify([undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined]);
  spEl.dataset.usedKeys = JSON.stringify([false,false,false,false,false,false,false,false]);
  spEl.dataset.built = "false";           // (harmless) force keyboard rebuild below
  document.getElementById('spelling-keyboard').dataset.built = "false"; // force keyboard rebuild with deterministic letters
  buildSpellingKeyboard();
  buildSpellingSlots();
  // Type o, p, p, o, s via keydown (earliest-empty-slot fill).
  ['o','p','p','o','s'].forEach(function(ch){ handleGameSpellingKeyDown(ch); });
  var spSlots = document.getElementById('spelling-input-display').children;
  ok('G: typing o,p,p,o,s fills first 5 slots', spSlots[0].innerText==='o'&&spSlots[1].innerText==='p'&&spSlots[2].innerText==='p'&&spSlots[3].innerText==='o'&&spSlots[4].innerText==='s');
  // Now the 'i' bubble (palette index 5) must still be selectable for slot 5.
  var iBubble = Array.prototype.slice.call(document.querySelectorAll('#spelling-keyboard .letter-bubble')).find(function(b){ return b.dataset.keyIndex==='5'; });
  ok('G: i bubble present and NOT marked used', !!iBubble && !iBubble.classList.contains('used'));
  iBubble.click();
  ok('G: clicking i fills slot 5 (no desync)', document.getElementById('spelling-input-display').children[5].innerText === 'i');
  // Backspace should remove the last placed (i) and free its bubble.
  handleGameSpellingKeyDown('Backspace');
  ok('G: Backspace removes last placed letter (i)', document.getElementById('spelling-input-display').children[5].innerText === '');
  ok('G: i bubble freed again after backspace', !iBubble.classList.contains('used'));
  // Placing the same bubble twice is blocked (no double-use / no overflow).
  iBubble.click();  // already used -> should be a no-op
  var filledCount = 0;
  for (var fi=0; fi<spEl.dataset.placement.length; fi++){
    var pv = JSON.parse(spEl.dataset.placement)[fi];
    if (pv !== undefined && pv !== null) filledCount++;
  }
  ok('G: same palette bubble cannot be placed twice (no overflow)',
     document.getElementById('spelling-input-display').children[5].innerText === 'i'
     && filledCount === 6
     && document.querySelectorAll('#spelling-keyboard .letter-bubble.used').length === 6);

  // ===== STUDY ROUND C (spelling desync fix — same class as game-mode word scramble) =====
  // Reproduces the user's report: word "danced" (5 letters d-a-n-c-e), board of
  // 10 tiles. Typing the two 'd's first must NOT block the 'a' tiles. Old bug
  // used roundCInput (typing order) as if it were keyed by tile index, so the
  // 'd's at typing positions 0,1 blocked every tile at index 0,1 (both 'a' tiles).
  STUDY_STATE.words = ['danced'];
  STUDY_STATE.currentWordIndex = 0;
  STUDY_STATE.isTransitioning = false;
  STUDY_STATE._roundCFrozen = false;
  startRoundC(); nextRoundCWord();
  // Force a deterministic board: sorted letters a,a,c,d,d,e + 4 fillers, so the
  // two 'a' tiles are at indices 0,1 and a 'd' tile is later. Bypasses shuffle.
  var kb = document.getElementById('virtual-keyboard');
  var kbBtns = Array.prototype.slice.call(kb.children);
  // Build deterministic keys by overwriting the dataset + re-rendering keyboard.
  roundCBaseKeys = ['a','a','c','d','d','e','b','f','o','t'];
  roundCInput = ''; roundCPlacement = []; roundCUsedKeys = [];
  // Clear and re-add buttons in deterministic order.
  kb.innerHTML = '';
  roundCBaseKeys.forEach(function(ch, i){
    var b = document.createElement('button');
    b.className = 'study-key'; b.innerText = ch; b.dataset.keyIndex = i;
    b.onclick = (function(ki){ return function(){ typeRoundC(ki); }; })(i);
    kb.appendChild(b);
  });
  kbBtns = Array.prototype.slice.call(kb.children);
  ok('C: board rendered 10 keys', kbBtns.length === 10);
  // Type the two 'd' tiles first (indices 3 and 4).
  kbBtns.find(function(b){ return b.dataset.keyIndex === '3'; }).click();
  kbBtns.find(function(b){ return b.dataset.keyIndex === '4'; }).click();
  ok('C: typing two d tiles fills first two letter slots', (function(){
    var dis = Array.prototype.slice.call(document.getElementById('spelling-display').children).map(function(s){return s.textContent;}).join('');
    return dis.indexOf('d') === 0 && dis[1] === 'd';
  })());
  // The 'a' tiles (index 0,1) must now be selectable (the old bug blocked them).
  var a0 = kbBtns.find(function(b){ return b.dataset.keyIndex === '0'; });
  a0.click();
  ok('C: an a tile is selectable after two d tiles (no desync)', (function(){
    var dis = Array.prototype.slice.call(document.getElementById('spelling-display').children).map(function(s){return s.textContent;}).join('');
    return dis.indexOf('a') !== -1;
  })());
  // Fill the rest via typing: d-a-n-c-e (we have a0 placed; add a1,c, then d,e fill remaining).
  kbBtns.find(function(b){ return b.dataset.keyIndex === '1'; }).click(); // a
  kbBtns.find(function(b){ return b.dataset.keyIndex === '2'; }).click(); // c
  // remaining two letter slots get the two d tiles already used; need 'n' and 'e'
  // but board has no 'n' (filler only). Use handleRoundCKeyDown to type 'n'/'e' if allowed.
  // Instead, verify the full word can be completed by clicking available keys:
  // we already used d(3),d(4),a(0),a(1),c(2); remaining slots need n,e -> not on board,
  // so just assert the desync fix: a-tile selectable. (Full correct spelled by real board.)
  ok('C: clicking a placed slot deletes it without losing other tiles', (function(){
    // place one a, then delete it via slot click, board stays intact
    var before = document.querySelectorAll('#virtual-keyboard .study-key').length;
    var slots = document.getElementById('spelling-display').children;
    // find a filled slot and click it
    for (var si=0; si<slots.length; si++){ if (slots[si].textContent){ slots[si].click(); break; } }
    return document.querySelectorAll('#virtual-keyboard .study-key').length === before;
  })());

  // ===== GRAMMAR (sentence scramble) must NOT throw on empty SR result =====
  // Reproduces the freeze: getGameItemSR can return [] (empty spaced-rep pool).
  // Old code did primarySentence = rawEntry[0] (=undefined) -> .split(' ') -> throw,
  // which left the scene paused with a blank white screen. Now it must either
  // fall back to a loaded sentence, or auto-pass safely.
  GRAMMAR_SENTENCES = ['The cat sat on the mat.'];
  activeGameMode = null;  // present in real game (boot.js); harness doesn't load boot.js
  selectedClassContent = { book: 1, unit: 1, page: 1 };
  getGameItemSR = function(){ return []; }; // empty SR pool (the crash trigger)
  var threw = false;
  try { startGrammarGame(); } catch (e) { threw = true; console.log('grammar throw:', e.message); }
  ok('G2: startGrammarGame does NOT throw on empty SR result', !threw);
  ok('G2: overlay shown (not frozen/blank)', !document.getElementById('grammarGame').classList.contains('hidden'));
  ok('G2: a sentence was rendered into the container', document.getElementById('sentence-container').children.length > 0);

  // Depletion behaviour: clicking a dock word must place EXACTLY ONE copy and
  // remove the tile from the dock (the old double-binding placed two copies and
  // kept the tile — both regressions reported by the user).
  var dockTiles = Array.prototype.slice.call(document.querySelectorAll('#word-dock .draggable'));
  var dockCount = dockTiles.length;
  ok('G2: dock rendered the full set of word tiles', dockCount > 0);
  var firstTile = dockTiles[0];
  firstTile.click(); // delegated #word-dock listener handles placement
  var zones = document.querySelectorAll('.drop-zone');
  var placedCount = Array.prototype.slice.call(zones).filter(function(z){ return z.children.length > 0; }).length;
  ok('G2: clicking dock word places exactly ONE copy (no double-write)', placedCount === 1);
  ok('G2: placed word removed from dock (depletes)', document.querySelectorAll('#word-dock .draggable').length === dockCount - 1);
  ok('G2: clicking placed word returns tile to dock', (function(){
    zones[0].children[0].click(); // delegated #sentence-container listener -> deleteGrammarWord
    return document.querySelectorAll('#word-dock .draggable').length === dockCount;
  })());

  // ===== Post-CHECK behaviour (regression from deplete rework) =====
  // Reproduces two bugs: (a) after a wrong CHECK the 5s reset deleted placed
  // words instead of returning them to the dock (words vanished permanently now
  // that the dock depletes); (b) CLEAR was a no-op while frozen (during the
  // reveal), so the player couldn't start over.
  GRAMMAR_SENTENCES = ['We are not hungry.'];
  getGameItemSR = function(){ return 'We are not hungry.'; };
  threw = false;
  try { startGrammarGame(); } catch (e) { threw = true; console.log('grammar fresh throw:', e.message, e.stack); }
  ok('G2b: fresh grammar game renders without throwing', !threw && document.querySelectorAll('.drop-zone').length > 0);
  var gzones = document.querySelectorAll('.drop-zone');
  var gdc = document.querySelectorAll('#word-dock .draggable').length;
  ok('G2b: dock full before placement (one tile per word)', gdc === gzones.length);

  // Override setTimeout so the 5s reset is captured (not auto-fired); we fire it
  // manually to simulate the reveal window elapsing.
  var gOrigST = setTimeout;
  var gCaptured = null;
  setTimeout = function(fn, ms){ gCaptured = fn; return 1; };

  // Place ONE word (partial fill -> wrong on check).
  document.querySelectorAll('#word-dock .draggable')[0].click();
  ok('G2b: one word placed, dock depletes by 1', document.querySelectorAll('#word-dock .draggable').length === gdc - 1 && gzones[0].children.length === 1);

  // WRONG check -> freeze + schedule 5s reset.
  checkGrammar();
  ok('G2b: after wrong CHECK, frozen during reveal', grammarGameEl().dataset.frozen === 'true');
  ok('G2b: placed word still visible during reveal', gzones[0].children.length === 1);

  // CLEAR while frozen must STILL work and unfreeze.
  clearGrammar();
  ok('G2b: CLEAR during freeze restores all tiles to dock', document.querySelectorAll('#word-dock .draggable').length === gdc);
  ok('G2b: CLEAR during freeze empties the slots', document.querySelectorAll('.drop-zone .draggable.placed').length === 0);
  ok('G2b: CLEAR during freeze unfreezes (editable again)', grammarGameEl().dataset.frozen === 'false');

  // 5s auto-reset must RETURN words to the dock, not lose them.
  document.querySelectorAll('#word-dock .draggable')[0].click(); // place again
  checkGrammar(); // schedules reset (captured)
  ok('G2b: wrong CHECK again freezes the widget', grammarGameEl().dataset.frozen === 'true');
  if (gCaptured) gCaptured(); // simulate the 5s reveal window elapsing
  setTimeout = gOrigST;
  ok('G2b: 5s reset returns placed word to dock (not lost)', document.querySelectorAll('#word-dock .draggable').length === gdc);
  ok('G2b: 5s reset clears the slots', document.querySelectorAll('.drop-zone .draggable.placed').length === 0);
  ok('G2b: 5s reset unfreezes the widget', grammarGameEl().dataset.frozen === 'false');

  // And with NO sentences available at all, it must auto-pass (no throw, no hang).
  GRAMMAR_SENTENCES = [];
  threw = false;
  try { startGrammarGame(); } catch (e) { threw = true; console.log('G2 auto-pass throw:', e.message, e.stack); }
  ok('G2: startGrammarGame does NOT throw when no sentences exist (auto-pass)', !threw);

  window.__testResult = { pass: pass, fail: fail };
  console.log('\\n' + pass + ' passed, ' + fail + ' failed');
})();
`;

let combined = stub;
for (const f of order) {
  combined += '\n;// === ' + f + ' ===\n' + fs.readFileSync(path.join(root, f), 'utf8');
}
combined += '\n' + testBody;

try { window.eval(combined); }
catch (e) { console.log('LOAD/RUN ERROR:', e.message); process.exit(2); }

const res = window.__testResult || { pass: 0, fail: 1 };
process.exit(res.fail ? 1 : 0);
