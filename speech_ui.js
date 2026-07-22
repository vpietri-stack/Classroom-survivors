/* =========================================================================
 * speech_ui.js  —  shared WeChat-style hold-to-talk UI for speech rounds.
 * Injects the recording overlay (frozen screen + listening bubble with live
 * mic level) once, and provides a record button + transcription helper used
 * by Study Round B and Game-mode word-rec.
 * Globals: window.SpeechUI
 * Depends on: window.Recorder, window.LocalEngine, window.Scorer, window.SpeechStatus
 * ========================================================================= */
(function (global) {
  'use strict';

  const CSS_ID = 'speech-ui-css';
  const OVERLAY_ID = 'recOverlay';

  function injectAssets() {
    if (!document.getElementById(CSS_ID)) {
      const st = document.createElement('style');
      st.id = CSS_ID;
      st.textContent = `
#${OVERLAY_ID}{position:fixed;inset:0;z-index:60;display:none;align-items:center;
  justify-content:center;background:rgba(0,0,0,.45);
  -webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);
  touch-action:none;user-select:none;}
#${OVERLAY_ID}.show{display:flex;}
.rec-bubble{background:#2f2f2f;color:#fff;border-radius:20px;padding:22px 28px 18px;
  display:flex;flex-direction:column;align-items:center;gap:12px;
  box-shadow:0 10px 40px rgba(0,0,0,.4);min-width:180px;}
.rec-mic{font-size:40px;line-height:1;transform:scale(1);transition:transform .06s ease-out;}
.rec-bars{display:flex;align-items:flex-end;gap:4px;height:34px;}
.rec-bars span{width:5px;background:#9be89b;border-radius:3px;height:6px;
  transition:height .08s ease-out;}
.rec-hint{font-size:13px;color:#d0d0d0;}
.rec-hint b{color:#fff;}
.speech-rec-btn{user-select:none;touch-action:none;transition:transform .06s;}
.speech-rec-btn:active{transform:scale(.97);}
.heard-feedback{font-size:15px;min-height:22px;margin-top:6px;}
.heard-feedback.ok{color:#22c55e;} .heard-feedback.no{color:#ef4444;}
`;
      document.head.appendChild(st);
    }
    if (!document.getElementById(OVERLAY_ID)) {
      const ov = document.createElement('div');
      ov.id = OVERLAY_ID;
      ov.innerHTML = `<div class="rec-bubble">
        <div class="rec-mic" id="recMic">🎙️</div>
        <div class="rec-bars" id="recBars">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="rec-hint">Listening… <b>release to send</b></div>
      </div>`;
      document.body.appendChild(ov);
    }
  }

  let _raf = null;
  function loop() {
    const ov = document.getElementById(OVERLAY_ID);
    if (!ov || !ov.classList.contains('show')) { _raf = null; return; }
    const lvl = (global.Recorder && global._activeRecorder) ? global._activeRecorder.level || 0 : 0;
    const mic = document.getElementById('recMic');
    if (mic) mic.style.transform = 'scale(' + (1 + Math.min(1, lvl) * 0.35).toFixed(3) + ')';
    const bars = document.getElementById('recBars');
    if (bars) {
      const n = bars.children.length;
      for (let i = 0; i < n; i++) {
        const h = 6 + Math.max(0, Math.sin(i * 0.9 + performance.now() / 90)) * 10 + lvl * 22;
        bars.children[i].style.height = (6 + lvl * 26 * (0.5 + 0.5 * Math.abs(Math.sin(i + performance.now() / 120)))).toFixed(0) + 'px';
      }
    }
    _raf = requestAnimationFrame(loop);
  }

  function showOverlay() {
    injectAssets();
    const ov = document.getElementById(OVERLAY_ID);
    ov.classList.add('show');
    if (!_raf) _raf = requestAnimationFrame(loop);
  }
  function hideOverlay() {
    const ov = document.getElementById(OVERLAY_ID);
    if (ov) ov.classList.remove('show');
  }

  // Build a hold-to-talk record button. onResult(text) called with transcript on release.
  // opts: { label, idleText, color }
  function makeRecordButton(opts) {
    opts = opts || {};
    injectAssets();
    const btn = document.createElement('button');
    btn.className = 'speech-rec-btn game-btn text-xl px-8 py-4 rounded-2xl shadow-lg ' +
      (opts.color || 'bg-red-600 hover:bg-red-500');
    btn.innerText = opts.idleText || '🎙️ Hold to speak';
    const rec = new global.Recorder();
    global._activeRecorder = rec; // so the overlay loop can read .level
    let busy = false, pointerDown = false;

    function start(e) {
      if (busy) return;
      if (!global.Recorder.isSupported()) {
        alert('Microphone unavailable. Allow mic access in your browser/WeChat settings.');
        return;
      }
      pointerDown = true;
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      btn.innerText = opts.label || '🔴 Listening… release to send';
      showOverlay();
      rec.start().catch(function (err) {
        hideOverlay();
        pointerDown = false;
        btn.innerText = opts.idleText || '🎙️ Hold to speak';
        alert('Mic error: ' + (err && err.message || err));
      });
    }
    function stop() {
      if (!pointerDown) return;
      pointerDown = false;
      btn.innerText = '⏳ …';
      hideOverlay();
      rec.stop().then(function (blob) {
        if (!blob || !blob.size) { btn.innerText = opts.idleText || '🎙️ Hold to speak'; return; }
        if (busy) return;
        busy = true;
        return global.LocalEngine.transcribe(blob).then(function (r) {
          busy = false;
          btn.innerText = opts.idleText || '🎙️ Hold to speak';
          if (opts.onResult) opts.onResult(r.text || '');
        }).catch(function (err) {
          busy = false;
          btn.innerText = opts.idleText || '🎙️ Hold to speak';
          if (opts.onError) opts.onError(err);
        });
      }).catch(function (err) {
        busy = false;
        hideOverlay();
        btn.innerText = opts.idleText || '🎙️ Hold to speak';
        if (opts.onError) opts.onError(err);
      });
    }

    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('lostpointercapture', stop);
    return btn;
  }

  // Build a self-contained "say the sentence aloud" gate (used after a correct
  // unscramble). Returns a DOM node with: prompt, hold-to-talk record button,
  // heard-feedback line, and a Skip button that appears only after 3 failed
  // attempts (so students genuinely try before they can bypass).
  // On a pass it plays the success sound, shows the score, and swaps in a
  // Continue button so the student controls when to advance.
  // Callers should only build this when SpeechStatus.isReady() is already true.
  //   opts: { target, level = 2, onDone }
  //   onDone() is the single "advance" callback — fired on Continue (pass) OR Skip.
  function makeSentenceGate(opts) {
    opts = opts || {};
    injectAssets();
    const target = opts.target || '';
    const level = opts.level || 2;
    const onDone = typeof opts.onDone === 'function' ? opts.onDone : function () {};

    const wrap = document.createElement('div');
    wrap.className = 'speech-sentence-gate mt-4 text-center';
    wrap.innerHTML =
      '<div class="text-lg text-white mb-2">\uD83C\uDFA4 Now say it: <b class="text-emerald-300"></b></div>' +
      '<div class="speech-gate-btns flex items-center justify-center gap-3 flex-wrap"></div>' +
      '<div class="heard-feedback"></div>';
    // Set target as text (avoids HTML-injection from content strings).
    wrap.querySelector('b').textContent = target;

    const btns = wrap.querySelector('.speech-gate-btns');
    const feedback = wrap.querySelector('.heard-feedback');
    let done = false;
    let failCount = 0;
    const SKIP_AFTER_FAILS = 3; // let the student try 3 times before offering Skip

    const skip = document.createElement('button');
    skip.className = 'game-btn bg-slate-600 hover:bg-slate-500 text-base px-5 py-3 rounded-2xl';
    skip.innerText = 'Skip \u25B6';
    skip.style.display = 'none';
    skip.onclick = function () { if (!done) { done = true; onDone(); } };

    const recBtn = makeRecordButton({
      idleText: '\uD83C\uDF99\uFE0F Hold to speak',
      label: '\uD83D\uDD34 Listening\u2026 release to send',
      onResult: function (text) {
        feedback.className = 'heard-feedback';
        feedback.innerText = 'Heard: \u201C' + (text || '(silence)') + '\u201D';
        const res = global.Scorer.score(target, text, level);
        if (res.pass) {
          // Passed: play the success sound, show the score, and replace the
          // record/skip buttons with a single Continue button so the student
          // decides when to advance.
          const pct = Math.round((res.accuracy || 0) * 100);
          feedback.className = 'heard-feedback ok';
          feedback.innerText += '  \u2713 Score: ' + pct + '%';
          // playHappySound is a global fn (study_mode.js) — reuse the existing
          // success sound rather than inventing a new one.
          if (typeof playHappySound === 'function') playHappySound();
          recBtn.style.display = 'none';
          skip.style.display = 'none';
          const cont = document.createElement('button');
          cont.className = 'game-btn bg-emerald-600 hover:bg-emerald-500 text-lg px-8 py-4 rounded-2xl shadow-lg';
          cont.innerText = 'Continue \u25B6';
          cont.onclick = function () { if (!done) { done = true; onDone(); } };
          btns.appendChild(cont);
        } else {
          failCount++;
          feedback.className = 'heard-feedback no';
          feedback.innerText += '  \u2014 try again (' + res.details + ')';
          // synthError is a global lexical fn (defined in game.js); call it the
          // same defensive way the rest of the codebase does.
          if (typeof synthError === 'function') synthError();
          // Reveal Skip only after several failed attempts so no student is
          // permanently stuck on a wonky recognition.
          if (failCount >= SKIP_AFTER_FAILS) skip.style.display = '';
        }
      },
      onError: function (err) {
        feedback.className = 'heard-feedback no';
        feedback.innerText = 'Error: ' + ((err && err.message) || err);
        // A hard mic/engine error also counts toward revealing Skip.
        failCount++;
        if (failCount >= SKIP_AFTER_FAILS) skip.style.display = '';
      }
    });

    btns.appendChild(recBtn);
    btns.appendChild(skip);
    return wrap;
  }

  // Wait until the model is ready; call done() immediately if already ready,
  // otherwise poll SpeechStatus. Returns a cancel function.
  function ensureReady(done, tick) {
    if (global.SpeechStatus && global.SpeechStatus.isReady()) { done(); return function () {}; }
    let cancelled = false;
    const iv = setInterval(function () {
      if (cancelled) return;
      if (tick) tick(global.SpeechStatus);
      if (global.SpeechStatus && global.SpeechStatus.isReady()) {
        clearInterval(iv); done();
      } else if (global.SpeechStatus && global.SpeechStatus.state === 'error') {
        clearInterval(iv); if (tick) tick(global.SpeechStatus);
      }
    }, 400);
    return function () { cancelled = true; clearInterval(iv); };
  }

  global.SpeechUI = {
    injectAssets: injectAssets,
    showOverlay: showOverlay,
    hideOverlay: hideOverlay,
    makeRecordButton: makeRecordButton,
    makeSentenceGate: makeSentenceGate,
    ensureReady: ensureReady
  };
})(window);
