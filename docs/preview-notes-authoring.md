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
Keep an audio-source manifest. Preview notes offer listening and can include optional speaking when approved.
There is no required number of listens or recording attempts. Retain replay, slower playback,
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

Also add the textbook/workbook page thumbnails (`150×189` WebP) under
`images/notes_thumbs/` (e.g. `<id>-pb-p<N>.webp` and `<id>-ab-p<N>.webp`, or
`sb`/`wb` for Think) and register them in `NOTE_THUMBS` in `preview_notes.js`
so the **预习笔记** library displays the page thumbnails for the new note.

## Preserve the student flow

New lesson-specific Study variants reuse the regular Study overlay, styling, and speech/handwriting controls. Use the actual `SpeechUI.makeSentenceGate` panel and the production saved-theme/default-dark behavior. Keep custom round rules within those interfaces when building a local trial.

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
  the main-menu library lets the student reopen studied notes for optional listening and speaking
  practice, without forcing another Study session or awarding extra credit.

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

## Image publishing workflow

Keep the approved PNG masters. Run `python scripts/export-notes-images.py <master.png> ...` with Pillow installed to export full-resolution WebP at quality 90. Update the lesson's `notes_data.js` manifest to reference the WebP while preserving its dimensions and hotspot coordinates. A registered reader must load that manifest by script tag.

`node scripts/check-notes-images.cjs` checks every registered lesson. It requires WebP, matching image and manifest dimensions, at most 450 KB per image, and at most 1.5 MB of distinct images per lesson. The release suite runs this check automatically. Review the smallest English and Chinese text at phone width and zoom, then tap representative hotspots before publishing. The reader loads the first image eagerly and lazy-loads later images.

Optional approved speaking uses the shared AdaptiveSpeech model and onset-preserving Recorder. All three production readers support single words, phrases and sentences. Speaking does not gate Study or grant credit.

## Picture-book main-menu shortcut

Register picture books with `kind: 'picture-book'` and a short `storyTitle` in
`previewNotesCore.js`; provide a cover through the ordinary note thumbnails.
They remain in the usual book/unit catalog. The main menu also shows 故事书
immediately below 预习笔记 once that student has opened at least one picture
book. One known story opens directly; several show a large cover chooser.
The shortcut opens the existing preview in review mode, with a route back to
the story chooser, and does not change the student's assignment.

A successfully loaded reader records the first opening, without requiring audio,
recording, or Study completion. Access is stored separately from note completion:
`pictureBooks[noteId] = { firstOpenedAt }`, scoped locally by account/environment.
Known completed picture-book notes and their valid Study analytics also provide
historical access evidence. Older unfinished previews had no opening record;
opening them once with this feature adds them to the shortcut.

`picture-book-access` events (`data.id`, timestamp, stable eventId, ownerId) use
the existing durable analytics queue and retries. They are not session events,
do not finish recovery, grant target/Study credit, increment sessions, or change
SR. `PreviewNotesState.apply` merges valid catalog picture-book access into the
student record during the existing ETag-protected analytics save; the login
response already includes that field. Access survives catalog version changes.
Unknown/non-picture-book IDs are ignored, and every frontend refresh/load checks
the active account. Preview access can also be reconstructed from retained
analytics while the hosted preview API is still running its previous catalog.

For publication, verify candidate-API access persistence across sign-out/device
changes and analytics retention, a fresh account's hidden button, account swaps,
first opening without completion, completed-book backfill, the one/many-story
routes, and no credit/SR/assignment changes. These server changes require the
candidate API with isolated student data; the local-review build does not run
automated checks or browser walkthroughs.
