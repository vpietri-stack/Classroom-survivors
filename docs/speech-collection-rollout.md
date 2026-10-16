# Speech collection: preparation and staged launch

Prepared 2026-10-15; wider collection authorized 2026-10-16 after the teacher
confirmed consent from all current users. This feature changes research intake,
not recognition or grading. The consent list is a snapshot of current student
accounts; future accounts are not automatically enrolled.

Students use the app independently or with parents at home for review and
practice. The pilot observes that normal home use; it is not a scheduled
classroom activity or a request for families to practise simultaneously.

## Fixed limits

| Control | Limit |
|---|---|
| Capture closes | 2026-10-19 00:00 China time, end of Sunday October 18 |
| Per student | 30 recordings total, including existing clips |
| Clip size | 300,000 raw WAV bytes / 400,000 base64 characters |
| Client retention | Two pending clips including consent/encoding/in-flight work |
| Client deadlines | 2 seconds for app-key lookup or encoding; 8 seconds per HTTP operation |
| Queue age | 30 seconds, memory only, no upload retries |
| Global intake | One 15-second reservation across all Functions instances |
| Cooldown | At least 2 seconds after completion, increased by measured RU charge plus a 20 RU overhead allowance |
| Research RU target | About 100 RU/s averaged over completed writes, not hard isolation |
| Research SDK | Separate singleton, 4-second request timeout, no throttling retries |

At 100 accounts × 30 clips: approximately 600 MB at the observed average, or
1.2 GB of base64 payload at the hard size limit, before metadata/indexes. No
database throughput or service tier is increased. Old clips are retained and
count toward 30; accounts already above 30 simply stop contributing.

## Private consent list and launch switch

Use exact authenticated student IDs and individually obtained consent. No
wildcards, name matching, or IDs in commits. API app settings:

- `SPEECH_SAMPLE_CAPTURE_ENABLED`: only `true` enables collection. Unset/false
  is the launch/kill switch; the server rechecks it on reservations and uploads.
- `SPEECH_SAMPLE_CONSENTED_IDS`: approved IDs only; empty/unset consents nobody.
- `SPEECH_SAMPLE_MAX_PER_STUDENT`: optional integer 1–30, default 30. Invalid
  values close intake; the setting cannot raise the hard cap.
- `SPEECH_SAMPLE_CAPTURE_ENDS`: optional earlier end. Invalid dates close
  intake; app settings cannot extend the agreed collection window.

Consent refreshes every 60 seconds and on account/token changes. Recording
ownership is captured before mic access; queued requests use that same session
token. The server independently checks body ownership against token identity.

## Readiness and operator commands

From the repository root, use a private settings file containing
`Values.COSMOS_ENDPOINT` and `Values.COSMOS_KEY`. Commands explicitly select
their database rather than inheriting a local preview override.

```powershell
# Read-only status, including recent write cost and progress-save timing.
node api/speech_collection_ops.js status --settings <private-settings.json>

# Read-only index plan; existing configuration is untouched.
node api/speech_collection_ops.js prepare-index --settings <private-settings.json>

# At release: back up, apply only the audio exclusion, and verify it.
node api/speech_collection_ops.js prepare-index --settings <private-settings.json> --apply

# Synthetic write-cost/concurrency probe ONLY in the existing test container.
# Finally deletes only this run's uniquely named records, including on failure.
node api/speech_collection_ops.js probe --settings <private-settings.json> --database Val-EslApp-Test --container Students
```

Index backups go to gitignored `speech_samples/ops/`. To reverse the change,
restore only the backed-up indexing policy on that same container, preserving
current configuration/throughput. No new database or paid logging service is
created. Leave the existing separate 400 RU/s test allocation unchanged.

The isolated probe temporarily applies the intended audio index exclusion to
the test container, saves a private policy backup, and restores its original
policy in `finally`. Its payloads contain synthetic random bytes, not voices.
The 300,000-byte raw limit is about 9.4 seconds at 16 kHz mono PCM; longer or
higher-sample-rate clips can be omitted from research without changing lessons.

Before publication, run root `npm test`, backend `npm test` against an isolated
local host, and the real-Cosmos probe. Follow the normal preview/release process.
Preview Pages alone does not deploy API changes. The integrator synchronizes
the three app stamps at release; speech sub-resource counters are advanced here.

### Preparation checks completed on 2026-10-15

- Full root `npm test` passed, including the new client/concurrency and real
  browser checks. The isolated backend suite passed all 26 checks.
- In the existing test container with the proposed audio index exclusion,
  atomic sample/quota writes cost about 111 RU for 200,000 base64 bytes and
  197 RU for 400,000 base64 bytes. Including the surrounding research operations,
  measured charges were 128–133 RU and 214 RU respectively; the final coordinator
  update is covered by the separate pacing allowance.
- Three synthetic progress writes during the probe completed in 731–743 ms,
  versus 1,081–1,090 ms immediately beforehand. This tiny sample over the
  operator's network establishes neither an improvement nor production headroom.
  Azure's production monitoring endpoint was unavailable. The existing several
  days of consented home use already constitute the initial pilot; deployment
  validation checks the new safeguards without restarting that pilot.
- Every uniquely named probe record was removed, and the test container's
  original indexing policy was restored and independently verified. Production
  settings, consent IDs, indexing and throughput were not changed.

## Staged activation

1. Publish frontend/API with expanded intake disabled. Verify the served client
   includes `/reserveSpeechSample`, the API route exists, and CORS is registered.
2. Verify the audio index exclusion and deployed default-off/consent/size gates.
   The existing consented group has already supplied the home-practice pilot.
   Validate the new reservation/upload path using synthetic audio in the
   existing isolated test environment; do not add a synthetic child or audio
   to production to test it.
3. On the teacher's expansion approval, privately snapshot all current student
   account IDs into the exact consent allowlist and enable capture. Keep the
   hard cap and existing closing date. Compare status before and throughout home-practice
   periods, including naturally busy evening periods. Status reports recent
   research charge/duration and the last progress save's
   `serverSaveMs`/`progressWriteRu`. The latter excludes network time and the
   diagnostic upsert; one last-value record is not a historical p95.
4. Check normal practice and save/delivery behavior, including slower home
   connections. Research timeouts or dropped clips are acceptable; interrupted
   practice or lost progress are not. If progress slows or repeated throttling
   appears, disable research; do not raise RU/s to preserve samples.
5. Verify the deployed consent response for every enrolled identity, exclusion
   of an unlisted synthetic identity, and unchanged throughput. Future accounts
   need separate consent and an explicit list update. A synthetic probe cannot
   certify production peak load; retain the kill switch for live follow-up.

## Evaluation and removal

Graded, too-short, too-quiet, and hallucination recordings can enter research.
Ungraded clips have `pass: null` and an explicit `outcome`; they are not failed
English answers and do not consume grading rungs. Cancelled audio is discarded.
WAVs are already front-trimmed and cannot evaluate lost original leading audio.

The downloader streams ten clips at a time and excludes quota/control records.
`--limit` bounds actual reads. Target is the expected prompt, not human ground
truth. Keep human transcripts/teacher acceptability labels in a separate working
copy, because export regenerates the machine manifest. Hold some children out
entirely when tuning thresholds.

Delete cloud/local audio and manifests after calibration under the agreed
retention scope. Closing intake does not itself delete stored recordings.
