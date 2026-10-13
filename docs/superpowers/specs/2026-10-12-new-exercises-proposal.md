# New exercises — discussion proposal

Date: 2026-10-12 (Asia/Shanghai)

Status: standalone missing-word/find-fix POC implemented on 2026-10-13; shared Study/game integration implemented for preview on 2026-10-13; production
rollout remains pending.
Worktree: `D:/coding/html games/Classroom-survivors-wt/New exercises`.
Branch: `new-exercises`, created from production `origin/main` at `ff22e18`.

## Confirmed requirements

- Keep curriculum organized by book, unit, and page.
- Keep each existing `vocab` array unchanged.
- Rename the existing sentence exercise category to **sentence scramble**.
- Keep the name **sentence match**.
- Group both under **non-spelling exercises**, alongside new typed exercises.
- Pages can offer different subsets of exercise types.
- Study A remains word recognition, B word scramble, and C handwriting.
- Study D contains five mixed non-spelling exercises selected using SR state,
  page proximity, and variety. Include at least three different eligible types
  when the SR pool permits it.
- One three-pair sentence-match board counts as one of the five exercises.
- Fill shortages using cooldown content, but do not pull cooldown content merely
  to force three types.
- Introduce the new types in both Study Mode and game challenges.
- The first new types are **choose the missing word**, **sorting**,
  **find and fix the mistake**, and **read clues and answer**.
- Design these exercises to discourage random clicking through to completion.
- Missing-word exercises show one to four blanks according to the content.
  The student selects a blank and fills it using a shared letter keyboard
  built from the letters of all the missing answers, then checks the board.
- Find-and-fix exercises make every sentence word selectable. The student
  moves one word to a bin, then enters its replacement using a small keyboard
  containing only the target replacement's letters in scrambled order, with
  no random filler letters. CHECK separately
  communicates whether the selected word and replacement spelling are correct.
- Read-clue exercises require a typed short answer using a ten-letter keyboard
  containing the answer's letters. Author answer length by level: one word for
  PU1, one to three for PU2/Think0, and one to five for PU3/Think1; higher-level
  limits can be defined when authoring those pages.
- For the new letter-input exercises, CHECK colors correct letters green and
  incorrect letters red. If the response is wrong, return/reset the entire
  response, including the letters that were correctly placed, after feedback.
- All new letter keyboards use reusable keys. Clicking a key enters a letter
  without removing the key; repeated letters can use the same key. A failed
  check clears the answer boxes after feedback while retaining the keyboard.
- Use one authored target answer per blank and one target word/replacement per
  find-and-fix exercise. Multiple acceptable answers/repairs were considered
  during review and explicitly dropped by the user.
- The initial page is PU3 Unit 9 page 109, focusing on before/after/when.
  Missing-word and find-and-fix exercises on this page have no extra event-order
  clue panels. Use familiar everyday sequences and small keyboards to guide
  the intended answer; do not introduce past-tense correction drills here.
- Pair missing-word sentences with different target words, such as hands washed
  before lunch and lunch eaten after washing hands. Include only the target
  answers' letters in the shared reusable keyboard.
- Develop in this worktree until ready for a deliberate production release.

## Proposed defaults

- Mixed D replaces both the old sentence-scramble D and separate matching E.
- Only the selected book's current and earlier curriculum pages are eligible.
- The user retains **non-spelling exercises** as the umbrella curriculum
  category. Three new types now include letter-based answer production alongside
  their grammar, correction, or comprehension target.
- Retain the current sentence-scramble speech step.
- Preserve existing scramble and pair SR progress; track new exercises
  independently with stable IDs scoped by type.
- A matching board counts once for presentation, while its three pairs retain
  independent SR outcomes.
- Avoid repeated exercises or pairs within a round. If fewer than five unique
  exercises exist even after cooldown fallback, use what exists.
- The three-type minimum applies to the five-item Study round. Games use the
  same exercise renderers and SR rules; their variety policy can operate across
  successive challenges without changing game pacing.

## Selected types and curriculum anchors

Examples below are proposed authored content aligned with the app's existing
curriculum, not copied exercises from additional textbook pages.

| Type | Curriculum location | Example |
|---|---|---|
| Choose the missing word | PU1 U1 p9; PU3 U2 p28; Think2 U2 p29 | Select each of up to four blanks and enter its missing word from a shared letter keyboard. For pen/pens with answers is/are, the keyboard contains a/e/i/r/s. |
| Sort into groups | PU2 U2 p19; Think1 U3 p37; Think2 U2 p29 | Sort days into weekdays/weekend, foods into How many/How much, or time expressions into for/since. |
| Find and fix the mistake | Think1 U1 p19; PU2 U7 p85 | In `She watch TV every day`, bin watch and enter watches using the letter keyboard. All words remain selectable before CHECK. |
| Read clues and answer | PU1 animal pages; Think0 U3 p30; PU3 U6 p69 | Read clues and enter pig, a family relationship, or a short timetable answer using the letter keyboard. |

