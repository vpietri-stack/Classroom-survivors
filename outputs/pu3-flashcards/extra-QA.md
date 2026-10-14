# PU3 follow-up flashcards: 13 teacher-requested concepts

The second batch adds who, what, when, where, which, why, could, couldn't,
language, information, topic, want and need. The first 35 approved PNGs are
preserved byte for byte. The shared gallery now offers New 13, First 35 and All 48
filters, plus the existing Hide / show meanings control.

## Visual review

Reviewed the final compressed PNGs at actual 80px and 140px display sizes.
The question-word set and contrast pairs were also compared together. The review
asks what a roughly ten-year-old Chinese learner could infer without the English
word or Chinese translation, and how each card differs from nearby vocabulary.
This is an authoring review, not a claim that actual pupils have tested the cards.

| Word | Expected interpretation and distinguishing cue | Decision |
|---|---|---|
| who | Question mark on a blank human face: whose identity is unknown, rather than an unknown object. | Accept |
| what | Unknown thing in a mystery box, with unrelated possible objects; no particular option selected. | Accept |
| when | Question on a calendar plus a clock: a question about time. | Accept |
| where | Question-mark map pin: a question about location. | Accept |
| which | Pointing hand and three matching backpacks: a choice from a known set, distinct from what. | Accept |
| why | Tipped bottle, puddle and cause-to-result arrow: asking for the reason something happened. | Accept as a reason cue |
| could | Elderly man recalls his matching younger self cycling successfully; memory bubble and green tick indicate past ability. | Accept |
| couldn't | Same man, child and bicycle; remembered balancing difficulty, grounded feet, wobble marks and red cross. | Accept |
| language | Three speech bubbles with French Bonjour, Spanish Hola and Japanese こんにちは. No English or Chinese greeting/translation. | Accept |
| information | Blue information symbol plus distance, time and weather facts; distinct from an unanswered question. | Accept as an abstract-concept cue |
| topic | Selected subject is repeated in both speakers' bubbles: what their conversation is about, rather than unrelated facts. | Accept as a contextual cue |
| want | Optional toy desire is outlined red; essential water is present beside it for contrast. | Accept |
| need | Essential water for a thirsty child is outlined red; optional toy desire remains beside it. | Accept |

Information and topic remain abstract. These images support recognising the
concept; they do not replace its meaning in a sentence. The topic card can first
prompt “talking about space”, which is close to the intended idea of a shared
subject of conversation.

## Iteration

- Matched couldn't to the could reference so the older/younger characters,
  clothing, bicycle, memory bubble and drawing style stay consistent.
- Matched need to want, changing which panel is highlighted while retaining the
  same desire-versus-necessity contrast.
- Refined information's location cue into a proper pointed map pin rather than a
  balloon-like shape; added open mouths to topic's speaking figures.
- Question-word images use the question mark on different kinds of unknowns:
  person, thing, time, place, choice and reason.
- Drawn language directly with canvas to ensure accurate greeting characters.
- No card prints its target English word or a Chinese translation.

## Sources and checks

9 illustrations use the built-in image_gen tool; 4 precise diagrams use canvas.
`extra-manifest.json` contains the selected generation/edit prompts, rationale,
dimensions and final byte sizes. Every new PNG is strictly under 100,000 bytes.
Largest new file: 99,550 bytes. Verified all 48 gallery images decode, all three
batch filters and hidden-meaning review work, and the gallery fits a 319px viewport.
The real app's showVocabImage function loads each new exact filename, including
the apostrophe in couldn't.png. Full npm test passed with 926 browser integration
checks; outbound requests to external services were blocked during the asset check.

`build_pu3_flashcards_extra.js` rebuilds only this set and the shared gallery.
The ignored `extra-sources.local.json` points to retained Codex-generated masters.
Use the bundled workspace Node modules on NODE_PATH, as for the first batch.
If rebuilding both batches, run the original builder first and this one second
to restore the combined gallery. Neither builder changes curriculum or SR keys.
