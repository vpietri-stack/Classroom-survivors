/* =========================================================================
 * speech_sample_capture.js — TEMPORARY research collection (one week).
 *
 * Stores the WAV the recogniser already received, for consented students only,
 * so candidate models and scoring changes can finally be evaluated against real
 * classroom voices. The app has never kept audio, which is why no ASR change
 * could ever be measured before. See
 * docs/research/2026-10-10-speech-improvement-research.md.
 *
 * HARD SAFETY RULES — this module is inert unless every one holds:
 *   1. the server said this exact student is consented (checked once per
 *      session; the consent list is an app setting, never in this repo);
 *   2. the capture window is still open, checked HERE as well as server-side,
 *      so no audio is even encoded once the collection closes;
 *   3. the per-student sample cap has not been reached.
 *
 * It never throws into the game path, never blocks an attempt, and drops
 * samples on any upload failure — this is a research sample, not a ledger.
 *
 * REMOVE THIS FILE, its <script> tag and the two API functions once the
 * calibration set is built. The server-side window check means it goes inert
 * on 2026-10-17 even if it is forgotten.
 * ========================================================================= */
(function (global) {
  'use strict';

  // Mirrors the server default. The server is authoritative; this only stops
  // the client from encoding and sending audio it knows will be refused.
  const CAPTURE_ENDS_AT = Date.parse('2026-10-17T00:00:00+08:00');
  const MAX_SAMPLES_PER_STUDENT = 60;
  const MAX_WAV_BYTES = 1_200_000; // raw WAV cap; base64 inflates ~1.33x
  const UPLOAD_GAP_MS = 2500;      // pace writes: the Cosmos autoscale ceiling
                                   // (1000 RU/s) is shared with the container
                                   // that saves student progress
  const CAP_KEY_PREFIX = 'csSpeechSamplesSent_';

  let consent = null;        // { consented, open, endsAt } once fetched
  let consentRequested = false;
  const queue = [];
  let uploading = false;
  let sentThisSession = 0;

  // Pure decision, exported for unit tests (no DOM, no network, no clock).
  // Returns { ok: true } or { ok: false, reason }.
  function decideCapture(input) {
    const i = input || {};
    if (!i.consented) return { ok: false, reason: 'not_consented' };
    const endsAt = Number(i.endsAt) || CAPTURE_ENDS_AT;
    if (!(Number(i.nowMs) < endsAt)) return { ok: false, reason: 'window_closed' };
    if (!(Number(i.blobSize) > 0)) return { ok: false, reason: 'no_audio' };
    if (Number(i.blobSize) > MAX_WAV_BYTES) return { ok: false, reason: 'too_large' };
    if (Number(i.sentCount) >= MAX_SAMPLES_PER_STUDENT) return { ok: false, reason: 'cap_reached' };
    return { ok: true };
  }

  function studentId() {
    try {
      if (typeof authActiveUser !== 'undefined' && authActiveUser && authActiveUser.id) return authActiveUser.id;
    } catch (_) {}
    return null;
  }

  function capKey(id) { return CAP_KEY_PREFIX + id; }

  function readSentCount(id) {
    try { return Number(global.localStorage.getItem(capKey(id))) || 0; } catch (_) { return 0; }
  }
  function writeSentCount(id, n) {
    try { global.localStorage.setItem(capKey(id), String(n)); } catch (_) {}
  }

  function apiBase() {
    try {
      if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) return API_BASE_URL;
    } catch (_) {}
    return '/api';
  }

  // Ask the server once per session whether this student may be recorded.
  // Until it answers yes, nothing is captured — fail closed.
  function ensureConsent(done) {
    if (consent) { done(consent); return; }
    if (consentRequested) { done({ consented: false, open: false, endsAt: 0 }); return; }
    consentRequested = true;
    const finish = function (c) { consent = c; done(c); };
    try {
      const url = apiBase() + '/speechSampleConsent';
      const req = (typeof apiFetch === 'function')
        ? apiFetch(url, { method: 'GET' })
        : global.fetch(url, { method: 'GET' });
      Promise.resolve(req)
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (j) {
          finish(j && typeof j.consented === 'boolean'
            ? { consented: !!j.consented, open: !!j.open, endsAt: Number(j.endsAt) || CAPTURE_ENDS_AT }
            : { consented: false, open: false, endsAt: CAPTURE_ENDS_AT });
        })
        .catch(function () { finish({ consented: false, open: false, endsAt: CAPTURE_ENDS_AT }); });
    } catch (_) {
      finish({ consented: false, open: false, endsAt: CAPTURE_ENDS_AT });
    }
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      try {
        const fr = new global.FileReader();
        fr.onload = function () {
          const s = String(fr.result || '');
          const comma = s.indexOf(',');
          resolve(comma >= 0 ? s.slice(comma + 1) : s);
        };
        fr.onerror = function () { reject(fr.error || new Error('read failed')); };
        fr.readAsDataURL(blob);
      } catch (e) { reject(e); }
    });
  }

  // Called by the sentence gate after scoring. `sample` carries the blob plus
  // everything worth keeping for offline analysis. Returns immediately.
  function maybeCapture(sample) {
    try {
      if (!sample || !sample.blob) return;
      const id = studentId();
      if (!id) return;
      ensureConsent(function (c) {
        try {
          const decision = decideCapture({
            consented: !!(c && c.consented),
            endsAt: c && c.endsAt,
            nowMs: Date.now(),
            blobSize: sample.blob.size,
            sentCount: readSentCount(id) + sentThisSession
          });
          if (!decision.ok) return;
          queue.push({ id: id, sample: sample });
          pump();
        } catch (_) { /* never break the exercise */ }
      });
    } catch (_) { /* never break the exercise */ }
  }

  function pump() {
    if (uploading || !queue.length) return;
    uploading = true;
    const item = queue.shift();
    sendOne(item)
      .catch(function () { /* drop; a sample is not worth retrying */ })
      .then(function () {
        // Pace the next write so a burst cannot throttle the container that
        // saves student progress.
        setTimeout(function () { uploading = false; pump(); }, UPLOAD_GAP_MS);
      });
  }

  function sendOne(item) {
    const s = item.sample;
    return blobToBase64(s.blob).then(function (wavBase64) {
      if (!wavBase64 || wavBase64.length > MAX_WAV_BYTES * 1.4) return null;
      const payload = {
        student: s.student || '',
        target: s.target || '',
        transcript: s.transcript || '',
        pass: !!s.pass,
        accuracy: s.accuracy,
        phoneticRatio: s.phoneticRatio,
        attempt: s.attempt,
        level: s.level,
        book: s.book || '',
        mode: s.mode || '',
        audioMs: s.audioMs,
        durMs: s.durMs,
        peak: s.peak,
        sampleRate: s.sampleRate,
        transcribeMs: s.transcribeMs,
        details: s.details || '',
        ua: s.ua || '',
        capturedAt: s.capturedAt || Date.now(),
        wavBase64: wavBase64
      };
      const url = apiBase() + '/saveSpeechSample';
      const req = (typeof apiFetch === 'function')
        ? apiFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : global.fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
      return Promise.resolve(req).then(function (r) {
        if (r && (r.status === 201 || r.status === 200)) {
          sentThisSession++;
          writeSentCount(item.id, readSentCount(item.id) + 1);
        }
        return r;
      });
    });
  }

  // Small read-only view for the debug panel / console diagnosis.
  function status() {
    return {
      consent: consent,
      queued: queue.length,
      uploading: uploading,
      sentThisSession: sentThisSession,
      endsAt: new Date((consent && consent.endsAt) || CAPTURE_ENDS_AT).toISOString()
    };
  }

  global.SpeechSampleCapture = { maybeCapture: maybeCapture, ensureConsent: ensureConsent, decideCapture: decideCapture, status: status, MAX_SAMPLES_PER_STUDENT: MAX_SAMPLES_PER_STUDENT };
})(window);