The selected four plus scramble and match give six exercise types. Suggested
pilot anchors: PU1 U1 p9 for simple singular/plural decisions, PU2 U2 p19 for
sorting, Think1 U1 p19 for finding and fixing present-simple mistakes, and
Think0 U3 p30 for family clues. Add several independently authored exercises
and retry variants on each chosen page before expanding the curriculum.

Scene choice, same-meaning choice, and event ordering remain possible later
extensions; they are outside the selected first batch.

## Proposed grading and retry design

This section is a recommendation for discussion, not an implemented or
user-confirmed retry policy.

### Shared behavior

1. Selecting a letter or moving a card edits a draft answer. It does not reveal
   correctness or advance the exercise. CHECK submits a complete answer.
2. Do not provide graded previews while some answer boxes are wholly empty.
   Prompt the student to enter an answer in each required box first. Once a
   response is submitted, missing or extra letters are errors, not a way to
   obtain free partial feedback. Double clicks and editing during grading
   cannot submit twice.
3. Record the first fully submitted wrong answer immediately as an SR failure.
   Later correction or assistance does not turn that result into SR success.
4. Shuffle letter/card positions on new presentations. Keyboard filler letters
   are kept for a whole retry; do not progressively remove wrong letter choices.
5. Follow the user's reveal-and-reset loop: on a wrong check, show green/red
   feedback, then reset the whole response, including correct letters. For
   find-and-fix, restore the original sentence word and empty the bin, so both
   mistake identification and replacement must be attempted again. Keep the
   same exercise for retry. An authored fresh-example checkpoint after repeated
   failure remains an optional future extension, not the default retry policy.
6. After repeated mistakes, provide a worked example and scaffolded practice
   instead of increasing penalties. Keep the result marked assisted for SR.
7. Treat each retry variant as part of the original exercise slot; it does not
   consume an extra one of the five Round D exercises. Store the first result,
   wrong-check count, variants shown, and assistance in analytics.
8. Use the same completion/SR rules in Study and games. A completed assisted
   exercise can still advance play, while its SR result remains a failure.
   Reward changes are not part of this proposal.

### Per-type answer structure

| Type | Recommended response |
|---|---|
| Choose the missing word | One to four authored blanks. Select the active box, enter letters, then submit all answers together. Grade each letter against the target for its own blank. This is one exercise board. |
| Sorting | Place every one of four to six cards, then check the whole board. Reset the whole response on retry; never award completion for each lucky placement. |
| Find and fix the mistake | Bin any one word and type a replacement. Grade the chosen word and replacement spelling independently. Selecting/binning a word gives no correctness hint; a wrong selection still opens the same target-based keyboard. |
| Read clues and answer | Read an authored set of clues and type a short answer. Author a clear intended target and grade against that single answer. |

Example missing-word board: `The pen ___ on the desk` and
`The pens ___ on the desk`, answered from a/e/i/r/s. Grade against is/are,
including which blank contains each letter. Both answers correct on the first
submitted check produce first-attempt success; any earlier wrong check makes
the exercise an SR failure for this session.

Letter production, complete-board grading, full resets, and first-attempt SR
make guessing less useful, but cannot prove understanding or eliminate lucky
answers. Repeated independent SR checks across sessions provide stronger
evidence. Answer speed alone should not be treated as cheating; genuine fluent
readers can answer quickly.

### Keyboard decisions and recommendations

- Confirmed: reusable letter keys for the new exercises, including repeated
  characters and multiword answers. Missing-word keyboards use only the shared
  answers' letters. Find-and-fix keyboards use only the target replacement's
  letters in scrambled order. Neither type adds random filler letters.
- Read-clue keyboards retain the proposed ten distinct letter keys, padding
  the answer letters with random alphabetic fillers.
- For read-clue keyboards, ten keys must not make a valid answer impossible. If an answer uses more than
  ten distinct letters, grow the palette to include all required letters.
- SPACE, BACKSPACE and CLEAR are controls rather than part of the ten-letter
  quota. Blank selection must be visible; letters go only to the active box.
- Case should normally be ignored. Build keyboards from the single authored
  target answer(s), ensuring every required letter is enterable.
- For PU3 U9 p109 find-and-fix, use before/after/when replacement targets and
  scramble only that target's letter keys. This replaces the earlier ten-key
  filler proposal, which the user explicitly rejected.

