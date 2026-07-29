# Place status/classification matrix — 2026-07-28

Read-only join of the already-captured local DB baseline
([`place-db-baseline-2026-07-28.json`](./place-db-baseline-2026-07-28.json)) and WordPress source
preview ([`place-source-preview-2026-07-28.json`](./place-source-preview-2026-07-28.json)) — no new
DB/source queries, no writes. Full per-record matrix:
[`place-status-classification-matrix-2026-07-28.json`](./place-status-classification-matrix-2026-07-28.json)
(deterministic: rows sorted by `sourceRecordKey`, no volatile timestamps, aggregates recomputed
directly from the rows array so they cannot drift from it).

**Sanity check performed first**: every active-lineage DB row has a matching WordPress source
preview candidate, and vice versa (0 / 0 mismatch) — this is what proves `SOURCE_UNPUBLISHED` is
genuinely `0` today (nothing previously imported has since disappeared from the WordPress source),
rather than an assumption.

## Aggregate table (arithmetic verified)

```text
A. WORDPRESS-LINEAGE PLACES — 82 total

A1. PUBLISHED + READY_NOOP                    0
A2. PUBLISHED + UPDATE_CONFLICT_PROTECTED     4
A3. PUBLISHED + CITY_EVIDENCE_MISSING         0
A4. PUBLISHED + other                         0

A5. PENDING + READY_NOOP                     76
A6. PENDING + UPDATE_CONFLICT_PROTECTED       0
A7. PENDING + CITY_EVIDENCE_MISSING           2
A8. PENDING + SOURCE_UNPUBLISHED              0
A9. PENDING + other                           0

A1+A2+...+A9 = 82  ✓

B. SEED NON-MIGRATION PLACES — 1 total

B1. seed status:               PUBLISHED
B2. city:                      Минск (cityId set — this is a pre-existing, non-WordPress record;
                                its city was never migration-derived, so it is not part of the
                                "city evidence" analysis that applies to the 82 lineage rows)
B3. public visibility:         publicly reachable (200 OK, verified in this session's browser smoke)
B4. migration/publication scope: OUT OF SCOPE — no MigrationLineage row, not WordPress-sourced,
                                excluded from every count above

A (82) + B (1) = 83  ✓ matches total Place row count exactly
```

```text
current total PUBLISHED (all 83):                 5
current total PENDING (all 83):                   78
current migration-lineage PUBLISHED (of 82):       4
current migration-lineage PENDING (of 82):         78
current seed PUBLISHED/PENDING (of 1):             1 / 0

READY_FOR_EDITORIAL_PUBLICATION_REVIEW:            76
REQUIRES_MANUAL_LOCAL_CONTENT_REVIEW:              0
CITY_BLOCKED:                                      2
SOURCE_UNPUBLISHED_EXCLUDED:                       0
ALREADY_PUBLISHED_VALID:                           4  (lineage) + 1 (seed) = 5
SEED_OUT_OF_MIGRATION_SCOPE:                       1
BLOCKED_OTHER:                                     0
```

**Correction to the prior session's summary**: "5 published, remaining 78 content-clean pending" was
directionally right but imprecise — it did not separate the 1 non-migration seed Place from the 82
lineage Places, and did not distinguish the 76 genuinely `READY_FOR_EDITORIAL_PUBLICATION_REVIEW`
Places from the 2 that are `CITY_BLOCKED` (which must **not** enter any future bulk-publish candidate
set). This matrix is the corrected, arithmetically-verified version.

## The 4 `UPDATE_CONFLICT` Places — final classification

All 4 are **already `PUBLISHED`**, and were published *before this session* (not something this
session did) — this must not be read as "content-clean," it is specifically
`UPDATE_CONFLICT_PROTECTED`: known manual post-import edits that diverge from the current WordPress
source, correctly left untouched by the existing `classifyPlaceUpdateSafety` gate.

| sourceRecordKey | title | DB status | conflict reason | classification | publication readiness |
| --- | --- | --- | --- | --- | --- |
| `wordpress-db:places:437` | «Пуговка» на Ратомской, 7 | PUBLISHED | `LAST_IMPORTED_AT_UNKNOWN` | `UPDATE_CONFLICT_PROTECTED` | `ALREADY_PUBLISHED_VALID` |
| `wordpress-db:places:895` | «Пуговка» на Восточной, 137 | PUBLISHED | `TARGET_MODIFIED_AFTER_IMPORT` | `UPDATE_CONFLICT_PROTECTED` | `ALREADY_PUBLISHED_VALID` |
| `wordpress-db:places:5389` | «Family Сlub» (Фэмили клуб) | PUBLISHED | `TARGET_MODIFIED_AFTER_IMPORT` | `UPDATE_CONFLICT_PROTECTED` | `ALREADY_PUBLISHED_VALID` |
| `wordpress-db:places:43023` | Атмосфера | PUBLISHED | `TARGET_MODIFIED_AFTER_IMPORT` | `UPDATE_CONFLICT_PROTECTED` | `ALREADY_PUBLISHED_VALID` |

None were re-imported, none were overwritten, none were auto-classified as broken. Their live DB
content was confirmed valid via this session's own browser smoke (full content/media/hours render
correctly, 0 console errors) — that live-content check is what justifies `ALREADY_PUBLISHED_VALID`
rather than a blanket `REQUIRES_MANUAL_LOCAL_CONTENT_REVIEW`; had any of the 4 been un-verified or
still `PENDING`, the correct label would have been `REQUIRES_MANUAL_LOCAL_CONTENT_REVIEW` instead
(the matrix-building logic handles both cases — see the JSON's per-row `blockingReason`).

## The 2 city-evidence-gap Places

| sourceRecordKey | title | status | source city evidence | DB cityId | classification | publication readiness |
| --- | --- | --- | --- | --- | --- | --- |
| `wordpress-db:places:32409` | Be English | PENDING | none (`hasCity: false` in source preview) | null | `CITY_EVIDENCE_MISSING` | `CITY_BLOCKED` |
| `wordpress-db:places:60742` | Школа архитектурного мышления для детей | PENDING | none (`hasCity: false`) | null | `CITY_EVIDENCE_MISSING` | `CITY_BLOCKED` |

Both are `PENDING` — left `PENDING`, excluded from the 76-record bulk-publish candidate universe
above. Neither is `PUBLISHED`, so the "P0 publication inconsistency" branch (a city-blocked record
that is somehow already live) does not apply to either today — the matrix-building logic checks for
it explicitly and would flag it separately if it ever did. No city was assigned by default (no Минск
guess) — both remain genuinely unresolved pending real source evidence or a manual editorial
decision.

## Corrected Places status

```text
PLACES:
DATA AND MIGRATION CLOSURE COMPLETE

82/82 lineage records accounted for
1 non-migration seed accounted for separately
0 unexpected CREATE/DELETE
0 duplicate lineage/source keys/slugs
0 orphan media links

PUBLICATION:
NOT COMPLETE — exact editorial/lifecycle scope remains

Published:                                    5  (4 lineage + 1 seed)
Ready for editorial publication review:      76
Manual-content review required:               0  (all 4 conflict records already verified PUBLISHED)
City blocked:                                 2
Source unpublished/excluded:                  0
```
