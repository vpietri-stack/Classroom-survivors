/* =========================================================================
 * speech_debug.js  —  TEMPORARY (debugging phase) on-screen speech diagnostics.
 *
 * Two jobs:
 *  1. Define window.__speechLog(msg) — the hook the speech engine/preload call
 *     but which was previously defined NOWHERE (so every diagnostic was lost).
 *  2. Render an always-visible panel showing the live model-load state
 *     (state / % / current file / chosen mirror / message) plus a rolling log,
 *     so we can see exactly where a load stalls on a real GFW / WeChat device
 *     (which has no devtools console).
 *
 * REMOVE THIS FILE (and its <script> tag in index.html) once speech loading is
 * confirmed reliable in production.
 *
 * Depends on: window.SpeechStatus (speech_preload.js), window.LocalEngine
 * (speech_engine.js). Loaded AFTER speech_ui.js and BEFORE speech_preload.js so
 * __speechLog exists before the preload kicks off the model load.
 * ========================================================================= */
(function (global) {
  'use strict';

  var MAX_LINES = 40;
  var buffer = [];

  function ts() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  // The missing diagnostic hook. Engine + preload call this; we keep a rolling
  // buffer and push it into the panel.
  global.__speechLog = function (msg) {
    buffer.push('[' + ts() + '] ' + msg);
    if (buffer.length > MAX_LINES) buffer.shift();
    renderLog();
  };

  // --- Panel construction ---------------------------------------------------
  var panel, stateEl, pctEl, fileEl, mirrorEl, msgEl, logEl, retryEl;

  function buildPanel() {
    if (document.getElementById('speechDebugPanel')) return;
    var st = document.createElement('style');
    st.textContent =
      '#speechDebugPanel{position:fixed;left:8px;bottom:8px;z-index:2147483647;' +
      'width:290px;max-width:44vw;max-height:42vh;display:flex;flex-direction:column;' +
      'background:rgba(15,23,42,.92);color:#e2e8f0;border:1px solid #334155;' +
      'border-radius:10px;padding:8px 10px;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.45);pointer-events:auto;}' +
      '#speechDebugPanel .sdg-title{font-weight:700;color:#fbbf24;margin-bottom:4px;' +
      'display:flex;justify-content:space-between;align-items:center;}' +
      '#speechDebugPanel .sdg-grid{display:grid;grid-template-columns:auto 1fr;gap:1px 8px;}' +
      '#speechDebugPanel .sdg-k{color:#94a3b8;}' +
      '#speechDebugPanel .sdg-v{color:#f1f5f9;word-break:break-all;}' +
      '#speechDebugPanel .sdg-log{margin-top:6px;border-top:1px solid #334155;padding-top:4px;' +
      'overflow-y:auto;white-space:pre-wrap;word-break:break-all;flex:1;min-height:40px;max-height:22vh;}' +
      '#speechDebugPanel .sdg-retry{margin-top:6px;display:none;background:#ef4444;color:#fff;' +
      'border:0;border-radius:6px;padding:5px 10px;font:inherit;font-weight:700;cursor:pointer;}';
    document.head.appendChild(st);

    panel = document.createElement('div');
    panel.id = 'speechDebugPanel';
    panel.innerHTML =
      '<div class="sdg-title"><span>\uD83D\uDC1E Speech debug</span><span id="sdgState">…</span></div>' +
      '<div class="sdg-grid">' +
      '<span class="sdg-k">progress</span><span class="sdg-v" id="sdgPct"></span>' +
      '<span class="sdg-k">file</span><span class="sdg-v" id="sdgFile"></span>' +
      '<span class="sdg-k">mirror</span><span class="sdg-v" id="sdgMirror"></span>' +
      '<span class="sdg-k">message</span><span class="sdg-v" id="sdgMsg"></span>' +
      '</div>' +
      '<div class="sdg-log" id="sdgLog"></div>' +
      '<button class="sdg-retry" id="sdgRetry">↻ Retry load</button>';
    document.body.appendChild(panel);

    stateEl = document.getElementById('sdgState');
    pctEl = document.getElementById('sdgPct');
    fileEl = document.getElementById('sdgFile');
    mirrorEl = document.getElementById('sdgMirror');
    msgEl = document.getElementById('sdgMsg');
    logEl = document.getElementById('sdgLog');
    retryEl = document.getElementById('sdgRetry');
    retryEl.onclick = function () {
      if (global.SpeechStatus && typeof global.SpeechStatus.retry === 'function') {
        global.__speechLog('Debug: manual retry requested');
        global.SpeechStatus.retry();
      }
    };
  }

  function renderLog() {
    if (!logEl) return;
    logEl.textContent = buffer.join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  }

  var STATE_COLOR = {
    ready: '#22c55e', error: '#ef4444', unsupported: '#f59e0b',
    loading: '#38bdf8', preparing: '#a78bfa', idle: '#94a3b8'
  };

  function render() {
    if (!panel) return;
    var s = global.SpeechStatus || {};
    var state = s.state || 'idle';
    if (stateEl) {
      stateEl.textContent = state;
      stateEl.style.color = STATE_COLOR[state] || '#e2e8f0';
    }
    if (pctEl) pctEl.textContent = (s.pct || 0) + '%';
    if (fileEl) fileEl.textContent = s.file || '—';
    var src = (global.LocalEngine && global.LocalEngine.chosenSource) ? global.LocalEngine.chosenSource() : null;
    if (mirrorEl) mirrorEl.textContent = src ? src.name : '—';
    if (msgEl) msgEl.textContent = s.message || '—';
    if (retryEl) retryEl.style.display = (state === 'error' || state === 'unsupported') ? 'block' : 'none';
  }

  function init() {
    buildPanel();
    render();
    setInterval(render, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
