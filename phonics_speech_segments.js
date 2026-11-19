// Keep the pauses between a letter name, its sound and the example word.
// No expected text is used to find or transcribe these acoustic chunks.
export function speechSegments(audio, gapFrames = 5) {
  const hop = 320, levels = [];
  for (let i = 0; i < audio.length; i += hop) {
    let sum = 0; const end = Math.min(i + hop, audio.length);
    for (let j = i; j < end; j++) sum += audio[j] ** 2;
    levels.push(Math.sqrt(sum / (end - i)));
  }
  const threshold = Math.max(0.003, Math.max(...levels) * 0.035);
  const spans = []; let start = -1, last = -1;
  for (let i = 0; i <= levels.length + gapFrames; i++) {
    if ((levels[i] || 0) >= threshold) { if (start < 0) start = i; last = i; }
    if (start >= 0 && i - last >= gapFrames) {
      if (last - start >= 1) spans.push({start: Math.max(0, start * hop - 1280), end: Math.min(audio.length, (last + 1) * hop + 1280)});
      start = -1;
    }
  }
  return spans.length >= 2 && spans.length <= 8 ? spans : [];
}
