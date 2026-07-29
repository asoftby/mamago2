# Production entity manifests & expected deltas — 2026-07-29

Status: **planning document for FINAL GO/NO-GO PREPARATION**. This does not
freeze new numbers — it consolidates counts already confirmed in
[`prelaunch-checklist.md`](prelaunch-checklist.md) and
[`rc-product-regression-2026-07-29.md`](rc-product-regression-2026-07-29.md)
into one manifest index, and flags exactly which manifests are still
deferred to cutover time. No production read/write access was used to
produce this document — all counts are from the local/dev migration state
already reviewed and approved in the checklist.

Technical RC source SHA: `17c9dd29787bbab0462ca581c546ca83a5dc2e73`
Documentation HEAD at time of writing: see `git rev-parse HEAD` in this worktree.

## How to read this table

- **Frozen** = a manifest file + hash already exists and was reviewed; re-run
  the same generator against production and diff the hash before trusting it.
- **Deferred** = the checklist explicitly defers generating a byte-exact
  manifest until cutover time (no bulk preview tool exists yet, or the data
  is still expected to shift). These need a manifest generated fresh at
  T-0, not invented now.

| Entity | Local/dev count | Manifest state | Source / generator | Expected production CREATE/UPDATE/SKIP |
|---|---|---|---|---|
| Users (migration scope) | 578/578 (539 USER, 39 BUSINESS_OWNER, 0 ADMIN) | **Frozen** — `docs/migration/users-production-activation-manifest.json`, hash `56c0a18295d8aacf155bfb98182cd26cf1f8064c868e9d578e743627623a49a1` | `pnpm migration:users:activation-manifest` (read-only, zero writes) | CREATE 578 activation-eligible; founder `user:1` (ADMIN) excluded from lineage, unchanged |
| Users — manual/privileged | 14/14 (13 USER, 1 BUSINESS_OWNER) | Frozen — `docs/migration/users-manual-privileged-14-manifest.json` | manual review, checklist §3.4a | Included in the 578 total above |
| Business-linked Users | 38/38 ownership + 38/38 BUSINESS_OWNER elevation | Reviewed, part of the 578 total | checklist §3.4 | No separate delta — subset of Users |
| Businesses/ownership | Derived from the 38 business-linked users above | Reviewed | checklist §3.4 | CREATE ≈38 Business rows tied 1:1 to owner |
| Places | 83 total rows; 82/82 lineage; 80/80 publishable PUBLISHED, 2 CITY_BLOCKED (PENDING), 1 non-migration seed | **Deferred** — "manifest generation deliberately deferred to actual cutover time" (checklist §5.5) | `migration:preview:wordpress-db --entity places` (read-only) | CREATE ~82 lineage-backed Places; 2 remain PENDING by design |
| Offers | 63/63 published (safe canonical scope); 99 source published, 91 canonical, 28 Class H (no Place relation) + 8 Class I (alias) held back | **Deferred** — "byte-exact manifest hash deferred to actual cutover time... no bulk preview tool exists to freeze one today" (checklist §5.5) | same preview tool, `--entity offers` | CREATE 63 in safe scope; 36 (28+8) excluded pending founder decision (see backlog) |
| Events (Activity) | 10 lineage records, 109 ActivitySession rows; 8/8 future-valid PUBLISHED + 1 protected legacy PUBLISHED; 1 EXPIRED_SOURCE_PENDING excluded | Reviewed, not called out as deferred | checklist §5.3 | CREATE 9 published Activities; 1 excluded (64159) pending founder decision |
| Routes | 14/14 lineage; 13/13 reviewed PUBLISHED; 1 CITY_BLOCKED (Mogilev, `marshrut-mogilev`) kept DRAFT | Reviewed | checklist §5.4 | CREATE 13 published Routes; 1 stays DRAFT by design |
| RouteStops | 90 rows (86 reviewed + Mogilev's 4); 12 mojibake fixes applied | Reviewed | checklist §5.4 | CREATE 90 |
| Articles | 2/2 target articles (`wordpress-db:post:56250`, `wordpress-db:post:57731`) | Frozen — manifest hash `833e67d396300bd42d67a7218a0340770b7ff9544b68535d90e453c036710b8b` | checklist §3.6 | CREATE 2 |
| Redirects (system/migration) | 893 rows: 12 EXACT, 21 HUB, 24 P1_START_OR_CONTAINS, 836 INVALID_TARGET, 0 collisions/chains/loops | Frozen — `scripts/data/wp-redirect-map.json`, validated by `scripts/validate-redirect-map.ts` | checklist §5.7, `redirect-admin-visibility-proof.md` | No DB writes — redirect manifest is a build-time/runtime artifact, not a table to migrate |
| Media (local uploads) | 482 files, 38,494,112 bytes, per-file SHA-256 manifest verified in this session's backup/restore rehearsal | Frozen for **local dev only** — production media manifest not yet generated | see backup/restore rehearsal below | Production storage manifest is a cutover-time TODO (checklist §5.9) |
| Activation recipients | 578 eligible, 0 exclusions (same manifest as Users above) | Frozen manifest; **canary subset size is explicitly a range ("3–5 accounts"), not fixed** — see `activation-canary-plan-2026-07-29.md` | `users-production-activation-delivery-plan.md` §4 | 0 real sends until founder-approved canary |
| Sitemap URLs | 199 unique/resolving, 0 issues, 0 duplicates | Reviewed | rc-regression doc | No DB delta — derived output |

## Forbidden / invariant fields (as already documented, not newly invented)

- `PRODUCTION_ADMIN_COUNT_EXPECTED = 1` (founder's `user:1`, pre-existing,
  excluded from migration lineage). No literal constant with this name
  exists in code — this is the narrative invariant stated in
  `rc-product-regression-2026-07-29.md` ("User and privilege invariant")
  and checklist §3.4a: **no legacy WordPress role is ever consulted for
  classification; every migrated user is `USER` unless a fresh, exact,
  proven Place ownership resolves `BUSINESS_OWNER`.**
- `LEGACY_ROLE_INHERITANCE = forbidden` — checklist §3.4a, quoted: "No
  legacy WordPress role ever consulted for classification or exclusion."
- `REAL_EMAIL_SENDS_DURING_MIGRATION = forbidden until activation canary` —
  gated by four ANDed env flags (`NODE_ENV=production`,
  `APP_ENV=production`, `MIGRATED_USER_ACTIVATION_EMAIL_ENABLED=true`,
  `MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED=true`); 0 real sends
  to date.
- Writes must use exact lineage/`sourceRecordKey`, CAS/conditional updates,
  fail-closed guards (checklist §1 rule 8).
- `prisma migrate dev`, `prisma migrate reset`, `prisma db push` are
  forbidden at every stage (checklist §1 rule 2; CLAUDE.md).

## Rerun / idempotency expectation

Per checklist §1 rule 9: after any batch, a cumulative DB/storage audit and
one idempotency rerun are mandatory. The commit ledger keys off
`sourceRecordKey`, so a rerun against already-committed rows is expected to
report `SKIP_UNCHANGED`, not duplicate — e.g. the Users clean batch's
documented rerun showed "564 SKIP_UNCHANGED" (checklist §3.3).

## Stop conditions

- Any batch reporting a real `FAILED` row (not an expected `SKIPPED`) halts
  the run — no automatic retry, cleanup, or rollback of the already-written
  prefix (checklist §1 rule 6).
- A rollback-trigger threshold (e.g. "> N% FAILED") is **explicitly
  undecided** in `production-cutover-runbook.md` and remains a founder
  decision — see `production-migration-runbook-2026-07-29.md`.

## What this session added

- **DB backup/restore rehearsal** (local, disposable): `pg_dump` →
  disposable database `mamago2_restore_rehearsal` → verified identical
  counts across User/Business/Place/Offer/Activity/Article/Route/RouteStop/
  MigrationRecord/MigrationLineage/MediaAsset/Session (13/13 tables match),
  identical constraint count (507) and index count (736), identical role
  distribution and published-content counts, and `prisma migrate status`
  reports "up to date" against the restored copy. Disposable database
  dropped after verification. See `LOCAL_DB_RESTORE_REHEARSAL: PASS` in the
  final report.
- **Storage/media manifest + restore rehearsal**: 482 files under
  `storage/uploads` (38,494,112 bytes), per-file SHA-256 manifest generated,
  copied into a disposable directory, re-hashed, and diffed — 0
  discrepancies. Disposable copy deleted after verification. See
  `LOCAL_STORAGE_RESTORE_REHEARSAL: PASS` in the final report.

Neither rehearsal touched the working `mamago2` database or its storage
directory; both used disposable copies that were deleted after verification.