### PU3 Unit 9 page 109 draft principles

- Page 109 was published on origin/main in c35af73 after this worktree's base.
  The draft review reads that published content without changing the worktree's
  application files.
- Prefer before/after sentence pairs that reverse the same two actions: washing
  hands/lunch, socks/shoes, tickets/cinema, shower/drying hair.
- Mixed pairs can target before/when or after/when, with ordinary event reactions
  such as laughing at a joke or waving at a friend.
- With reusable keys, a before/after keyboard can be compacted to
  a/b/e/f/o/r/t; repeated e/r/f keys are not needed to enter either answer.
- For find-and-fix, all words remain selectable, but each authored exercise has
  exactly one selected-word index and replacement target. Replace the time word
  that gives an unconventional everyday sequence; the exercise is about the
  intended time relationship rather than a claim that every displayed wrong
  sentence is syntactically invalid English.
- Missing-word boards M1-M6 below are approved by the user. The user subsequently
  requested a POC using two randomly selected M boards followed by two F boards,
  authorizing F1-F8 for that test surface. Their target-only keyboard policy is
  confirmed. Both sets remain isolated from production pending testing.

### Standalone POC

- Entry: `new_exercises_poc.html`; assets: matching `.css` and `.js` files.
- Test flow: Study two M then two F, followed by Game two M then two F. Eight
  boards are independently sampled for each presentation on every load or
  restart, with no repeats within each presentation.
- Actual production fonts, Tailwind, Font Awesome and style.css are loaded.
  Study uses the Round D shell, four-round progress and study letter tiles;
  Game uses the grammar-challenge shell, minigame card and letter bubbles.
  The same new exercise widget is mounted in both. The live theme toggle is
  available, with green/red feedback explicitly preserved under theme overrides.
- Study success advances after 1.2 seconds. Game success uses GET POWER UP,
  advancing the preview sequence without interacting with real game rewards.
- Three-second error reveal, whole-board reset, and an immediate Clear option.
- PC typing and pointer drag; phone tap-to-bin and pointer drag. Reusable on-screen
  keys include only the intended letters. The native phone keyboard never opens.
- In-memory attempts/first-attempt summary only; no authentication or API calls.
- Local server: `node serve_new_exercises_poc.js` (default port 8123, LAN binding).
- Verification: `node test_new_exercises_poc_browser.js [optional URL]`, plus visual
  inspection of desktop and phone screenshots. Production files/stamps untouched.
- Visual refinement: compared the actual existing Study sentence-scramble and
  game grammar renderers with the POC. New widgets now use stronger exercise
  typography, separate compact sentence cards, raised answer fields, selectable
  production-style word tiles, a compact bin/undo control, balanced phone letter
  rows and secondary clear/delete actions. Short closing clauses stay grouped
  for readable wrapping. Fresh POC sessions default to the kid-friendly theme;
  existing explicit theme preferences are honoured.
- Feedback refinement: green/red gradients and raised edges match existing word
  tiles, with white letters, a check on fully correct words and a brief shake on
  spelling errors. Messages use compact icon badges. The bin is a small raised
  button with a drawn opening lid, a removed-word chip and undo. The bin itself
  turns green/red with a check/cross beside its icon. An accepted mistake stays
  neutral and is crossed out, then swallowed as the lid closes with a small
  bounce (850ms). A wrongly selected word stays visible. This grades selection
  separately from replacement spelling. Motion respects reduced
  motion, and the bouncing game reward has space below the success message.
  Short phones use tighter spacing, one row for four/five keys and space for the
  theme control. The game reward scrolls into view if the card needs scrolling.
- Follow the main app's language split in both presentations: exercise titles
  and controls (CHECK, CLEAR, Bin, GET POWER UP) are English; instructions,
  feedback, navigation/retry, summary and accessible guidance are Simplified
  Chinese. Practice sentences, source words and answer letters stay English.
  Page language is zh-CN, English headings/controls/sentences use en, and UI
  fonts include Chinese system fallbacks.

### Approved PU3 U9 p109 missing-word boards

| ID | Sentences | Target answers in order | Reusable letter keys (shuffle for display) |
|---|---|---|---|
| M1 | I washed my hands ___ I ate lunch. / I ate lunch ___ I washed my hands. | before / after | a b e f o r t |
| M2 | He put on his socks ___ he put on his shoes. / He put on his shoes ___ he put on his socks. | before / after | a b e f o r t |
| M3 | We bought tickets ___ we went into the cinema. / We went into the cinema ___ we bought tickets. | before / after | a b e f o r t |
| M4 | She dried her hair ___ she had a shower. / She had a shower ___ she dried her hair. | after / before | a b e f o r t |
| M5 | I cleaned my teeth ___ I went to bed. / I laughed ___ I heard the funny joke. | before / when | b e f h n o r w |
| M6 | He had breakfast ___ he got dressed. / I waved ___ I saw my friend. | after / when | a e f h n r t w |

