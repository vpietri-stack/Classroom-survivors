/* =========================================================================
 * handwriting_sample_capture.js — research collection for the handwriting round.
 *
 * Keeps the pen strokes each student actually drew, the letter they were aiming
 * at, and the verdict the shipped geometry reached, so the accept/reject bars
 * can finally be tuned against real children's ink instead of synthetic pen
 * paths. Nothing was ever kept before, which is why a wrongly rejected letter
 * could only ever be reported anecdotally.
 *
 * HARD SAFETY RULES — this module is inert unless every one holds:
 *   1. the server said this exact student may be recorded (checked once per
 *      session; the enable list is an app setting, never in this repo);
 *   2. the capture window is still open, checked HERE as well as server-side;
 *   3. the per-student daily word cap has not been reached.
 *
 * Traces are buffered in memory and only leave the device when a whole word is
 * finished and all three rules pass, so a student who is not being recorded
 * never sends anything at all.
 *
 * It never throws into the game path, never blocks or delays a letter, and drops
 * traces on any upload failure — this is a research sample, not a ledger.
 *
 * REMOVE THIS FILE, its <script> tag, the two API functions and the study_mode
 * hooks once the recognition work is finished. The server-side window check
 * means it goes inert on the deadline even if it is forgotten.
 * ========================================================================= */
