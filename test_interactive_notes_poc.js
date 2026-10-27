'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const data = require('./interactive_notes_data.js');
const core = require('./interactive_notes_core.js');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'speech_scorer.js'), 'utf8'), sandbox);
const scorer = sandbox.window.Scorer;
let checks = 0;
function ok(value, label) { assert.ok(value, label); checks++; console.log('PASS ' + label); }
function wav(duration, amplitude) {
  const rate = 16000, n = Math.floor(rate * duration), b = Buffer.alloc(44 + n * 2);
  b.writeUInt32LE(rate, 24);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 5) * amplitude * 32767), 44 + i * 2);
  return new Blob([b]);
}
(async () => {
  ok(data.pairs.length === 6, 'all six source pairs');
  const items = data.pairs.flatMap(p => [p.left, p.right]);
  ok(new Set(items.map(x => x.id)).size === 12, 'twelve stable unique item IDs');
  for (const pair of data.pairs) {
    for (const item of [pair.left, pair.right]) {
      ok(core.assess(item, item.sentence, 1, scorer).pass, item.word + ': exact sentence passes');
      const other = item === pair.left ? pair.right : pair.left;
      for (const attempt of [1, 2, 3, 99]) ok(!core.assess(item, item.sentence.replace(item.word, other.word), attempt, scorer).pass, item.word + ': wrong ending rejected on try ' + attempt);
      ok(!core.assess(item, '[Music]', 1, scorer).pass, item.word + ': hallucination never passes');
      ok(!core.assess(item, 'I want a banana.', 3, scorer).pass, item.word + ': unrelated reading rejected');
      ok(fs.existsSync(path.join(__dirname, 'interactive_notes_assets', pair.page)), item.word + ': illustration exists');
    }
  }
  ok((await core.audioStats(wav(2, 0))).kind === 'quiet', 'silence gated');
  ok((await core.audioStats(wav(.4, .2))).kind === 'short', 'short recording gated');
  ok((await core.audioStats(wav(2, .2))).kind === 'ok', 'plausible sentence audio accepted for inference');
  const clean = core.sanitizeProgress({ [items[0].id]: { listened: true, passed: true, attempts: 50000, transcript: 'private' }, unknown: { passed: true } }, items.map(x => x.id));
  ok(Object.keys(clean).length === 1 && clean[items[0].id].attempts === 999 && !('transcript' in clean[items[0].id]), 'progress bounded and contains no transcript');
  console.log(checks + ' checks passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
