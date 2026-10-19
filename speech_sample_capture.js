/* Temporary consented audio research. Server switch is OFF by default.
 * This queue is disposable and never touches the student-progress queue.
 * Closed at the end of 2026-10-25 China time, even on a stale client.
 */
(function (global) {
  'use strict';
  const CAPTURE_ENDS_AT = Date.parse('2026-10-26T00:00:00+08:00');
  const MAX_SAMPLES_PER_STUDENT = 30;
  const MAX_WAV_BYTES = 300000;
  const MAX_PENDING = 2; // includes consent lookup, encoding and in-flight upload
  const REQUEST_TIMEOUT_MS = 8000;
  const SAMPLE_MAX_AGE_MS = 30000;
  const UPLOAD_GAP_MS = 5000;
  const CONSENT_TTL_MS = 60000;
  const CAP_KEY_PREFIX = 'csSpeechSamplesSent_';
  let owner = null, consent = null, consentPromise = null;
  let queue = [], active = null, wakeTimer = null, cancelRequest = null;
  let backoffUntil = 0, sentThisSession = 0;
  const dropped = {};

  function drop(reason) { dropped[reason] = (dropped[reason] || 0) + 1; }
  function identity() {
    try {
      const user = typeof authActiveUser !== 'undefined' && authActiveUser;
      const token = typeof getSessionToken === 'function' ? getSessionToken() : global.localStorage.getItem('csSessionToken');
      return user && user.id && token ? { id: user.id, token: token } : null;
    } catch (_) { return null; }
  }
  function same(a, b) { return !!(a && b && a.id === b.id && a.token === b.token); }
  function reset() {
    queue = []; consent = null; consentPromise = null; owner = null;
    sentThisSession = 0; backoffUntil = 0;
    if (wakeTimer) { clearTimeout(wakeTimer); wakeTimer = null; }
    if (cancelRequest) cancelRequest();
  }
  function syncOwner() {
    const current = identity();
    if (!same(current, owner)) { reset(); owner = current; }
    return owner;
  }
  function stillOwned(item) { return same(item.owner, identity()) && same(item.owner, owner); }
  function readSentCount(id) {
    try { return Math.max(0, Number(global.localStorage.getItem(CAP_KEY_PREFIX + id)) || 0); } catch (_) { return 0; }
  }
  function writeSentCount(id, n) {
    try { global.localStorage.setItem(CAP_KEY_PREFIX + id, String(n)); } catch (_) { /* server still enforces quota */ }
  }
  function apiBase() {
    try { if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) return API_BASE_URL; } catch (_) {}
    return '/api';
  }
  function decideCapture(input) {
    const i = input || {};
    if (!i.consented || i.open === false) return { ok: false, reason: 'not_consented' };
    const ends = Math.min(Number(i.endsAt) || CAPTURE_ENDS_AT, CAPTURE_ENDS_AT);
    if (!(Number(i.nowMs) < ends)) return { ok: false, reason: 'window_closed' };
    if (!(Number(i.blobSize) > 0)) return { ok: false, reason: 'no_audio' };
    if (Number(i.blobSize) > Math.min(Number(i.maxWavBytes) || MAX_WAV_BYTES, MAX_WAV_BYTES)) return { ok: false, reason: 'too_large' };
    const cap = Math.min(Number(i.maxSamples) || MAX_SAMPLES_PER_STUDENT, MAX_SAMPLES_PER_STUDENT);
    if (Number(i.sentCount) >= cap) return { ok: false, reason: 'cap_reached' };
    return { ok: true };
  }

  // Bound the complete operation, including getAppKey, response JSON and file
  // reads. Promise.race alone would leave a stuck network operation alive.
  function bounded(work, abort, ms) {
    return new Promise(function (resolve, reject) {
      let done = false;
      const finish = function (err, value) {
        if (done) return;
        done = true; clearTimeout(timer);
        if (cancelRequest === cancel) cancelRequest = null;
        if (err) reject(err); else resolve(value);
      };
      const cancel = function () { try { if (abort) abort(); } catch (_) {} finish(new Error('research_cancelled')); };
      const timer = setTimeout(cancel, ms);
      cancelRequest = cancel;
      Promise.resolve().then(work).then(function (v) { finish(null, v); }, finish);
    });
  }
  async function request(path, body, expected) {
    if (!global.AbortController || !global.fetch || typeof getAppKey !== 'function') throw new Error('research_unsupported');
    const key = await bounded(function () { return getAppKey(); }, null, 2000);
    if (!same(expected, identity())) throw new Error('research_identity_changed');
    const controller = new global.AbortController();
    return bounded(async function () {
      const r = await global.fetch(apiBase() + path, {
        method: body ? 'POST' : 'GET', signal: controller.signal, cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-App-Key': key, 'X-Auth-Token': expected.token },
        body: body ? JSON.stringify(body) : undefined,
      });
      let data = null;
      try { data = await r.json(); } catch (_) {}
      return { status: r.status, data: data || {} };
    }, function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
  }
  function ensureConsent(done) {
    const current = syncOwner();
    if (!current || Date.now() >= CAPTURE_ENDS_AT) {
      const denied = Promise.resolve({ consented: false, open: false, endsAt: 0 });
      if (done) denied.then(done);
      return denied;
    }
    if (consent && Date.now() < consent.validUntil) {
      const cached = Promise.resolve(consent);
      if (done) cached.then(done);
      return cached;
    }
    if (!consentPromise) {
      const pending = request('/speechSampleConsent', null, current).then(function (r) {
        if (!same(current, identity()) || !same(current, owner)) return { consented: false, open: false, endsAt: 0 };
        const d = r.data;
        consent = {
          consented: r.status === 200 && d.consented === true && d.open === true,
          open: d.open === true, endsAt: Math.min(Number(d.endsAt) || 0, CAPTURE_ENDS_AT),
          maxSamples: Math.min(Number(d.maxSamples) || 0, MAX_SAMPLES_PER_STUDENT),
          maxWavBytes: Math.min(Number(d.maxWavBytes) || 0, MAX_WAV_BYTES),
          validUntil: Date.now() + CONSENT_TTL_MS,
        };
        if (!consent.maxSamples || !consent.maxWavBytes) consent.consented = false;
        return consent;
      }).catch(function () { return { consented: false, open: false, endsAt: 0 }; });
      consentPromise = pending;
      pending.then(function () { if (consentPromise === pending) consentPromise = null; });
    }
    if (done) consentPromise.then(done);
    return consentPromise;
  }
  function sampleId() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-sample';
  }
  function maybeCapture(sample) {
    try {
      const current = syncOwner();
      if (!current || !sample || !sample.blob || sample.ownerId !== current.id || Date.now() >= CAPTURE_ENDS_AT) return;
      if (consent && Date.now() >= consent.validUntil) consent = null;
      if (global.document && global.document.hidden) return;
      if (Date.now() < backoffUntil) { drop('backoff'); return; }
      const pending = queue.length + (active ? 1 : 0);
      if (pending >= MAX_PENDING) { drop('queue_full'); return; }
      const decision = decideCapture({
        consented: !consent || consent.consented, open: !consent || consent.open,
        nowMs: Date.now(), endsAt: consent && consent.endsAt,
        blobSize: sample.blob.size, sentCount: readSentCount(current.id) + pending,
        maxSamples: consent && consent.maxSamples, maxWavBytes: consent && consent.maxWavBytes,
      });
      if (!decision.ok) { drop(decision.reason); return; }
      queue.push({ owner: current, sample: sample, sampleId: sampleId(), queuedAt: Date.now() });
      pump();
    } catch (_) { drop('unavailable'); }
  }
  function readBlob(blob) {
    const reader = new global.FileReader();
    return bounded(function () {
      return new Promise(function (resolve, reject) {
        reader.onload = function () { const s = String(reader.result || ''); resolve(s.slice(s.indexOf(',') + 1)); };
        reader.onerror = function () { reject(new Error('research_read_failed')); };
        reader.readAsDataURL(blob);
      });
    }, function () { if (reader.abort) reader.abort(); }, 2000);
  }
  function handleSkip(data) {
    if (data.skipped === 'cap_reached' && owner) writeSentCount(owner.id, Math.max(readSentCount(owner.id), Number(data.stored) || MAX_SAMPLES_PER_STUDENT));
    if (['closed', 'not_consented', 'reservation_required'].indexOf(data.skipped) >= 0) {
      queue = [];
      consent = { consented: false, open: false, endsAt: 0, validUntil: Date.now() + CONSENT_TTL_MS };
    }
    if (data.skipped) drop(data.skipped);
    backoffUntil = Math.max(backoffUntil, Date.now() + Math.min(60000, Number(data.retryAfterMs) || UPLOAD_GAP_MS));
  }
  async function sendOne(item) {
    const c = await ensureConsent();
    if (!stillOwned(item) || Date.now() - item.queuedAt > SAMPLE_MAX_AGE_MS) return;
    const decision = decideCapture({
      ...c, nowMs: Date.now(), blobSize: item.sample.blob.size,
      sentCount: readSentCount(item.owner.id),
    });
    if (!decision.ok) { drop(decision.reason); return; }
    // Reserve globally using a SMALL request, before FileReader/base64 or an
    // audio upload. Busy research traffic never sends its large body.
    const reservation = await request('/reserveSpeechSample', {
      studentId: item.owner.id, sampleId: item.sampleId, blobBytes: item.sample.blob.size,
    }, item.owner);
    if (!stillOwned(item)) return;
    if (!reservation.data.reservation) { handleSkip(reservation.data); return; }
    if (Date.now() >= Math.min(c.endsAt, Number(reservation.data.expiresAt) || 0)) return;
    const wavBase64 = await readBlob(item.sample.blob);
    if (!stillOwned(item) || Date.now() >= Math.min(c.endsAt, Number(reservation.data.expiresAt) || 0)) return;
    const s = item.sample;
    const payload = { ...s, blob: undefined, ownerId: undefined, studentId: item.owner.id,
      sampleId: item.sampleId, reservation: reservation.data.reservation, wavBase64: wavBase64 };
    const r = await request('/saveSpeechSample', payload, item.owner);
    if (!stillOwned(item)) return;
    if ((r.status === 201 || r.data.duplicate === true) && r.data.success === true) {
      const next = r.data.duplicate ? readSentCount(item.owner.id) : readSentCount(item.owner.id) + 1;
      writeSentCount(item.owner.id, Math.max(next, Number(r.data.stored) || 0));
      if (!r.data.duplicate) sentThisSession++;
    } else handleSkip(r.data);
  }
  function pump() {
    if (active || wakeTimer || !queue.length) return;
    const wait = backoffUntil - Date.now();
    if (wait > 0) {
      wakeTimer = setTimeout(function () { wakeTimer = null; pump(); }, wait);
      return;
    }
    active = queue.shift();
    const item = active;
    sendOne(item).catch(function () { drop('request_failed'); }).then(function () {
      active = null;
      if (same(item.owner, owner)) backoffUntil = Math.max(backoffUntil, Date.now() + UPLOAD_GAP_MS + Math.floor(Math.random() * 5000));
      pump();
    });
  }
  function status() {
    return { consent: consent, queued: queue.length, uploading: !!active,
      pending: queue.length + (active ? 1 : 0), sentThisSession: sentThisSession,
      stored: owner ? readSentCount(owner.id) : 0, dropped: { ...dropped },
      endsAt: new Date(CAPTURE_ENDS_AT).toISOString() };
  }
  if (global.addEventListener) global.addEventListener('pagehide', reset);
  if (global.document && global.document.addEventListener) global.document.addEventListener('visibilitychange', function () { if (global.document.hidden) reset(); });
  global.SpeechSampleCapture = { maybeCapture: maybeCapture, ensureConsent: ensureConsent,
    decideCapture: decideCapture, reset: reset, status: status,
    MAX_SAMPLES_PER_STUDENT: MAX_SAMPLES_PER_STUDENT, MAX_PENDING: MAX_PENDING, REQUEST_TIMEOUT_MS: REQUEST_TIMEOUT_MS };
})(window);
