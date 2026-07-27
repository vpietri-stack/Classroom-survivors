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
.speech-rec-btn{user-select:none;touch-action:none;transition:transform .06s;}
.speech-rec-btn:active{transform:scale(.97);}
.heard-feedback{font-size:15px;min-height:22px;margin-top:6px;}
.heard-feedback.ok{color:#22c55e;} .heard-feedback.no{color:#ef4444;}
/* Inline recording indicator (no overlay — sentence stays visible) */
.rec-inline{display:none;flex-direction:column;align-items:center;gap:8px;margin-top:10px;}
.rec-inline.show{display:flex;}
.rec-inline-bars{display:flex;align-items:flex-end;gap:3px;height:24px;}
.rec-inline-bars span{width:4px;background:#9be89b;border-radius:2px;height:4px;
  transition:height .08s ease-out;}
.rec-inline-label{display:flex;align-items:center;gap:8px;font-size:15px;color:#fca5a5;
  background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.4);border-radius:12px;
  padding:8px 18px;cursor:pointer;}
.rec-inline-label:active{transform:scale(.97);}
.rec-inline-label .sq{width:14px;height:14px;background:#ef4444;border-radius:3px;flex-shrink:0;}
.rec-inline-cancel{font-size:12px;color:#9ca3af;background:none;border:none;cursor:pointer;
  text-decoration:underline;padding:4px 8px;}
.rec-inline-cancel:active{color:#fff;}
`;
      document.head.appendChild(st);
    }
  }

  let _raf = null;
  let _inlineEl = null; // the inline recording indicator element
  let _onInlineStop = null;
  let _onInlineCancel = null;

  function loop() {
    if (!_inlineEl || !_inlineEl.classList.contains('show')) { _raf = null; return; }
    const lvl = (global.Recorder && global._activeRecorder) ? global._activeRecorder.level || 0 : 0;
    const bars = _inlineEl.querySelector('.rec-inline-bars');
    if (bars) {
      const n = bars.children.length;
      for (let i = 0; i < n; i++) {
        bars.children[i].style.height = (4 + lvl * 18 * (0.5 + 0.5 * Math.abs(Math.sin(i + performance.now() / 120)))).toFixed(0) + 'px';
      }
    }
    _raf = requestAnimationFrame(loop);
  }

  function showInline(parentEl) {
    injectAssets();
    if (!_inlineEl) {
      _inlineEl = document.createElement('div');
      _inlineEl.className = 'rec-inline';
      _inlineEl.innerHTML = `
        <div class="rec-inline-bars"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="rec-inline-label" id="recInlineStop"><span class="sq"></span>正在录音，点击停止</div>
        <button class="rec-inline-cancel" id="recInlineCancel" type="button">取消</button>`;
    }
    // Insert after the parent (record button area)
    if (parentEl && parentEl.parentNode && _inlineEl.parentNode !== parentEl.parentNode) {
      parentEl.parentNode.insertBefore(_inlineEl, parentEl.nextSibling);
    }
    _inlineEl.classList.add('show');
    // Wire stop/cancel
    const stopBtn = _inlineEl.querySelector('#recInlineStop');
    const cancelBtn = _inlineEl.querySelector('#recInlineCancel');
    stopBtn.onclick = function () { if (_onInlineStop) _onInlineStop(); };
    cancelBtn.onclick = function () { if (_onInlineCancel) _onInlineCancel(); };
    if (!_raf) _raf = requestAnimationFrame(loop);
  }

  function hideInline() {
    if (_inlineEl) _inlineEl.classList.remove('show');
    _onInlineStop = null;
    _onInlineCancel = null;
  }

  // Build a tap-to-toggle record button. Tap once to start recording, tap again
  // to stop + transcribe; onResult(text) is called with the transcript.
  //
  // Why tap-to-toggle (not hold-to-talk): the FIRST tap triggers the OS mic
  // permission prompt, which steals the pointer gesture — with hold-to-talk the
  // release (pointerup) was lost, so iPad got stuck "listening" with no way out
  // and Android errored on the first try. A discrete tap has no release to lose,
  // so the permission prompt is harmless. Safety nets guarantee we can never get
  // stuck: a max-duration auto-stop and an overlay Cancel button.
  //
  // opts: { label, idleText, color, onResult, onError }
  function makeRecordButton(opts) {
    opts = opts || {};
    injectAssets();
    const MAX_RECORD_MS = 15000; // safety: auto-stop a runaway recording
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'speech-rec-btn game-btn text-xl px-8 py-4 rounded-2xl shadow-lg';
    const rec = new global.Recorder();
    global._activeRecorder = rec; // so the overlay loop can read .level
    let state = 'idle'; // 'idle' | 'recording' | 'busy'
    let safetyTimer = null;
    let recStartTs = 0; // for telemetry: how long the student actually spoke

    function updateUI() {
      if (state === 'recording') {
        btn.innerText = '⏹ 停止录音';
        btn.classList.remove('bg-red-600', 'hover:bg-red-500');
        btn.classList.add('bg-rose-600', 'hover:bg-rose-500');
        btn.disabled = false;
      } else if (state === 'busy') {
        btn.innerText = '⏳ 识别中…';
        btn.disabled = true;
      } else {
        btn.innerText = opts.idleText || '🎙️ 点击说话';
        btn.classList.remove('bg-rose-600', 'hover:bg-rose-500');
        btn.classList.add('bg-red-600', 'hover:bg-red-500');
        btn.disabled = false;
      }
    }
    function clearSafety() { if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; } }
    function toIdle() { state = 'idle'; clearSafety(); hideInline(); updateUI(); }

    // Wire the inline indicator's Stop + Cancel (active while this button records).
    _onInlineStop = function () { if (state === 'recording') finishRecording(); };
    _onInlineCancel = function () { if (state === 'recording') cancelRecording(); };

    function startRecording() {
      if (state !== 'idle') return;
      if (!global.Recorder.isSupported()) {
        if (opts.onError) opts.onError(new Error('Microphone unavailable. Allow mic access in your browser/WeChat settings.'));
        else alert('Microphone unavailable. Allow mic access in your browser/WeChat settings.');
        return;
      }
      // The permission prompt may appear here; because this is a tap (not a hold),
      // there is no gesture to lose — we simply continue once permission resolves.
      rec.start().then(function () {
        state = 'recording';
        recStartTs = Date.now();
        showInline(btn);  // inline indicator, no overlay — sentence stays visible
        updateUI();
        clearSafety();
        safetyTimer = setTimeout(finishRecording, MAX_RECORD_MS);
      }).catch(function (err) {
        // Permission denied / mic error -> clean, retryable reset (no stuck state).
        toIdle();
        if (opts.onError) opts.onError(err);
        else alert('Mic error: ' + ((err && err.message) || err));
      });
    }

    function finishRecording() {
      if (state !== 'recording') return;
      state = 'busy';
      clearSafety();
      hideInline();
      updateUI();
      const audioMs = recStartTs ? Date.now() - recStartTs : null;
      rec.stop().then(function (blob) {
        if (!blob || !blob.size) { toIdle(); return; }
        const t0 = Date.now();
        return global.LocalEngine.transcribe(blob).then(function (r) {
          toIdle();
          if (opts.onResult) opts.onResult(r.text || '', {
            audioMs: audioMs,
            transcribeMs: Date.now() - t0,
            blobBytes: blob.size
          });
        });
      }).catch(function (err) {
        toIdle();
        if (opts.onError) opts.onError(err);
      });
    }

    function cancelRecording() {
      if (state !== 'recording') return;
      clearSafety();
      // Stop the mic but discard the audio (no transcription).
      rec.stop().catch(function () {});
      toIdle();
    }

    btn.addEventListener('click', function () {
      if (state === 'idle') startRecording();
      else if (state === 'recording') finishRecording();
      // 'busy' (transcribing): ignore taps.
    });
    updateUI();
    return btn;
  }

  // --- Speech telemetry ----------------------------------------------------
  // Every sentence-gate attempt is logged through the existing analytics
  // pipeline (queueExerciseEvent → saveAnalytics → Cosmos DB) so we can
  // diagnose WHY students fail: the raw transcript-vs-target pair separates
  // ASR failure (garbage transcript) from scorer strictness (near-miss).
  // Defensive no-op when analytics is unavailable (logged out / test mode) —
  // telemetry must never break the exercise.
  const UA = (navigator.userAgent || '').slice(0, 160);
  function logSpeechEvent(kind, mode, data, attempts) {
    try {
      if (typeof queueExerciseEvent === 'function') {
        queueExerciseEvent('speech_' + kind, mode || 'study', data, attempts || null);
      }
    } catch (_) { /* never let telemetry break the exercise */ }
  }

  // Build a self-contained "say the sentence aloud" gate (used after a correct
  // unscramble). Returns a DOM node with: prompt, hold-to-talk record button,
  // heard-feedback line, and a Skip button that appears only after 3 failed
  // attempts (so students genuinely try before they can bypass).
  // On a pass it plays the success sound, shows the score, and swaps in a
  // Continue button so the student controls when to advance.
  // Callers should only build this when SpeechStatus.isReady() is already true.
  //   opts: { target, level = 2, mode = 'study', onDone }
  //   mode tags telemetry events ('study' | 'game').
  //   onDone() is the single "advance" callback — fired on Continue (pass) OR Skip.
  function makeSentenceGate(opts) {
    opts = opts || {};
    injectAssets();
    const target = opts.target || '';
    const level = opts.level || 2;
    const mode = opts.mode || 'study';
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
    skip.innerText = '跳过 \u25B6';
    skip.style.display = 'none';
    skip.onclick = function () {
      if (!done) {
        done = true;
        // A skip after repeated fails is the strongest "recognition is broken
        // for this student" signal — record it with the fail count.
        logSpeechEvent('skip', mode, { target: target, level: level, failsBeforeSkip: failCount, ua: UA }, failCount);
        onDone();
      }
    };
    
    const recBtn = makeRecordButton({
      idleText: '\uD83C\uDF99\uFE0F \u70b9\u51fb\u8bf4\u8bdd',
      onResult: function (text, meta) {
        feedback.className = 'heard-feedback';
        feedback.innerText = '\u542c\u5230: \u201C' + (text || '(\u9759\u97f3)') + '\u201D';
        const res = global.Scorer.score(target, text, level);
        // Log EVERY attempt (pass or fail) with the full score breakdown — the
        // transcript is the diagnostic gold for the children's-voices problem.
        logSpeechEvent('attempt', mode, {
          target: target,
          transcript: text || '',
          pass: !!res.pass,
          accuracy: Math.round((res.accuracy || 0) * 1000) / 1000,
          phoneticRatio: Math.round((res.phoneticRatio || 0) * 1000) / 1000,
          edits: typeof res.edits === 'number' ? res.edits : null,
          level: level,
          details: res.details || '',
          audioMs: meta && typeof meta.audioMs === 'number' ? meta.audioMs : null,
          transcribeMs: meta && typeof meta.transcribeMs === 'number' ? meta.transcribeMs : null,
          blobBytes: meta && typeof meta.blobBytes === 'number' ? meta.blobBytes : null,
          ua: UA
        }, failCount + 1);
        if (res.pass) {
          // Passed: play the success sound, show the score, and replace the
          // record/skip buttons with a single Continue button so the student
          // decides when to advance.
          const pct = Math.round((res.accuracy || 0) * 100);
          feedback.className = 'heard-feedback ok';
          feedback.innerText += '  \u2713 得分: ' + pct + '%';
          // playHappySound is a global fn (study_mode.js) — reuse the existing
          // success sound rather than inventing a new one.
          if (typeof playHappySound === 'function') playHappySound();
          recBtn.style.display = 'none';
          skip.style.display = 'none';
          const cont = document.createElement('button');
          cont.className = 'game-btn bg-emerald-600 hover:bg-emerald-500 text-lg px-8 py-4 rounded-2xl shadow-lg';
          cont.innerText = '继续 \u25B6';
          cont.onclick = function () { if (!done) { done = true; onDone(); } };
          btns.appendChild(cont);
        } else {
          failCount++;
          feedback.className = 'heard-feedback no';
          feedback.innerText += '  \u2014 再试一次 (' + res.details + ')';
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
        feedback.innerText = '\u9519\u8bef: ' + ((err && err.message) || err);
        // Mic/engine errors are logged too — they can masquerade as "the model
        // doesn't understand me" from the student's point of view.
        logSpeechEvent('error', mode, { target: target, level: level, message: String((err && err.message) || err).slice(0, 200), ua: UA }, failCount + 1);
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
    makeRecordButton: makeRecordButton,
    makeSentenceGate: makeSentenceGate,
    ensureReady: ensureReady
  };
})(window);