(function (global) {
  'use strict';

  // Mirrors the server default. The server is authoritative (the config response
  // carries its instant); this only stops the client from building payloads it
  // knows will be refused.
  const CAPTURE_ENDS_AT = Date.parse('2027-01-31T00:00:00+08:00');
  const DEFAULT_MAX_WORDS_PER_DAY = 40;
  const MAX_LETTERS_PER_WORD = 20;
  const UPLOAD_GAP_MS = 2500;   // pace writes: the Cosmos autoscale ceiling
                                // (1000 RU/s) is shared with the container that
                                // saves student progress
  const KEY_PREFIX = 'csHwWordsSent_';
  // The server counts the day in China time, so the client must too — a UTC
  // midnight would split one morning's lesson across two counters.
  const CN_OFFSET_MS = 8 * 60 * 60 * 1000;

  let config = null;          // { enabled, open, endsAt, maxPerDay }
  let configRequested = false;
  let current = null;         // the word being written, buffered in memory
  const queue = [];
  let uploading = false;

  // Pure decision, exported for unit tests (no DOM, no network, no clock).
  // Returns { ok: true } or { ok: false, reason }.
  function decideCapture(input) {
    const i = input || {};
    if (!i.enabled) return { ok: false, reason: 'not_enabled' };
    const endsAt = Number(i.endsAt) || CAPTURE_ENDS_AT;
    if (!(Number(i.nowMs) < endsAt)) return { ok: false, reason: 'window_closed' };
    if (!(Number(i.letters) > 0)) return { ok: false, reason: 'no_traces' };
    const cap = Number(i.maxPerDay) > 0 ? Number(i.maxPerDay) : DEFAULT_MAX_WORDS_PER_DAY;
    if (Number(i.sentToday) >= cap) return { ok: false, reason: 'cap_reached' };
    return { ok: true };
  }

  function studentId() {
    try {
      if (typeof authActiveUser !== 'undefined' && authActiveUser && authActiveUser.id) return authActiveUser.id;
    } catch (_) {}
    return null;
  }

  function studentName() {
    try {
      if (typeof authActiveUser !== 'undefined' && authActiveUser && authActiveUser.name) return authActiveUser.name;
    } catch (_) {}
    return '';
  }

  function dayKey(nowMs) {
    return new Date(nowMs + CN_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, '');
  }

  function readSentToday(id, nowMs) {
    try {
      const raw = global.localStorage.getItem(KEY_PREFIX + id);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return (parsed && parsed.d === dayKey(nowMs === undefined ? Date.now() : nowMs))
        ? (Number(parsed.n) || 0)
        : 0;
    } catch (_) { return 0; }
  }

  // One key per student, overwritten when the day rolls over — a key per day
  // would accumulate forever on a shared classroom tablet.
  function writeSentToday(id, n, nowMs) {
    try {
      global.localStorage.setItem(KEY_PREFIX + id, JSON.stringify({
        d: dayKey(nowMs === undefined ? Date.now() : nowMs),
        n: n
      }));
    } catch (_) {}
  }

  function apiBase() {
    try {
      if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) return API_BASE_URL;
    } catch (_) {}
    return '/api';
  }

  function fetchJson(url, options) {
    const req = (typeof apiFetch === 'function') ? apiFetch(url, options) : global.fetch(url, options);
    return Promise.resolve(req);
  }

  // Ask the server once per session whether this student may be recorded. Until
  // it answers yes, nothing is uploaded — fail closed. The server re-checks on
  // every upload, so a stale answer here can only cost bandwidth, never privacy.
  function ensureConfig(done) {
    if (config) { done(config); return; }
    if (configRequested) { done({ enabled: false, open: false, endsAt: 0, maxPerDay: 0 }); return; }
    configRequested = true;
    const finish = function (c) { config = c; done(c); };
    try {
      fetchJson(apiBase() + '/handwritingCaptureConfig', { method: 'GET' })
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (j) {
          finish(j && typeof j.enabled === 'boolean'
            ? {
                enabled: !!j.enabled,
                open: !!j.open,
                endsAt: Number(j.endsAt) || CAPTURE_ENDS_AT,
                maxPerDay: Number(j.maxPerDay) > 0 ? Number(j.maxPerDay) : DEFAULT_MAX_WORDS_PER_DAY
              }
            : { enabled: false, open: false, endsAt: CAPTURE_ENDS_AT, maxPerDay: DEFAULT_MAX_WORDS_PER_DAY });
        })
        .catch(function () { finish({ enabled: false, open: false, endsAt: CAPTURE_ENDS_AT, maxPerDay: DEFAULT_MAX_WORDS_PER_DAY }); });
    } catch (_) {
      finish({ enabled: false, open: false, endsAt: CAPTURE_ENDS_AT, maxPerDay: DEFAULT_MAX_WORDS_PER_DAY });
    }
  }

  function round2(n) {
    const v = Number(n);
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  }

  function intOr(n, fallback) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? v : fallback;
  }

  // Start buffering a word. Called by the handwriting round before each item;
  // cheap enough to call unconditionally, because nothing is decided here.
  function beginWord(meta) {
    try {
      current = { meta: meta || {}, letters: [], geometry: null };
      ensureConfig(function () {});   // warm the answer so the flush is not waiting on it
    } catch (_) { current = null; }
  }

  // Add one judged letter. `trace` is the widget's own snapshot (strokes plus the
  // engine constants it ran under); `scores` is the geometry's verdict detail.
  function recordLetter(rec) {
    try {
      if (!rec || !current || !rec.trace) return;
      if (current.letters.length >= MAX_LETTERS_PER_WORD) return;
      const strokes = rec.trace.s;
      if (!strokes || !strokes.length) return;
      const sc = rec.scores || {};
      current.geometry = {
        engine: intOr(rec.trace.engine, 0),
        size: intOr(rec.trace.size, 0),
        pen: intOr(rec.trace.pen, 0),
        tol: intOr(rec.trace.tol, 0),
        boxPx: intOr(rec.trace.boxPx, 0),
        dpr: round2(rec.trace.dpr)
      };
      current.letters.push({
        ch: String(rec.ch || (rec.trace.target || '')).slice(0, 2),
        ok: !!rec.ok,
        att: Math.max(1, intOr(rec.attempt, 1)),
        gui: !!rec.guided,
        rev: !!rec.revealed,
        ms: Math.max(0, intOr(rec.ms, 0)),
        p: round2(sc.precision),
        r: round2(sc.recall),
        mi: round2(sc.missingPart),
        wr: round2(sc.widthRatio),
        hr: round2(sc.heightRatio),
        st: intOr(sc.strokeCount, 0),
        mn: intOr(sc.minStrokes, 0),
        ov: !!sc.overfilled,
        s: strokes
      });
    } catch (_) { /* never break the exercise */ }
  }

  // Finish the word: decide, and queue it if the rules pass. Also called when the
  // student leaves study mode mid-word, so a partial word is not thrown away —
  // the letters a child gave up on are the most interesting ones we have.
  function endWord() {
    try {
      const buf = current;
      current = null;
      if (!buf || !buf.letters.length) return;
      ensureConfig(function (c) {
        try {
          const id = studentId();
          if (!id) return;
          const nowMs = Date.now();
          const reserved = queue.length + (uploading ? 1 : 0);
          const cap = Number(c && c.maxPerDay) > 0 ? Number(c.maxPerDay) : DEFAULT_MAX_WORDS_PER_DAY;
          const decision = decideCapture({
            enabled: !!(c && c.enabled),
            endsAt: c && c.endsAt,
            nowMs: nowMs,
            letters: buf.letters.length,
            maxPerDay: cap,
            sentToday: readSentToday(id, nowMs) + reserved
          });
          if (!decision.ok) return;
          queue.push({ id: id, cap: cap, payload: buildPayload(buf, nowMs) });
          pump();
        } catch (_) { /* never break the exercise */ }
      });
    } catch (_) { /* never break the exercise */ }
  }

  function buildPayload(buf, nowMs) {
    const g = buf.geometry || {};
    return {
      student: studentName(),
      word: buf.meta.word || '',
      book: buf.meta.book || '',
      unit: buf.meta.unit || '',
      mode: buf.meta.mode || 'study',
      capturedAt: nowMs,
      engine: g.engine || 0,
      size: g.size || 0,
      pen: g.pen || 0,
      tol: g.tol || 0,
      boxPx: g.boxPx || 0,
      dpr: g.dpr || 0,
      ua: (global.navigator && global.navigator.userAgent ? String(global.navigator.userAgent) : '').slice(0, 160),
      letters: buf.letters
    };
  }

  function pump() {
    if (uploading || !queue.length) return;
    uploading = true;
    const item = queue.shift();
    sendOne(item)
      .catch(function () { /* drop; a trace is not worth retrying */ })
      .then(function () {
        // Pace the next write so a burst cannot throttle the container that
        // saves student progress.
        setTimeout(function () { uploading = false; pump(); }, UPLOAD_GAP_MS);
      });
  }

  function sendOne(item) {
    const body = JSON.stringify(item.payload);
    return fetchJson(apiBase() + '/saveHandwritingSample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    }).then(function (r) {
      if (!r) return r;
      if (r.status === 201) {
        writeSentToday(item.id, readSentToday(item.id) + 1);
      } else if (r.status === 200) {
        // Skipped: cap reached or capture switched off for this student. Adopt
        // the server's answer so the rest of the day stays quiet.
        return Promise.resolve(r.json()).then(function (j) {
          if (j && j.skipped === 'cap_reached') writeSentToday(item.id, item.cap);
          if (j && j.skipped === 'not_enabled' && config) config.enabled = false;
          return r;
        }).catch(function () { return r; });
      }
      return r;
    });
  }

  // Small read-only view for the console and the dev harness.
  function status() {
    let buffered = 0;
    try { buffered = current ? current.letters.length : 0; } catch (_) {}
    const id = studentId();
    return {
      config: config,
      buffered: buffered,
      queued: queue.length,
      uploading: uploading,
      sentToday: id ? readSentToday(id) : 0,
      endsAt: new Date((config && config.endsAt) || CAPTURE_ENDS_AT).toISOString()
    };
  }

  global.HandwritingSampleCapture = {
    beginWord: beginWord,
    recordLetter: recordLetter,
    endWord: endWord,
    ensureConfig: ensureConfig,
    decideCapture: decideCapture,
    readSentToday: readSentToday,
    writeSentToday: writeSentToday,
    dayKey: dayKey,
    status: status,
    DEFAULT_MAX_WORDS_PER_DAY: DEFAULT_MAX_WORDS_PER_DAY,
    MAX_LETTERS_PER_WORD: MAX_LETTERS_PER_WORD
  };
})(window);
