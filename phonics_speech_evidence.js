// Phonics needs recognition evidence, not target-conditioned encouragement alone.
import {speechSegments} from './phonics_speech_segments.js?v=1';
const tokens = text => String(text || '').replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const aliases = {
  ay: ['ay', 'a', 'ey'], ah: ['ah', 'a', 'ae', 'æ', 'uh'],
  bee: ['bee', 'b', 'be'], buh: ['buh', 'b', 'buhh', 'ba', 'bah', 'but'],
  cee: ['cee', 'c', 'see', 'sea', 'say'], kuh: ['kuh', 'k', 'c', 'cuh', 'kh', 'ka'],
  dee: ['dee', 'd', 'day'], duh: ['duh', 'd', 'duhh', 'da', 'day', 'the'], axe: ['axe', 'ax']
};
function oneEdit(a, b) {
  if (a[0] !== b[0] || a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
const soundPhones = { ah: 'AE', buh: 'B', kuh: 'K', duh: 'D' };
function initialMatches(word, sound, recognisedInitials) {
  if (word.length < 2) return false;
  const known = recognisedInitials?.find(item => item.text === word)?.phones;
  if (known?.length) return known.includes(soundPhones[sound]);
  // Unknown/nonsense words have no dictionary pronunciation. Use a conservative
  // spelling approximation; do not pretend this measures their acoustic onset.
  if (sound === 'ah') return /^a[b-df-hj-np-tv-z]/.test(word) && !/^ar/.test(word);
  if (sound === 'buh') return /^b/.test(word);
  if (sound === 'kuh') return /^(?:k(?!n)|c(?![eiyh]))/.test(word);
  if (sound === 'duh') return /^d/.test(word);
  return false;
}
export function verifyPhonics(result, audio, target, initialFocus = false) {
  const expected = tokens(target);
  // /si:/ followed by /k/ is sometimes written as the English word "seek".
  const recognised = expected.join(' ').startsWith('cee kuh ')
    ? String(result.text || '').replace(/\bseek\b/gi, 'see k') : result.text;
  const heard = tokens(recognised);
  // Count audible 20 ms windows so a click or a long silent file cannot pass.
  let voiced = 0, peak = 0;
  for (let start = 0; start < audio.length; start += 320) {
    const end = Math.min(start + 320, audio.length); let energy = 0;
    for (let i = start; i < end; i++) { energy += audio[i] ** 2; peak = Math.max(peak, Math.abs(audio[i])); }
    if (Math.sqrt(energy / (end - start)) >= 0.004) voiced += end - start;
  }
  const audible = peak >= 0.02 && voiced / 16000 >= 0.1;
  let cursor = 0;
  const checked = audible && result.targetStatus === 'checked';
  const targetWords = expected.map((word, index) => {
    const accepted = aliases[word] || [word];
    const axeSequence = word === 'axe' && expected.join(' ') === 'ay ah axe';
    const initialWord = initialFocus && expected.length === 3 && index === 2 && soundPhones[expected[1]];
    let match = -1;
    if (checked && initialWord && result.phonicsWordTranscript !== undefined) {
      let spoken = tokens(result.phonicsWordTranscript), wordInitials = result.phonicsWordInitials;
      // A noise-only crop supplies no lexical evidence. The final independently
      // recognised phrase word can still corroborate the onset (never an earlier
      // letter/sound misheard as a word).
      if (!spoken.length && heard.length) { spoken = heard.slice(-1); wordInitials = result.phonicsInitials; }
      const supported = spoken.length && (initialMatches(spoken[0], expected[1], wordInitials) || (axeSequence && /^x{1,3}$/.test(spoken[0])));
      return { text: word, heardClear: !!supported, basis: supported ? 'phonics-recognised-word-initial' : null };
    }
    if (checked) for (let j = cursor; j < heard.length; j++) {
      const supported = initialWord
        ? initialMatches(heard[j], expected[1], result.phonicsInitials) || (axeSequence && heard[j] === 'x')
        : accepted.includes(heard[j]) || (axeSequence && heard[j] === 'x') || (!aliases[word] && oneEdit(word, heard[j]) && result.targetWords?.[index]?.heardClear === true);
      if (supported) { match = j; break; }
    }
    if (match >= 0) cursor = match + 1;
    return { text: word, heardClear: match >= 0, basis: match >= 0 ? initialWord ? 'phonics-recognised-initial' : 'phonics-recognised-speech' : null };
  });
  // ASR often collapses the three fast phoneme repetitions into one token.
  // Accept that group only with two recognised names, a further recognised sound,
  // and at least three separate audible chunks; never invent it from a loop alone.
  const repeated = expected.length === 5 && expected[0] === expected[1] && expected.slice(2).every(w => w === expected[2]);
  if (checked && repeated && targetWords.slice(0, 3).every(w => w.heardClear) && speechSegments(audio).length >= 3) {
    targetWords.slice(2).forEach(word => { word.heardClear = true; word.basis = 'phonics-recognised-repeat-group'; });
  }
  return { ...result, targetWords, phonicsVerified: true, phonicsAudioDetected: audible };
}
