# The Big Bag · Phonics 1, Unit 1, curriculum page 4

## Edited story

| Story page | Exact narration text |
| --- | --- |
| 1 | The bear has a big bag. |
| 2 | What is in the bag? |
| 3 | Look! An apple, and a banana! |
| 4 | Look! A ball, and a cup! |
| 5 | Look! An axe, and a cactus! |
| 6 | Look! A cat, and a caterpillar! |
| 7 | What?! An alligator on a bike! |
| 8 | What?! An astronaut with a camera! |
| 9 | Where is the bear? |
| 10 | Look! The bear is in the bag! |

Pages3–6 follow the teacher's exact new reveal pattern and punctuation. Pages7–8
use the exact surprise wording. The story includes all fourteen Unit1 nouns.
New support/sight words include the, has, a/an, big, what, is, in, look, and, on,
with, where. Keep the text separate from raster art for accessible captions and
future sentence audio/highlighting.

## Illustrations

Ten original images made with the built-in imagegen tool. Storybook gouache and
watercolor with pencil edges and warm paper texture. The bear is cinnamon brown
with a cream muzzle and rust-red scarf; the bag is a large blue backpack with an
ochre lining and a cream star patch. Page1 anchors identity/style for all pages.
Only the current reveal objects appear, avoiding accumulated visual clutter.
Page9 deliberately has no bear, while page10 shows the bear inside the bag.

Full-resolution PNG masters, WebP copies and the exact per-page prompt set are
saved in `media/phonics/p1-u1-picture-book/`. `story.json` contains the exact text,
art filenames and prompts. The source images have no baked-in text.

`phonics1_u1_picture_book_review.html` uses large, locally hosted Fredoka text.
Forward/backward navigation curls a sheet over approximately1.7–2.05seconds,
including the blank paper back and a moving fold shadow. Four shuffled motion
profiles gently vary curl radius, lift, lean, easing and a small paper bow; all
variation is sampled once per turn, avoiding frame-to-frame jitter. Five original
soft paper-friction sounds vary grain, crinkles and envelope. A shuffled pool
avoids immediate repeats across pool boundaries. Slight volume variation and
playback-rate alignment keep the rustle duration matched to the turn. Narration
starts only after the selected animation finishes. Reduced-motion preferences use a
brief fade. Buttons, keyboard arrows and swipes share the transition; narration
stops when turning manually. `picture_book_page_turn.js` draws the page artwork
and caption into a temporary canvas, then rolls a cylindrical fold across it.

The teacher supplied a complete59-second reading in
`The bear has a big bag..m4a`. That recording replaces all cloned narration for
this story. Natural pitch, tempo, delivery and intra-sentence pauses are preserved;
only sentence boundaries and consistent playback volume are prepared. Ten clips
use distinct `page-XX-recorded-v1.mp3` URLs. The original master is retained in
private authoring storage; no reference recording is published. Page clips were
transcribed locally for alignment review; ASR's ball/bowl spelling ambiguity does
not alter the teacher's actual audio or the approved story text.

Tap the illustration/sentence or listen button to hear one page. Whole-book
playback advances with the curl and paper sound. The private reviewed-cut recipe
pins the supplied master hash; `tools/phonics/generate-picture-book-narration.py`
exports these recorded clips without calling an AI service. A different recording
must be realigned rather than cut with old timestamps. No automated application
checks or browser walkthrough were run during this build.

## Preview and Study integration

Runtime placement: Unit 1 pages 1 A a, 2 B b, 3 C c, 4 The Big Bag;
Unit 2 page 5 D d. D retains every `phonics1:word:*` SR key and original
media path. The story uses a distinct completion ID, so an old D completion
cannot mark the story complete. Existing Unit 1/page 4 assignments now refer
to the story; teachers can assign Unit 2/page 5 to return a student to D.

The preview uses the shared notes listener/Chinese/recorder interface. Optional
recording checks the same core nouns as Study. Reaching the last story page
unlocks 开始练习; listening to every preview clip is optional. Library review
ends with Return, rather than changing the current assignment.

Study runs in the native themed Study overlay. Each page plays the teacher's
recording before the microphone controls appear. Children repeat the complete
caption in one recording, but passing requires only recognisable core nouns;
small connecting words can be missing. Long nouns tolerate imperfect endings,
with a small alias list for child speech. Speech hints come from the actual
transcript, rather than treating target-biased alignment alone as evidence.
Silence and unrelated speech receive no green hints. These hints are generous
recognition feedback, not a calibrated pronunciation grade; teacher microphone
review is still needed.

After three assessed attempts, Skip is available. Microphone permission/device
failure or technical assessment failure allows listening-only continuation.
Permission is requested again in the next session; only this run remembers an
unavailable microphone. Recovery stores the page and current speaking attempts;
resuming replays that unfinished page's narration before reopening the mic.

Finishing all ten pages, including allowed skips, queues one normal Study event
through the existing recovery/deduplication path, without changing word SR state.
Completion saves Unit 2/page 5 and ends Study; the next session requires D's
preview. The assignment intent is stored per account and local-review origin,
retried after login/menu entry, and sent as a conditional `updateStudent` write.
An old book replay/resume cannot overwrite a later assignment. The candidate API
uses the current assignment plus an ETag condition to protect concurrent edits.

### Local review and publishing boundary

Review with a synthetic student assigned Phonics 1 / Unit 1 / Page 4 in the
full local app. The standalone book link supports optional reading practice,
but starting tracked Study requires entering through the signed-in app.
No automated checks, browser walkthrough, or publication during this build.
The hosted preview API supplies sign-in/test data; the new catalog completion
rule and conditional assignment guard must be verified by the publisher against
the candidate API with isolated data before production. Hosted legacy API does
not yet enforce the new conditional guard. Verify one credit, no SR delta,
recovery, allowed skips, destination preview, and a concurrent teacher reassign.
