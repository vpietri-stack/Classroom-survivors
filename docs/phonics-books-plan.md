# Phonics books for Classroom Survivors

The series moves from recognising letters and their sounds to blending words and reading sentences. The first lesson to design is **Phonics 1, Unit 1 (A, B, C)**.

## Phonics 1 · Single letters

Cover A–Z. Learners recognise the shape of each letter and hear its sound at the beginning of example words. Each example follows the same sequence: letter name → letter sound → whole word. After the individual letter pages, review the unit’s letters together.

### First units · A, B, C, picture book, then D

| Page | Letter | Letter name | Focus sound | Example words |
| --- | --- | --- | --- | --- |
| 1 | A a | “ay” | /æ/ | apple, axe, alligator, astronaut |
| 2 | B b | “bee” | /b/ | banana, ball, bear, bag, bike |
| 3 | C c | “cee” | /k/ | cat, cup, caterpillar, cactus, camera |
| 4 (Unit 1) | Picture book | — | A–C review | The Big Bag |
| 5 (Unit 2) | D d | “dee” | /d/ | dog, door, dice, donut, dolphin, dinosaur |

The teacher's latest structure puts a short picture book at the end of each unit.
Unit 1 is A, B, C, then The Big Bag on curriculum page4. D moves to Unit2/page5;
the runtime assignment migration follows with final reader/Study integration.
Picture books use that unit's words, earlier units when useful, and simple sight
words. Preview repetition is optional; Study requires sentence repetition.
The Big Bag has ten illustrated story pages; its revised text and art are in
`phonics1-u1-the-big-bag.md`. Its narration uses the teacher's supplied complete
story recording, split by page with natural pitch and delivery preserved.

B/C letter diagrams contain five picture compartments per letter, and D diagrams contain six. Existing artwork and animation assets live under `media/phonics/p1-u1/b/`, `c/`, and `d/`. The teacher’s recordings for all sixteen B/C/D words are paired in the parameterised reader `phonics1_letter_notes.html?letter=b|c|d`, with word clips, letter sequences and recording-timed animations. Phonics 1 is available in the full app’s local assignment selector and native Study flow.

On page 1, the sequence is “ay” → /æ/ → *apple*, then repeats for *axe*, *alligator*, and *astronaut*. Use the same pattern for each word on pages 2 and 3. The phoneme symbols here specify the sounds for lesson authoring.

The first preview reader is `phonics1_u1_a_notes.html`. It contains five immediately switchable screens, beginning with illustrated A/a diagrams with four picture compartments each, followed by apple, axe, alligator, and astronaut. Each word screen has a static picture that plays the recorded word and an animated picture that plays the teacher’s full recording. The opening screen plays the teacher’s recorded “ay, ay, ah, ah, ah”. Animation follows audio playback time, including at slower speed. The reader uses the shared `notes_speech.js` recorder and pronunciation feedback, with Chinese meanings, replay, and stop controls. Timings and saved MP3s load through `media/phonics/p1-u1/playback-data.js`, using the existing notes’ bundled-audio Blob playback approach. This is the preview-design stage before exercises and curriculum registration.

For recording practice in the A preview, a static word picture targets that one word. An animated picture targets the full spoken sequence, for example “alligator. Ay, ay, ah, ah, ah. Ay, ah. alligator.” The introductory letter picture targets “Ay, ay, ah, ah, ah.” The same selected text appears in the shared player and supplies the shared speech check.

## Phonics 2 · CVC words

Teach consonant–vowel–consonant words in short-vowel units, with one word family per page. Keep this book at word level. For each word, say the letter names, sound out the letters in order, then blend and say the whole word.

### Unit 1 · Short A

| Page | Word family | Words |
| --- | --- | --- |
| 1 | `-at` | cat, rat, bat, mat, hat |
| 2 | `-am` | ram, ham, jam, dam |

For *cat*, say “cee, ay, tee” → /k/ /æ/ /t/ → *cat*. The other words follow the same sequence. Add more word families and short-vowel units as the book develops.

## Phonics 3 · CVC sentences

Use familiar CVC word families in short sentences. Introduce the sight words needed for sentence reading.

### Unit 1 · Short A sentences

Introduce **The**, **is**, **on**, and **has** for word recognition. Page 1 focuses on `-at`.

- The cat is on the mat.
- That rat is fat.

*That* is an additional word to introduce or support if the second sentence is used.

## Phonics 4 · Long-vowel patterns

Teach CVCe, `oo`, and `ee`. Introduce more sight words and use longer or more complex sentences.

### Unit 1 · Long A

Page 1 compares `-an` with `-ane` so learners can hear and read the change from short A to long A.

- The can is next to the cane.
- The fan is on the lane.

## Possible later book

Phonics 5 could cover consonant blends such as `gr` and `pl`. The current series plan covers Phonics 1–4.

## Next design discussion · Phonics 1, Unit 1

The teacher-reviewed Study selection, Rounds A–D, SR outcomes, and proposed advancement timing are recorded in [Phonics 1 Study design](phonics1-study-design.md).

- **Preview notes.** Consider a large uppercase and lowercase letter, with three picture-and-word examples that play the letter name, initial sound, and word in order.
- **Exercises.** Consider separate tasks for matching letter shapes, hearing a sound and choosing its letter, and choosing a picture whose word starts with that sound. Use the fourth page to mix A, B, and C.
