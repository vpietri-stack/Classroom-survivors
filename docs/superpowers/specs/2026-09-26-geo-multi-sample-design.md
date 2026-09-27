# Geo v2 — Multi-Sample Consensus Home Location — Design

Date: 2026-09-26
Status: Approved in chat (user confirmed per-login cadence + unique-day mode)
Supersedes the capture/retention sections of: `2026-09-25-student-geolocation-design.md`

## Problem (observed in production)

v1 captures one fix per student, forever (`csGeoDone_<id> = ok` stops re-capture;
server stores latest-wins). Consequences seen 2026-09-26:

1. **Trip contamination**: Zozo's single capture is ~20 km north of the city
   (a trip, not home). Zoe shares the identical coordinate (same household/
   trip) — neither reflects where they live.
2. **No self-healing**: a bad first capture is permanent; deleting the server
   field does NOT re-trigger capture because the client ok-flag persists.
3. **No teacher control**: no way to clear a student's location from the
   dashboard (v1 spec explicitly deferred the UI).

## Design decisions (user-approved)

- Capture on **every login** (not once/day, not once/ever). Accepted cost:
  iOS Safari re-prompts per login; Android/Chrome stays silent after allow.
- Home = **unique-day mode**: the ~1 km cell seen on the most distinct
  Beijing-time calendar days wins; ties broken by recency. Raw sample counts
  never vote (a 20-login day = 1 day-vote).
- Privacy invariants from v1 unchanged: client rounds to 2 decimals before
  send; server re-rounds; no history beyond the capped sample list.

## Architecture

### 1. Client — `frontend_auth.js`

- `csMaybeCaptureGeo()`: **remove the `status === 'ok'` gate** — capture on
  every login. Keep writing the flag (`{status, ts}`) for diagnostics only.
  Keep the failure path as-is (nothing enqueued, retried next login naturally
  since there is no gate anymore).
- Event shape unchanged: `{ type:'geo', lat, lng, timestamp, eventId, ownerId, ps }`.
- No change to queueing/flush (rides `analyticsQueue` as in v1).

### 2. Server — `api/src/functions/saveAnalytics.js`

Replace `extractGeoUpdates`'s single-geo output with a **samples + consensus**
updater, still exported pure for tests:

```
applyGeoSamples(user, geoEvents) -> { changed: boolean }
```

Behavior (operates on the student doc `user`):
- Validate + re-round each fix (same rules as v1; invalid dropped, all geo
  eventIds still acked).
- `user.geoSamples`: append-only list of `{lat, lng, capturedAt}` (Beijing
  date derived from `capturedAt`).
  - **Dedup rule**: skip a fix if `geoSamples` already contains the same cell
    (`lat,lng` 2-dec) for the same Beijing date (keeps first-of-day per cell;
    different cells on the same day are both kept — home+school diversity).
  - **Cap 30**, oldest trimmed.
  - **Legacy seed**: if `user.geo` exists but `user.geoSamples` does not,
    seed samples with the legacy `geo` entry before appending (v1 data counts
    as one day-vote, not silently discarded).
- Recompute `user.geo` = consensus:
  - Group samples by cell; count distinct Beijing dates per cell.
  - Winner = most days; tie → cell with the latest `capturedAt`.
  - `geo = { lat, lng, capturedAt /* latest in winning cell */, source:'browser', days /* int */, samples /* total kept */ }`
  - v1 consumers (dashboard coverage, CSV, map HTML) read `lat/lng/capturedAt`
    and keep working unchanged — `days`/`samples` are additive.
- Handler: call `applyGeoSamples(user, geoEvents)` inside the existing
  optimistic-concurrency loop where `if (geo) user.geo = geo;` is today;
  `extractGeoUpdates` keeps returning `cleanEvents` + `geoEventIds` (its
  `geo` single-value output is removed).

Beijing date helper: `new Date(ts + 8*3600e3).toISOString().slice(0,10)`.

### 3. New endpoint — `api/src/functions/clearGeo.js`

Privileged-only, following the `getStudentArchive.js` pattern:
- `POST /clearGeo`, body `{ studentId }` (or `?studentId=`).
- `validateApiKey` → `auth.requireAuth` → `auth.isPrivileged(token, ['teacher','BM','admin'])` → 403 otherwise.
- Cosmos `patch` remove `/geo` and `/geoSamples` (ignore "path not found").
- Returns `{ status:200, jsonBody:{ success:true } }`.
- After clearing, the student's next login re-captures automatically (client
  has no gate anymore) — this is the "request recapture" mechanism.

### 4. Dashboard — `teacher_dashboard.js/.html` + `geo_export.js`

Student Locations panel (Settings tab) gains:
- `renderGeoList()`: one row per student WITH geo: name, capturedAt (date),
  `days` (confidence), sample count, and a **清除位置** button per row →
  `POST /clearGeo` → refresh + toast. Empty-state text when no data yet.
- Shared-coordinate flag: students whose winning cell equals another
  student's winning cell get a `同址` badge (catches siblings/trip twins).

`geo_export.js` changes:
- CSV columns become:
  `studentId,name,hasLocation,capturedAt,days,samples,wgs84_lat,wgs84_lng,bd09_lat,bd09_lng,sharesCellWith`
  (`sharesCellWith` = comma-joined other studentIds in the same cell, else empty).
- Map HTML: marker label shows `name (Nd)` where N = `geo.days` when present.
  No other map changes (Baidu-driving remains dormant pending an AK).

### 5. Immediate Zozo/Zoe handling

`api/_geo_clear.js` (untracked, one-off) remains valid for prod cleanup NOW;
once v2 ships the dashboard 清除位置 button replaces it. Clearing before v2
still leaves their ok-flag set on-device — but v2's every-login capture fixes
that permanently.

## Repo discipline

- All three deploy stamps → `2026-09-26a` (bump together, `test_deploy_stamp_sync.js` gates).
- Wiki: `docs/wiki/11-data-model.md` (geoSamples field, geo shape +days/+samples,
  dedup/cap/mode rules, clearGeo), API page (new endpoint), `15-gotchas-and-history.md`
  (trip-contamination incident + why unique-day mode).
- Work on `preview`; merge/push to `main` only on explicit instruction.
- Never `git add -A`; leave `_geo_clear.js` and `speech_events_dump_full.json` untracked.

## Testing

- Extend `test_geo_events.js` (pure `applyGeoSamples`):
  - burst same-day same-cell → 1 sample, 1 day-vote;
  - 8 spread days vs 20-login 2 days → spread wins;
  - tie → recency wins; invalid fixes acked, not stored;
  - legacy seed (geo without geoSamples) counts as a sample;
  - cap 30 trims oldest; cell+day dedup keeps different cells same day.
- Update `test_geo_capture.js`: ok-flag no longer gates (capture called twice
  → geolocation invoked twice); rounding-before-enqueue still asserted.
- Update `test_geo_export.js`: new CSV columns + `sharesCellWith` grouping;
  map label day-count rendering.
- `clearGeo.js`: auth matrix (no token/403, student/403, teacher/200) via the
  existing api test style; patch removes both paths.
- Root `npm test` + `cd api && npm test` green before each commit.

## Out of scope (YAGNI)

- Reverse geocoding / addresses.
- Auto-deleting stale samples beyond the cap.
- Per-student location history UI / timelines.
- Requiring minimum `days` before showing a dot (teacher judges confidence
  from the badge instead).
