# Preview handwriting recognizer

Self-hosted 26-class, case-merged Latin CNN: 81,210 float32 parameters and
324,840 weight bytes. Original NumPy/browser implementation trained from a
public NIST EMNIST Letters subset and adapted to consented development traces.
No learner identities, raw student traces or review labels are distributed.

This preview retains the stronger earlier adapted checkpoint. A new six-model
training experiment using six corrected teacher judgements did not beat it.
The shipped changes are integration into the actual round, revised calibration
and veto rules, dot/ink guards, and explicit é handling. Do not describe this
checkpoint as the newly retrained network.

The development comparison uses five learner-separated rotations: three weight
training groups, one different calibration group and one evaluation group.
Corrected labels contain 251 readable, 95 incorrect and four unresolved examples.
The selected policy yields 232 readable accepts and one incorrect accept;
font-only replay yields 152 and four on the same labels. Family/policy selection
used development results and corrections followed viewing earlier predictions.
These are diagnostic development numbers, not independent accuracy. The separate
150-card set remains unscored. The interactive full-development checkpoint is not
the five held-fold models; its own examples are not independent evidence.

é accepts a readable e body with an optional detached accent, consistent with
the teacher accepting unaccented D202. Displayed/spelled targets remain é; this
does not claim general accent recognition. Lowercase i/j require an actual upper
dot rather than merely two strokes. A simple capital I can remain acceptable.
Other unsupported characters retain the existing font-checker verdict.

`handwriting_recognition.js` downloads and SHA-256 checks weights, caches them
using `cs-handwriting-model-v2`, and runs inference in a worker. Runtime sources
are bundled locally for offline worker startup. Downloads/inference have bounded
timeouts. Failure falls back to the existing checker; erasers remain available
and hint/skip keep their normal effort gates. No external model hub, recognition
endpoint or CDN is used. Cache eviction
and actual device/China-network first download still need validation.
The larger weights allow 60 seconds per background attempt with one retry;
manifest/runtime requests remain bounded at eight seconds. A failed warm-up can
be retried at the next round entry. `HWRecognition.status()` reports the loading
phase/failure for diagnosis without exposing tensors or student information.
The preview offline worker reuses this checked cache, avoiding a second parallel
model download. It only prefetches the page/runtime/fonts itself.

23 October: hint access is gated by two meaningful failed writing attempts per
letter; single taps do not unlock it and outlines are no longer shown
automatically after the second failure. The recognizer weights are unchanged.
Skip is hidden until a meaningful failure with a guide displayed, then remains
available for subsequent words in that Study session. A new session resets it.

Engine version 2 identifies this checkpoint/policy. Capture retains its existing
consent/window/cap gates; traces stay out of analytics. Stored precision/recall
describe geometry, not CNN confidence; font-only replay cannot reproduce every
neural verdict. In fallback mode a successful intermediate pen-lift decision may
be retained, so final accumulated ink can differ from that earlier font pass.
