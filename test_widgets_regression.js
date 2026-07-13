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
