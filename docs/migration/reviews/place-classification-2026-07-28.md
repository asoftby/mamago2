# Place production-readiness audit — 2026-07-28

Worktree `mamago2-places-offers-closure`, branch `feat/places-offers-production-media-closure`,
base `feat/routes-review-publication` @ `657c6c59`.

## Method

- Local DB aggregate audit: ad-hoc read-only Prisma queries (not committed —
  ephemeral, per the same "one bounded one-off script" pattern used for the
  Routes canonical-sync/Mogilev work).
- Source snapshot + classification: reused existing
  `pnpm migration:preview:wordpress-db --entity place --allow-remote-readonly`
  tool (no new tooling written) — one bounded, exact-scope, read-only SSH
  discovery against the live WordPress DB. Full JSON report:
  [`place-source-preview-2026-07-28.json`](./place-source-preview-2026-07-28.json).
  Local DB per-row detail: [`place-db-baseline-2026-07-28.json`](./place-db-baseline-2026-07-28.json).

## Aggregate result

```text
Total Place rows (local DB):                 83
Active PLACE MigrationLineage records:       82
Place rows without any active lineage:       1  (pre-existing seed/demo Place, not WP-sourced)
Duplicate sourceRecordKeys:                  0
Duplicate Place linkage:                     0
Lineage rows with missing/null targetId:     0
Lineage rows whose Place row is missing:     0
Duplicate city-scoped slugs:                 0

Source discovery (WordPress, exact scope):   82 discovered, 82 normalized, 0 failed, 0 skipped
Action counts:                               78 SKIP_UNCHANGED, 4 UPDATE_CONFLICT, 0 CREATE
```

**Place CREATE expected: 0 — confirmed** (matches the checklist's "CORE COMPLETE" framing for the
import/CREATE dimension specifically; see caveat below on publication status).

## Classification (per prompt's Place taxonomy)

| Classification | Count | Places | Notes |
| --- | --- | --- | --- |
| `READY_NOOP` | 78 | all `SKIP_UNCHANGED` candidates | Byte-identical to WordPress source right now. Includes 2 places with no `cityId` — confirmed the *source itself* has no city evidence either (`hasCity: false` in the preview report), so this is not drift, just a pre-existing content gap. |
| `EXPECTED_MANUAL_UPDATE_CONFLICT` (protected `READY_NOOP`, never overwrite) | 4 | `wordpress-db:places:437`, `:895`, `:5389`, `:43023` | All 4 are `PUBLISHED` locally with manual post-import edits; the existing `classifyPlaceUpdateSafety` gate already blocks any re-import (`LAST_IMPORTED_AT_UNKNOWN` / `TARGET_MODIFIED_AFTER_IMPORT`). Matches prior session's documented expectation — not a new finding. |
| Out of migration scope | 1 | "Невидимый мир" (`cmrb63e4v000hwsj4bsaua079`) | No lineage at all — pre-existing demo/seed Place, created by the same admin account, unrelated to the WordPress migration. Excluded from all further Place migration audit steps. |
| `CITY_DRIFT` | 0 | — | No place has a *resolvable* city change pending — the 2 no-city places have no source evidence to apply. |
| `OWNERSHIP_BLOCKED` | 0 | — | See ownership note below — absence of `ownerBusinessId` is structurally normal, not a blocked-ownership case. |
| `MEDIA_DRIFT` | pending | — | See media manifest (next). |
| `SOURCE_UNPUBLISHED` | 0 | — | All 82 source records are still `publish`-status on WordPress (else the preview would not have discovered/normalized them as candidates at all). |
| `BLOCKED_AMBIGUOUS` | 0 | — | — |

## Ownership note (not a defect)

All 83 Place rows (including the out-of-scope seed one) share the exact same `createdByUserId`
(the project's single ADMIN-role account) — this field is a fixed migration-system identity,
not per-place ownership evidence. `ownerBusinessId` is null on 6 places; this is the normal,
expected state for an unclaimed directory listing (a Place only gets an `ownerBusinessId` once a
real Business claims it via the app's own claim flow) — not a migration gap, not something to
backfill here.

## Publication-status caveat (the most important finding of this audit)

Only **5 of 83** Place rows are `PUBLISHED`: the 4 manually-edited ones above, plus the
non-migration seed Place. **The other 78 — the entire clean, source-verified, zero-drift batch —
are still `PENDING`.** The checklist's "Places: CORE COMPLETE" refers to import/CREATE completeness
only, not publication readiness. Unlike Routes and Events, **no editorial-review-and-bulk-publish
tool exists yet for Place** (no `migration-place-review.ts` / `migration-apply-place-review.ts`
analog). Content/city/ownership integrity for all 78 is confirmed clean (`READY_NOOP`), but
whether/how to move them from `PENDING` to `PUBLISHED` is a distinct, larger product decision —
building a new bulk Place review-and-publish pipeline is out of scope for this closure task (would
be new architectural work, not proving-existing-data-correct work) and is flagged here for a
founder decision rather than attempted unilaterally.

## Regression fix applied this session

`PlaceCommitWriter.buildUpdateData()` unconditionally wrote `status: "PENDING"` and clobbered
`cityId` on every UPDATE — same bug class as the previously-fixed `EventCommitWriter`. Currently
dormant (no Place is in an `UPDATE_SAFE` state right now), but a live risk for the next WordPress
edit to any of the 78 clean Places. Fixed in
[`PlaceCommitWriter.ts`](../../../src/lib/migration/commit/place/PlaceCommitWriter.ts): `status` is
never sent on UPDATE; `cityId` is only sent when the draft proves a non-null value. 3 new regression
tests added to `PlaceCommitWriter.test.ts`; full existing Place migration test suite still green.
