# Phonics 1 Study design

Decisions from the teacher’s review on 19 November 2026. This document specifies the proposed exercises for implementation. The current reader is `phonics1_u1_a_notes.html`.

Full-app local integration now registers Phonics 1 / Unit 1 / pages 1–4 in the teacher assignment selector and shared preview catalog. `phonics1_letter_notes.html?letter=a|b|c|d` uses the supplied recordings for all twenty words. Start the assigned preview’s practice button to run `phonics_study.js` inside the real app, with ordinary analytics, session credit and recovery. The earlier account-free `phonics1_u1_a_study.html` remains a separate trial. Candidate-API completion-marker verification is required for publishing. At the final authored page only, a short eligible pool is filled from cooldown items so a four-word session remains available.

The reader’s final screen offers **开始练习**, opening `phonics1_u1_a_study.html`. The account-free trial runs A–D with the four A words and uses the regular Study overlay, stylesheet, progress indicator, `SpeechUI.makeRecordButton`, and actual `nextRoundDWord` handwriting round. The Phonics branch fixes the handwriting gap to the initial letter and uses four round labels. Results use the existing SR engine. Functional state is saved under the device-local `phonics1-a-study-trial-v1` key, separate from student records and weekly credit. Its reset button explicitly clears the trial. Future B/C distractors use the planned banana/bear/ball and cat/cup/cactus entries, with temporary pictograms. B-page preview and production account integration remain future work.

Teacher review correction: the original trial successfully checked the letter sequence and the apple, alligator, and astronaut sequences. Only the axe sequence was reported to reject correct speech. The preview also successfully checked all its prompts. The later general conclusion about unavailable phoneme assessment was unsupported and its bypass has been removed. The regular Study controls now again send the full original sequence target (`Ay ay ah ah ah` or `Ay ah <word>`) to the same shared engine and require every returned part to be green, with the agreed three-failure skip and genuine technical fallback. An optional recognition-details disclosure shows the actual transcript and each part’s outcome for diagnosing the axe-specific mismatch. Its cause remains unconfirmed. Resuming an older trial clears speech-gate flags from the temporary bypass while preserving word SR outcomes.

The teacher’s axe diagnostic showed `A, a, x.`. A trial-scoped ordered transcript alias now recognises exactly three slots: A/ay, a/ah/ae/æ, and axe/ax/x, and only when the shared engine reports an assessed recording. It maps those slots to the expected axe sequence’s feedback. Other prompts use their existing shared-engine results. This is recognition normalisation and still needs teacher audio review. The trial now mounts the actual production `SpeechUI.makeSentenceGate` panel, with an opt-in all-parts-green/three-attempt policy, and restores the production saved theme with dark as the default. It no longer hardcodes the orange child theme or builds a separate recording panel.

## Session selection

- Select four distinct words using existing SR priority from the current page and earlier pages.
- Derive the required letters from those four words. Include each required letter once, with uppercase and lowercase together. Letters have no independent SR records.
- On page 1, the session therefore contains A a and the four words apple, axe, alligator, and astronaut.
- Present required letters first in alphabetical order, then the four words in alphabetical order in Round A.
- Distractors are randomly selected from other pages of Phonics 1, including future pages. A distractor appearance alone produces no SR outcome and does not introduce that page as an assignment.

## Round A · Listen and repeat

Speech false-positive correction: the full-app Phonics 1 reader and Study opt into `phonics_speech_evidence.js` through the shared speech bridge. Reject quiet/brief audio before assessment and require ordered independent-transcript corroboration for every green part; target-conditioned encouragement alone cannot grant green. Recognise explicit letter-name/sound spelling aliases, retain the scoped `Ay ah axe` → `A a x` normalisation, and allow a single spelling edit for longer words only with the existing model's support. This remains recognition feedback, not a validated phoneme pronunciation grade. Teacher review must include silence, unrelated speech, and correct sequences; no automated checks were run during the build phase.

Show the illustrated letter diagrams and picture-plus-word cards used in the preview.

- A letter target plays its full sequence, for example `"A" - "A" - "/æ/" - "/æ/" - "/æ/"`.
- A word target plays the letter name, initial sound, and word, for example `"A" - "/æ/" - apple`.
- The recording target must match the selected audio sequence.
- Teacher-recording diagnostics and the Phonics-only decoding/repetition safeguards are documented in `phonics-speech-recording-review.md`. When a short sound cannot be assessed despite a recognisable name, word onset and audible middle attempt, retain neutral sound feedback and allow technical continuation rather than penalising the child.
- Round A checks the letter name and isolated sound separately, then focuses the word check on its initial sound while being gentle about the remainder. `Ay ah astrornffri` may turn all three parts green; `Ay ah ostronaut` must leave the word ungreen. The `phonics1-initial` profile uses dictionary initial phones for recognised words and a conservative spelling-based onset approximation for unknown/nonsense words. It is not an acoustic phoneme grade and depends on the independent recogniser retaining the spoken onset. Silence/unrelated-initial safeguards remain in place. Preview recording checks keep their existing whole-word policy.
- When the microphone works, the learner must attempt the recording. Every part of the selected spoken sequence must turn green to advance. After three unsuccessful assessed attempts on the target, skipping becomes available.
- A technical microphone or speech-model failure allows immediate continuation without waiting for three unsuccessful attempts. Technical failures do not count as pronunciation failures.
- If microphone permission or microphone access is unavailable altogether, skip Round A for that session and continue to Round B. Request access again at the next new Study session. The session skip must not permanently disable future microphone requests.
- Round A does not update SR.

