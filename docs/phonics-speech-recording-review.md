# Phonics 1 teacher-recording review

The teacher explicitly requested real recognition checks on the supplied audio,
including changed tempos, after correct `Bee buh bag` repeatedly failed. These
bounded audio checks are an exception to the usual build-phase no-checks workflow;
they do not constitute release preparation or approval.

## Method

Run `node tools/phonics/check-recordings.cjs` from this worktree. FFmpeg and local
Chrome are required (`CHROME_PATH` can select another Chrome executable). Optional
`PHONICS_CASES` filters case IDs; `PHONICS_REPORT` selects the JSON report filename.
The tool is a diagnostic, not an assertion that every positive clip is accepted.
Inspect its per-case outcomes and errors, not just its process exit code.

The harness loads the actual application bridge, worker, WASM runtime and model
in headless Chromium, without mocking recognition. All requests are restricted to
its loopback server; recordings never leave the computer. It evaluates the same
lesson clips derived from the teacher's recordings that Round A plays:

- Twenty word sequences and four letter sequences at 0.8x, 1x and 1.2x.
- Bag also at 0.65x and 1.4x: 74 positive cases in total.
- Four silence, four pink-noise, four unrelated-sequence and twelve wrong-initial
  word controls: 24 negative cases. The latter preserve the correct recorded
  letter/sound prefix but substitute a word from a different letter page.

Tempo changes use FFmpeg `atempo` without pitch shifting. WAV fixtures use the
recorder's exact 44-byte mono 16 kHz PCM header; file metadata is excluded from
sample data. Wrong-initial prefixes use reviewed source timing boundaries, not
the final energy island of a word. Reports retain input hashes and full results
under `.checks/phonics-recordings/`; full logs remain in `.checks/`.

## Changes informed by the recordings

Bag reproduced the screenshot's endless `B B B...` transcription at all three
initial tempos. Phonics-only decoding now bounds repetitive generation and, on an
uncertain result, tries a second bounded independent decode. Neither decode is
given the expected text as a generation prompt. Model weights and regular-book
decoding settings are unchanged.

Known short-sound transcription variants are normalised. For five-part letter
prompts, two independently recognised names plus an additional recognised sound
and at least three audible chunks can corroborate the rapid repetition group;
the child is not penalised because transcription collapses repeated sounds.
Bracketed/stage noise labels never count as words.

Round A checks the word's initial using a separately recognised final speech
chunk when it can be isolated, so an earlier letter sound misheard as a whole word
cannot satisfy the example-word slot. A missing short sound can be rechecked from
an actual middle audio chunk. These operations do not insert expected words into
the independent recogniser.

If a recognisable name and word onset surround an audible middle attempt that
the model still cannot assess, keep that sound neutral and allow technical
continuation. Do not falsely turn it green or charge a failed pronunciation try.
Other unrecognised responses retain the three-try skip policy.

These teacher-voice checks are development evidence, including tempo robustness,
not independent validation on children aged 2–5 or proof of phoneme accuracy.
Microphone, background-noise and real-child review remain necessary.

## Measured results · 19 November 2026

Final report: `.checks/phonics-recordings/teacher-review.json`; full log:
`.checks/phonics-recording-check-teacher-review.log`. The receipt alongside the
report records source hashes and the report hash.

| Outcome | Count |
| --- | ---: |
| Positive word/letter tempo cases | 74 |
| Fully green positive cases | 68 |
| Positive cases with a neutral, unassessed sound and technical continuation | 6 |
| Negative controls correctly rejected | 24 / 24 |
| Errors/timeouts | 0 |
| Requests outside loopback | 0 |

All twenty word sequences at normal tempo were fully green. Bag was fully green
at 0.65x, 0.8x, 1x, 1.2x and 1.4x. The six unassessed cases were apple at0.8x/1.2x,
caterpillar at0.8x/1.2x, camera at0.8x and the D letter sequence at1x. Do not report
these as successful phoneme recognition: their uncertain sounds remain neutral.
The positive-case median was1012ms and the slowest assessment2446ms on this desktop;
these figures do not establish older-phone timing.
