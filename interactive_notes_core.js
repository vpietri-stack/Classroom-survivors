(function (root) {
  'use strict';
  const normalize = s => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const junk = text => !normalize(text) || /^\s*[\[(].*[\])]\s*$/.test(text) || /^(you|bye|huh|thank you|thanks for watching|inaudible)$/.test(normalize(text));
  function assess(item, text, attempt, scorer) {
    if (junk(text)) return { pass: false, kind: 'unclear', message: '还没听清楚。靠近一点，再读一次吧。' };
    const score = scorer.scoreForBook(item.sentence, text, 'PU3', attempt);
    // The lesson tests the adjective distinction. Shared sentence frames and
    // fuzzy spelling must not pass "bored" when the target is "boring".
    const adjectiveHeard = normalize(text).split(' ').includes(item.word);
    return {
      pass: !!score.pass && adjectiveHeard,
      kind: adjectiveHeard ? (score.pass ? 'pass' : 'retry') : 'adjective',
      message: adjectiveHeard ? (score.pass ? '听到啦！这句话读出来了。' : '再听一次，然后把整句话读出来。') : '再听听 ' + item.word + '，把这个词和整句话一起读出来。',
      accuracy: score.accuracy, adjectiveHeard
    };
  }
  async function audioStats(blob) {
    if (!blob || !blob.size) return { kind: 'empty', duration: 0, peak: 0 };
    const buf = await blob.arrayBuffer();
    if (buf.byteLength < 44) return { kind: 'empty', duration: 0, peak: 0 };
    const dv = new DataView(buf), rate = dv.getUint32(24, true) || 16000;
    const n = Math.floor((buf.byteLength - 44) / 2);
    let peak = 0;
    for (let i = 0; i < n; i += 4) peak = Math.max(peak, Math.abs(dv.getInt16(44 + i * 2, true)) / 32768);
    const duration = n / rate;
    return { duration, peak, kind: peak < .02 ? 'quiet' : duration < 1 ? 'short' : 'ok' };
  }
  function sanitizeProgress(value, ids) {
    const result = {};
    if (!value || typeof value !== 'object') return result;
    ids.forEach(id => {
      const entry = value[id];
      if (entry && typeof entry === 'object') result[id] = {
        listened: entry.listened === true, passed: entry.passed === true,
        attempts: Math.max(0, Math.min(999, Math.floor(Number(entry.attempts) || 0)))
      };
    });
    return result;
  }
  const api = { normalize, junk, assess, audioStats, sanitizeProgress };
  root.InteractiveNotesCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