## Round B · Picture and word recognition

- Target the session’s required letters and four selected words.
- Show three choices. Letter diagrams and picture-plus-word cards may appear together in a question.
- Letter questions play the letter sequence. Word questions play only the word.
- Keep all three options available after an incorrect click. Schedule a fresh presentation after two other questions, with shuffled positions.
- A correct first click on a fresh presentation clears that target’s retry requirement. An incorrect initial encounter remains recorded as an error even when later practice succeeds.
- If only one failed target remains, repeat it immediately with its correct option in a different position.
- Round B does not update SR.
- Recognition rounds B and C advance automatically 650 ms after a correct click, after green feedback and the normal success sound. No Continue button is shown. Resume retains an answered question and completes its pending advance without recording the answer again.

## Round C · Word and letter recognition

- Target the same required letters and four selected words.
- Each question has three text choices. Letter questions show choices such as `A a`, `B b`, and `C c`. Word questions show written words without pictures. Keep the two question types separate.
- Word and letter choices use equally large, responsive cards, using the available desktop width and fitting longer words to each card.
- Highlight each word's initial in red; on uppercase/lowercase letter choices, highlight the lowercase letter in red. Keep the focus readable on either purple or correct-answer green cards.
- Letter questions play the letter sequence. Word questions play only the word.
- For a word target, both distractors must start with a different letter from the target. Select them randomly from other pages of the same book, including future pages. There is no requirement that the two distractors have different initials from one another.
- Use Round B’s retry spacing and changed-position rule for a lone remaining failure.
- Only the first click on the first presentation of a selected word determines its SR result. A wrong first click remains a session failure even after a successful retry.
- Feed these word outcomes into the existing SR engine, retaining its intervals, recovery behavior, and repeated-lapse exception.
- Letter questions are practice targets derived from the words. Their results have no independent SR entry. They do not change the words’ SR outcomes.

## Round D · Handwrite the initial

- Use the four selected words. Show the picture without its full-word label and show the written remainder with the first letter missing, for example `_pple`.
- Load the Phonics picture-only artwork exclusively; do not start the regular vocabulary image loader, whose asynchronous result can replace or hide the Phonics illustration.
- Play the letter name, initial sound, and word, for example `"A" - "/æ/" - apple`.
- Accept either uppercase or lowercase for the missing initial.
- Reuse the existing regular Study handwriting controls, recognition, and failure-dependent skip rules. For Phonics 1 only, show the tracing guide immediately for every initial letter, including resumed exercises.
- Handwriting has no SR effect. Word outcomes are determined by Round C.

## Completion and recovery

- A completed session through Round D earns one normal Study credit.
- Interrupted sessions resume the same selected words, required letters, current round, retry queues, and original Round C outcomes. Resuming cannot replace a failed first attempt with a later success.
- Preserve each target’s speech-attempt and handwriting assistance/skip state through recovery as needed to retain its completion rules.

## Page advancement

Full-webapp integration follow-up from teacher review: use the production theme-toggle button and the usual correct/wrong answer sound feedback, alongside the regular Study controls. Those remaining interface gaps are deferred while B, C, and D assets are prepared.

Confirmed trigger: if the current and earlier pages supply fewer than four eligible words because others are in SR cooldown, move forward to obtain more words. Show the new page’s preview before the learner can practice, play, or study its material.

Example: a page-1 learner recognises axe correctly on the first Round C attempt and initially misses apple, alligator, and astronaut. In the next session, those three words are due and axe is in cooldown. Advance the learner to page 2, show the B b preview, then select the next four words using SR priority across pages 1 and 2. The new letter set follows whichever words are selected.

Recommended timing, awaiting teacher agreement: finish and save the current session before evaluating automatic advancement. Keep any interrupted session on its original page and item selection. Evaluate the pool at the next activity boundary, then require the new preview before launching practice, play, or Study. Use durable completion and preview markers so refresh or retry cannot bypass the preview or advance the same learner twice.

Remaining edge cases to settle before implementation:

- How to form a session at the final available page when fewer than four words are eligible, and how letter-only review pages participate in advancement.
- Whether Round D presents its four targets one at a time or together.
