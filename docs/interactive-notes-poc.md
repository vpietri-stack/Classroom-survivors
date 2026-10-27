# Interactive illustrated notes POC

Entry: `interactive_notes_poc.html` (standalone, at the app's root URL).
Lesson: Power Up 3, Unit 9, printed Student's Book p.111.

## What the child can do

1. Explore six adjective pairs with English, simplified Chinese, and the
   original preview infographic illustrations.
2. Tap either illustrated example to select and play its full sentence.
3. After hearing the full demo, prepare the speech model, then tap to record
   the sentence. Tap again to stop; recording stops automatically at 15 seconds.
4. See coaching or a successful sentence match, listen back to their own
   recording, retry, or move to another example at any time.
5. Return to the note with listened/passed progress preserved on this device.

All twelve demos are saved MP3s generated from the original public example
sentences using Sound of Text, Google/en-GB. Generation uses the official
[API contract](https://soundoftext.com/docs) and the same service already used
by `gen_missing_audio.js`. The learner's browser plays same-origin files; it
does not call Sound of Text. Device English speech synthesis is a fallback if
the reference file cannot be loaded. No reference sentence from the textbook
has been copied.

Teacher/parent tools can record a replacement demo or import a 0.5–30 second,
at most 5 MB audio file for the selected example. Replacements persist in this
browser's IndexedDB and can be downloaded individually or restored to the
shipped reference. They are not automatically shared with other devices.
To publish an approved teacher voice later, replace that item's static audio
asset and update its versioned URL in the lesson manifest.

## Speech integration

The POC directly loads the existing `speech_recorder.js`, `speech_engine.js`
and `speech_scorer.js`; it does not copy or modify the Whisper runtime/model.
The page is at repository root because engine library/model paths are resolved
relative to `location.href`.

Model loading is on demand, through the existing load/cache/mirror system.
Listening stays available while it downloads/initializes. Loading the model
never starts the microphone automatically; a separate child gesture is needed.
An explicit retry calls `LocalEngine.resetLoad()` after a failed load.

The adapter preserves the sentence gates: at least 1 second of nontrivial
captured audio, peak >= 0.02, and junk/silence transcripts receive coaching.
Plausible speech goes through `Scorer.scoreForBook(target, text, 'PU3', attempt)`.
It also requires the exact target adjective among normalized recognised words.
This prevents the common sentence frame or retry leniency from accepting
"bored" instead of "boring". It is a transcript-evidence requirement, not a
claim to detect an acoustic suffix or provide a phoneme pronunciation score.
**No expected-text prompt is passed to Whisper.**

The page owns a separate recorder lifecycle because `SpeechUI.makeSentenceGate`
currently returns a DOM node without a destroy/cancel interface. Picture
switches, profile switches, reset, page hide and cancel invalidate pending
results, close audio contexts and microphone tracks, revoke playback URLs,
and drop ephemeral child audio. Late permission results are cleaned up. Only
one ASR inference may run at a time, even after leaving its example.

## State and isolation

- `interactive_notes_data.js`: book/page metadata, stable example IDs, original
  sentence text/translation, source-image display rectangles, audio URL.
- `interactive_notes_core.js`: testable audio gates, target-adjective check,
  bounded progress sanitization.
- `interactive_notes_poc.js` / `.css`: rendering, playback, lifecycle, local
  teacher audio editor, child-facing feedback.
- `interactive_notes_assets/`: unmodified four infographic PNGs and twelve
  reference MP3s. CSS displays selected illustration regions without creating
  altered raster files.
- localStorage keys `csInteractiveNotes.pu3-u9-p111.v1:a` and `:b`: two explicitly
  named POC profiles. At most twelve stable IDs, with listened/passed booleans
  and attempt count capped at 999. No transcript or audio in these keys.
- IndexedDB `cs-interactive-notes-poc-audio`, store `clips`, key `id`: only
  teacher-provided demonstration audio, at most twelve clips of 5 MB each.
- Student audio is an in-memory Blob only; last take can be replayed until
  navigating away, cancelling, hiding the page, or starting a new take.

There are no account/auth, analytics, speech-sample-capture or API scripts on
this POC page. It does not register a service worker or alter app curricula,
student records, SR progress, rewards, dashboard telemetry, or deploy stamps.
Progress is device-local POC progress, not a student's server record. Existing
site service workers can still control an already-installed preview origin;
the POC itself does not add an offline guarantee.

## Route into the main app after review

1. Approve the child-facing interaction and test physical iPad/Android
   microphone permissions, reference quality, first model load and real child
   readings. Synthetic smoke tests cannot establish child/L2 accuracy.
2. Add a `notes` manifest keyed by book/unit/page. The current six-pair manifest
   is the seed; future lessons provide examples and asset URLs using the same
   structure. No screenshot OCR or invisible click coordinate mapping is needed.
3. Offer a Notes entry beside that lesson's existing Study/review entry. Reuse
   this controller or factor a cancellable speech adapter out of `SpeechUI`;
   preserve the existing audio/hallucination guards and concurrency rules.
4. Replace trial-profile keys with keys scoped to the authenticated student ID.
   Decide explicitly whether this is optional practice or required completion.
   Store listened and actual speech-pass separately; neither skipping nor
   merely listening should mark a speech pass.
5. If teacher-visible completion is approved, introduce a small dedicated
   `note_example_attempt`/completion event with stable lesson/example IDs and
   acknowledgement-aware delivery, plus dashboard labels/filtering and tests
   in the same change. Decide SR/reward semantics separately. Keep recordings
   ephemeral unless a separately consented capture policy is approved.
6. Publish teacher audio as same-origin versioned assets, cache approved lesson
   packs if desired, verify preview devices, then seek production approval.

## Validation and local running

From this checkout, run a static HTTP server at repository root and open
`http://127.0.0.1:8093/interactive_notes_poc.html`. Microphones require HTTPS or
localhost; a plain HTTP LAN-IP link will not enable microphone capture on a
phone. Use the HTTPS preview URL for physical-device tests.

```
node test_interactive_notes_poc.js
node test_interactive_notes_poc_browser.js [local-or-hosted-url]
node test_interactive_notes_engine_browser.js
node test_interactive_notes_microphone_browser.js <url> <synthetic-reference.wav>
npm test
```

The first suite covers all pairs, wrong-ending foils through every retry rung,
junk/unrelated responses, audio gates and bounded non-sensitive progress.
The browser suite uses real UI/core/scorer with mocked recording/transcription;
it tests playback gating, persistence/profile isolation, cancellation races,
permission recovery, failed-model retry, teacher audio storage, 320px layout,
and no API/external calls. Mocked tests are not model-accuracy evidence.
The real-engine test decodes each of the twelve shipped synthetic MP3s and
passes PCM into the unchanged Whisper model without a target hint. Its twelve
recognitions passed on the development PC, about 1.1–1.4 seconds per sentence.
That check uses no live microphone or children's voices and is not a child
pronunciation benchmark. Initial model loading and speed vary by device.

The microphone integration suite additionally passed one full sentence through
the real Recorder, WAV quality gate, real Whisper, guarded scorer, feedback and
saved progress. Chromium's fake microphone read a Windows Hazel synthetic
"The film is boring" WAV; no physical microphone or child audio was used.

These POC suites intentionally remain outside the production root test chain.
