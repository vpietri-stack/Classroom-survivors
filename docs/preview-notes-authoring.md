# Creating another 预习 lesson

This is the workflow approved after testing PU3 Unit 9, printed page 111.

## Prepare and review the lesson

Inspect the exact textbook page and existing curriculum mapping first. Use the
saved ESL preview preferences: English target language and original illustrated
examples, with simplified-Chinese explanations for approximately ten-year-old
Chinese ESL learners. Review a numbered content draft before new curriculum or
visual content is created. Reuse existing exercises; search all typed catalogs
before concluding that missing-word or find-and-fix boards are absent.

Keep the approved infographic pages, including the introductory explanation.
Add aligned click targets to vocabulary words and illustrated sentences. Every
target should play its matching saved MP3. Check existing audio first; Youdao
word audio and Sound of Text are the established sources when clips are missing.
Keep an audio-source manifest. Preview notes are listening-only: no microphone,
speech grading, or required number of listens. Retain replay, slower playback,
mobile zoom, and the same-file full-download audio fallback.

## Register the reader

Use a lesson-specific reader/data manifest and assets without overwriting an
earlier lesson. The first example is `interactive_notes_poc.html`,
`interactive_notes_data.js`, and `interactive_notes_assets/`. Its embedded mode
accepts `embed=1`, `mode=intro|review`, and the parent's request nonce. Reuse the
validated parent/iframe message contract and owner/origin checks.

Add the lesson ID, exact book/unit/page, content version, Chinese-friendly title,
and reader path to `api/src/functions/shared/previewNotesCore.js`. The catalog
is shared by browser and server: ship both when registering another lesson.
Avoid changing an existing lesson's ID; deliberately increment its version only
when requiring its preview Study to be completed again.

## Preserve the student flow

- On login, an unfinished registered page opens automatically, whether assigned
  by the teacher or reached through SR advancement. Advancement pauses there.
- The final **开始学习** button has no listening requirement. It starts five
  random distinct vocabulary items from that exact page's existing vocab array.
- Run the normal recognition, word-scramble and handwriting rounds, followed by
  five random distinct page-only non-spelling exercises. All four existing types
  are eligible: sentence scramble, sentence pairs, missing word, and find/fix.
  A random selection need not include every type in each session.
- Use ordinary exercise logging, first-attempt SR, acknowledged offline-capable
  saving and one regular Study session credit toward the weekly target. A full
  completion adds `data.previewNote` to that same session event. Partial exits
  do not complete the preview; it opens again at the next login.
- Durable completion lives in the existing student record's bounded
  `previewNotes` map, separately from archived analytics. Local mirrors are
  scoped by student and environment (`production`, `preview`, or `local`).
- Hide **预习笔记** until the first preview Study has been completed. Afterwards,
  the main-menu library lets the student reopen studied notes for listening-only
  review, without forcing another Study session or awarding extra credit.

## Verify and publish

Check every hotspot and audio mapping, intro-page inclusion, phone layout and
audio fallback. Exercise actual Study progression, strict page-only selection,
all four widget types, interruption/relogin, first-completion library visibility,
account isolation, fresh-cache server restoration, SR and single weekly credit.
Extend the existing `test_preview_notes_*` and reader checks as appropriate.

Use dedicated checkouts and explicit staging. Preview first, verify hosted
assets and API behavior, then promote only the approved feature after the user's
production approval. Keep curriculum, API routes and student databases separate;
never promote unrelated preview content. Synchronize the deployment stamps and
changed asset queries. Preserve the existing isolated preview API PR environment.