### Find-and-fix feedback

Keep two visible grading channels:

1. Turn the bin green with a check beside its icon if the correct mistaken word
   was binned. Cross out the neutral word and swallow it in a short animation.
   Turn the bin red with a cross for an already-correct word, keeping that word
   visible. Add a short text message identifying this dimension.
2. Colour replacement characters against the expected correction and label the
   replacement spelling result independently. This can be green even while the
   bin is red. Completion requires both channels to pass.

Thus binning TV and entering watches means incorrect word selected, replacement
spelling correct. Binning watch and entering watchs means correct word selected,
replacement spelling wrong. In either case, reset both actions after feedback.

### Sorting distinction

Sentence scramble orders word tiles into one grammatical sentence. Sorting
assigns independent cards to labelled categories, and order within a category
does not matter. For Think1 U3 p37, apples/eggs belong under How many and
bread/water under How much. For PU2 U2 p19, Monday/Friday are weekdays and
Saturday/Sunday are weekend. Grade only when the entire board is submitted,
then reveal category-placement feedback and reset wrong boards in full.

## Implementation considerations discovered in review

- Legacy content uses `sentences` and `sentencePairs`; several game and Study
  paths read them. A content migration needs compatible readers across both.
- Legacy SR uses trimmed lowercase sentence text for scrambles and
  trimmed lowercase `a | b` for matching. Preserve these identities when
  reorganizing the content so existing students do not lose learning history.
- Client SR delta helpers and server SR merging enumerate existing buckets;
  new exercise state must be supported through the entire save/load path.
- Page proximity currently counts positions in `AVAILABLE_CONTENT`, not gaps
  between printed page numbers. The existing unseen-item algorithm uses
  `random * 0.2 ** distance`; it is a biased ranking, not an exact weighted draw.
- Existing SR generally prioritizes failures and due items, with a new-item
  quota. The new selector must reserve enough eligible types before filling
  the remaining slots; otherwise a final shuffle cannot guarantee variety.
- The SR session clock advances at most once per student/device/calendar day.
- Current ordinary selection has an early return that can bypass the intended
  cooldown fill; matching has a separate fill path. Test the confirmed fallback
  directly in the new selector.
- Current automatic page advancement checks legacy buckets. Adapt it deliberately
  for the new exercise group rather than relying on renamed properties.

## Curriculum review notes

Reviewed the current production content packs, not uncommitted main-checkout work.
Populated page counts: PU1 44, PU2 35, PU3 19, Think0 10, Think1 15, Think2 13.

Avoid automatic wholesale exercise generation: the legacy curriculum contains
some incorrect items and metadata mismatches. Examples include PU2 U2 p19's
`Tuesday comes before` / `Monday` pair, PU1 metadata for absent U2 pp24–25,
and PU2 U4 p47 content omitted from its selectable-page metadata. These are
observations only and have not been changed in this proposal.

Verified source anchors:

- `content_pu1.js:61` — U0 p8 locations.
- `content_pu1.js:78` — U1 p9 singular/plural location sentences.
- `content_pu2.js:447` — U2 p19 days.
- `content_pu2.js:926` — U5 p62 positions.
- `content_pu2.js:1065` — U7 p85 past tense.
- `content_pu3.js:306` — U2 p28 relative clauses.
- `content_pu3.js:590` — U6 p69 timetable.
- `content_pu3.js:838` — U8 p99 movement prepositions.
- `content_think0.js:445` — U3 p30 family relationships.
- `content_think1.js:52` — U1 p19 present simple.
- `content_think1.js:126` — U3 p37 countability.
- `content_think2.js:105` — U2 p29 for/since.
- `content_think2.js:513` — U10 p101 past perfect.
- `content_think2.js:615` — U12 p119 permission.


## Preview integration (2026-10-13)

The approved POC widget is shared with real Study/game flows. Preview Round D
contains five SR/page-weighted boards with at least three eligible types;
cooldown fills shortages without forcing variety. Matching counts once with
three independently tracked pairs. New typed outcomes use namespaced keys in
the existing sentences SR bucket. Vocabulary and legacy SR identities remain
unchanged. The runtime gate limits the feature to preview/development pending
the later production release. Required pool and real-app browser checks cover
selection, progression, first-failure retention, wire deltas and reward plumbing.
