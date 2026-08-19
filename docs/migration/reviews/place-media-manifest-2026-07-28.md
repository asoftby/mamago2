# Place media manifest — 2026-07-28

## Policy in force (pre-existing, not changed this session)

`src/lib/migration/runtime/sampledMediaPolicy.ts` — LOCAL/DEV never runs FULL media for the whole
corpus by default. Only a fixed, hand-picked allowlist of 9 source keys total (3 Events / 3 Places
/ 3 Offers, `DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS`) gets `FULL_IMPORT`; every other record gets
`METADATA` (evidence captured, no image downloaded/stored). Only `PRODUCTION` gets unconditional
FULL for everyone. This is a documented, deliberate decision (code comment references
`prelaunch-checklist.md §1 "Sampled media policy"`, which appears to predate the checklist's
current structure — the section name no longer exists verbatim, a small pre-existing doc-drift
item, not something this session introduced or needs to fix).

## Per-record action (82 active Place lineage records)

| Group | Count | Action | Status |
| --- | --- | --- | --- |
| `wordpress-db:places:895`, `:5389`, `:43023` | 3 | `FULL_IMPORT` (in the LOCAL/DEV sample allowlist) | **Already complete** — 11 / 15 / 12 `PlaceImage` rows respectively exist in the local DB right now, imported in a prior session. This *is* the local FULL media proof for Place — it demonstrably works end-to-end (download, dedup, storage, linking) for real source media. |
| `wordpress-db:places:437` | 1 | `METADATA` (not in the sample allowlist) | 1 `PlaceImage` row already exists from an earlier ad-hoc pass; not touched further — this record is `UPDATE_CONFLICT`/blocked anyway. |
| Remaining 78 clean `READY_NOOP` places | 78 | `METADATA` (plannedMediaAction: `METADATA_ONLY`) | **No image download planned under the current policy.** Evidence (`mediaRefCount`, attachment ids, placement) is captured in the source preview but no `MediaAsset`/`PlaceImage` row would be created for any of these 78 in LOCAL/DEV without deliberately expanding the sample allowlist. |

Aggregate warnings from the source preview relevant to media (informational, pre-existing, not
migration defects):

```text
47 places have a WordPress logo reference — logos are never auto-imported (Place.logoImageId
   import is permanently excluded by design, confirmed in PlaceMediaSyncer.ts)
2  places use a legacy "gallery-place"/"logo-place" meta key distinct from the modern gallery
   field — kept as raw evidence only, not merged (PLACE_MEDIA_LEGACY_KEY_USED)
```

## Decision needed, not made unilaterally

Expanding `DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS` (or passing an override) to run real FULL media
import for all 78 remaining clean Places would mean downloading, deduping, and storing real images
for every one of them in this LOCAL environment. That is a genuine, scoped, boundable piece of work
— but it is a **policy expansion**, not "proving existing data correct," and downloading potentially
hundreds of real images from the legacy WordPress host is exactly the kind of action this closure
task's own principles say to flag rather than do silently ("не превращать closure в новое
архитектурное исследование"). **Recommendation**: keep the existing 3-place LOCAL/DEV sample as the
FULL-media proof (it already demonstrates correctness end-to-end), and treat "full corpus media
import for all 78 Places" as a separate, explicitly-scoped follow-up — same posture as the
Place-publication question above. Flagging both together for Aliaksei rather than deciding.

## Dev metadata-only proof

Confirmed by the same preview run: all 82 records (except the 3 sample-allowlisted ones) resolve to
`mediaPolicy: METADATA` / `plannedMediaAction: METADATA_ONLY` under the DEV profile too (DEV never
gets FULL outside the same 9-key sample — `resolveSampledMediaPolicy` applies identically to LOCAL
and DEV). No separate DEV run was needed to prove this; it's the same code path, same fixed
allowlist, verified by reading `sampledMediaPolicy.ts` directly rather than re-running against a
second environment for an identical result.

## Production execution

Not run (production writes are out of scope for this session, per explicit instruction). Production
profile (`resolveMigrationEnvironment` → `PROD`) unconditionally resolves `mediaPolicy: FULL` for
every record — i.e. the *policy* already supports a full-corpus run once Go/No-Go is given; nothing
in the sampled-policy code path needs to change for that. The production manifest (exact keys,
expected actions, dedup fingerprints) should be generated from a fresh preview run at cutover time,
not frozen here, since source content/media availability could drift between now and then.
