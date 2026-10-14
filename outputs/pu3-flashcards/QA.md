# PU3 flashcards: teacher-perspective visual review

35 final cards; no English target word or Chinese translation printed inside a card.
All final images were inspected at the app's actual 80px and 140px display sizes.
The gallery's **Hide / show meanings** button supports another review without labels.
This is an authoring review, not a claim of testing with actual pupils.

## Review method

For each card: what would a roughly ten-year-old Chinese pupil infer without
the translation? Is that inference close enough to the intended meaning? What
nearby vocabulary could be confused with it, and which visible cue separates it?
Relational words are reviewed as sets, since a highlighted comparison needs a
reference. A flashcard supports recognition; it does not replace sentence practice.

## Decisions after revision

| Word | Intended inference and distinguishing cue | Decision |
|---|---|---|
| plastic | Bottles, tubs and cups share a molded shiny material; several examples prevent just guessing bottle. | Accept |
| timetable | School subjects arranged by day and lesson time, rather than a plain date calendar. | Accept |
| tent | Fabric shelter with poles, ropes and open entrance; distinct from a house. | Accept |
| pyjamas | Matching bedtime clothes with moons/stars; distinct from everyday shirt/trousers. | Accept |
| suitcase | Wheeled travel bag with extended handle; distinct from backpack. | Accept |
| sandcastle | Castle-shaped sand with bucket/spade; distinct from a stone building. | Accept |
| postcard | Holiday-picture front and address/stamp back; distinct from photo/envelope. | Accept |
| stamp | Perforated postage label shown applied to an envelope; distinct from a bird picture. | Accept |
| pack | Folded clothes move down into luggage; arrow separates pack from unpack. | Accept |
| tour | Circus travels along a route to several cities; distinct from bus alone or one holiday destination. | Accept |
| holiday | Family leisure at beach with luggage; distinct from ordinary school/day-at-home scene. | Accept |
| forget | Bag remains at home while puzzled pupil arrives at school without it. | Accept |
| remember | Thought bubble recalls bag and child collects it before leaving; opposite outcome to forget. | Accept |
| frightening | Large threatening dog causes the smaller child's fear; distinct from a frightened face alone. | Accept |
| surprising | Unexpected pop-out event dominates; small child's reaction explains its effect. | Accept |
| worrying | Approaching storm threatens planned boat trip; large concerned father makes concern readable, unlike neutral rain. | Accept after regeneration |
| often | Five occurrences among seven opportunities, with gaps; distinct from always. Approximate percentage is illustrative. | Accept after enlargement |
| sometimes | A few occurrences among seven opportunities; distinct from often/never. Approximate percentage is illustrative. | Accept after enlargement |
| never | Zero occurrences and 0%; distinct from occasional repetition. | Accept after enlargement |
| once | One occurrence and large 1x cue; distinct from twice/sometimes. | Accept after enlargement |
| twice | Two occurrences and large 2x cue; exact count distinguishes it from sometimes's general frequency. | Accept after enlargement |
| before | Whole apple is highlighted in a whole-to-bitten sequence; distinct from the later state. | Accept after revision |
| after | Bitten apple is highlighted in the same sequence; distinct from before. | Accept after revision |
| yesterday | Previous date highlighted relative to TODAY; daylight sun separates it from last night. | Accept |
| last night | Previous date with moon highlighted relative to today's daylight. | Accept |
| last week | Entire previous seven-date row highlighted relative to current date; distinct from just one day. | Accept |
| better | More successful version of the same drawing task highlighted, with three vs one star. | Accept |
| worse | Less successful version of that same task highlighted; distinct from better. | Accept |
| more | Larger of two piles highlighted; two-way comparison, unlike most. | Accept |
| most | Largest of three piles highlighted; distinct from more/least. | Accept |
| least | Smallest of three piles highlighted; distinct from most. | Accept |
| one of the | One identical item selected within its group; not the biggest/best or a separate pile. | Accept |
| as | Equal ruler heights on same baseline and equals sign; conveys same degree. | Accept as comparison support |
| not as | Unequal ruler heights and not-equal sign; conveys different degree. | Accept as comparison support |
| made of | Chair/wood and spoon/metal material callouts; two examples avoid just naming wood. | Accept after removing transformation arrows |

## Revisions and checks

- Regenerated worrying: replaced the panoramic family scene with one large
  concerned father, a warning cloud and the planned boat trip.
- Enlarged the frequency/count cues and apple symbols for all five repetition cards.
- Replaced the apple core, which looked like an hourglass at 80px, with a bitten apple.
- Removed transformation arrows from made of; dotted links indicate material.
- Re-encoded originals as palette PNGs, keeping their content unchanged.
- Verified all 35 app filenames, successful browser decoding, and size below
  **100,000 bytes** each. Largest: **99,984 bytes**.

## Sources and reproduction

15 illustrations use the built-in image_gen tool; 20 precise diagrams use canvas.
`manifest.json` records the selected prompts, diagram rationale, dimensions and
byte sizes. Generated master images remain under Codex's generated_images folder.
The private `sources.local.json` holds their local paths and is ignored by Git.

From the repository root, use `node build_pu3_flashcards.js` with the local source
manifest present and the bundled workspace Node modules on NODE_PATH. The helper
only writes the 35 approved vocabulary image filenames and the review artifacts.
