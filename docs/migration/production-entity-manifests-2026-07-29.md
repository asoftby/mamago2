# Production entity manifests & expected deltas — 2026-07-29 (updated 2026-07-30)

Status: **Places and Offers manifests are now FROZEN** (see "2026-07-30
update" below) — no longer deferred. The rest of this document is
unchanged from 2026-07-29: it consolidates counts already confirmed in
[`prelaunch-checklist.md`](prelaunch-checklist.md) and
[`rc-product-regression-2026-07-29.md`](rc-product-regression-2026-07-29.md)
into one manifest index. No production read/write access was used to
produce this document — all counts are from the local/dev migration state
already reviewed and approved in the checklist, plus one bounded read-only
WordPress-source preview (Places only) run on 2026-07-30.

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
| Places | 83 total rows; 82/82 lineage; 80/80 publishable PUBLISHED, 2 CITY_BLOCKED (PENDING), 1 non-migration seed | **Frozen 2026-07-30** — `docs/migration/manifests/places-preview-2026-07-30.json`, hash `ca217c18ab59882ff3326e460ad6f825ad62f1b052b5d06d29dfc37ab17a7c6c` | `pnpm migration:preview:wordpress-db --entity place --allow-remote-readonly` (live WP-source, read-only, zero writes) | CREATE/UPDATE 78 SKIP_UNCHANGED + 4 expected `UPDATE_CONFLICT` (manually-protected 437/895/5389/43023, never overridden); 2 CITY_BLOCKED remain PENDING by design |
| Offers | 63/63 published (safe canonical scope); 99 source published, 91 canonical, 28 Class H (no Place relation) + 8 Class I (alias) held back | **Frozen 2026-07-30 (from committed local state, not a live WP re-preview — see blocker note below)** — `docs/migration/manifests/offers-local-manifest-2026-07-30.json`, hash `e1dda8fd86dfe8df98e6ab4fe1e495f19a53579581aaae9401c8840aaf62dadf` | Local DB export (Offer + active OFFER `MigrationLineage`, 63/63 cross-referenced, 0 orphans) | CREATE 63 in safe scope; 28 Class H **permanently excluded by owner decision 2026-08-14** (see "2026-08-14 update" below); 8 Class I still pending founder decision (see backlog) |
| Events (Activity) | 10 lineage records, 109 ActivitySession rows; 8/8 future-valid PUBLISHED + 1 protected legacy PUBLISHED; 1 EXPIRED_SOURCE_PENDING excluded | Reviewed, not called out as deferred | checklist §5.3 | CREATE 9 published Activities; 1 excluded (64159) pending founder decision |
| Routes | 14/14 lineage; 13/13 reviewed PUBLISHED; 1 CITY_BLOCKED (Mogilev, `marshrut-mogilev`) kept DRAFT | Reviewed | checklist §5.4 | CREATE 13 published Routes; 1 stays DRAFT by design |
| RouteStops | 90 rows (86 reviewed + Mogilev's 4); 12 mojibake fixes applied | Reviewed | checklist §5.4 | CREATE 90 |
| Articles | 2/2 target articles (`wordpress-db:post:56250`, `wordpress-db:post:57731`) | Frozen — manifest hash `833e67d396300bd42d67a7218a0340770b7ff9544b68535d90e453c036710b8b` | checklist §3.6 | CREATE 2 |
| Redirects (system/migration) | 893 rows: 12 EXACT, 21 HUB, 24 P1_START_OR_CONTAINS, 836 INVALID_TARGET, 0 collisions/chains/loops | Frozen — `scripts/data/wp-redirect-map.json`, validated by `scripts/validate-redirect-map.ts` | checklist §5.7, `redirect-admin-visibility-proof.md` | No DB writes — redirect manifest is a build-time/runtime artifact, not a table to migrate |
| Media (local uploads) | 482 files, 38,494,112 bytes, per-file SHA-256 manifest verified in this session's backup/restore rehearsal | Frozen for **local dev only** — production media manifest not yet generated | see backup/restore rehearsal below | Production storage manifest is a cutover-time TODO (checklist §5.9) |
| Activation recipients | 578 eligible, 0 exclusions (same manifest as Users above) | Frozen manifest; **canary subset size is explicitly a range ("3–5 accounts"), not fixed** — see `activation-canary-plan-2026-07-29.md` | `users-production-activation-delivery-plan.md` §4 | 0 real sends until founder-approved canary |
| Sitemap URLs | 199 unique/resolving, 0 issues, 0 duplicates | Reviewed | rc-regression doc | No DB delta — derived output |
| Place media | 39 `PlaceImage` rows, all attached to `PUBLISHED` Places; 159 `MediaAsset` rows total (site-wide) | **Frozen 2026-07-30** — counted from local DB, included in the Places manifest cross-check | Local DB query | CREATE ≈39 `PlaceImage` rows alongside their 82 Places |
| Offer media | 0/63 published Offers have `coverImage` set; 0 `galleryImages` entries | **Frozen 2026-07-30** — confirmed zero, matches known `OFFER_MEDIA_DEFERRED_P1` backlog item | Local DB query | No media delta expected for Offers in this scope — already founder-approved as deferred |

## 2026-07-30 update: Places and Offers manifests frozen

**Places** — a single bounded, read-only preview was run against the live
legacy WordPress source (`pnpm migration:preview:wordpress-db --entity
place --allow-remote-readonly`, no `--limit`, so it covered the full
scope). This makes **zero writes** (confirmed by the script's own
docstring: "Nothing is written to any database, no MigrationRun/
MigrationRecord rows are created"). Result: 82 discovered, 82 normalized,
0 failed — 78 `SKIP_UNCHANGED`, 4 `UPDATE_CONFLICT`. The 4 conflicts are
exactly the manually-protected Places already known (437, 895, 5389) plus
one newly-confirmed instance (**43023**, "Атмосфера" — modified
2026-07-23, 6 days after its last import on 2026-07-17; same
`TARGET_MODIFIED_AFTER_IMPORT` pattern). All 4 are expected,
non-blocking, and must never be force-overridden — see the updated
`migration-manual-protected-places` memory note. Manifest saved to
`docs/migration/manifests/places-preview-2026-07-30.json` (hash above).

**Offers** — the per-record tool that exists for this
(`migration:preview:offer-snapshot`) is **not a bulk/live WP-source
fetcher**: it requires a pre-existing offline snapshot file
(`offers-inventory.json`) that has no generator script in this repo and
does not exist in this worktree (or anywhere else searched). **Exact
blocker: `offers-inventory.json` snapshot input is missing and
unreproducible without either the original ad-hoc export or a new script
to build one from the live WP source.** Rather than leave Offers deferred
again, this manifest instead freezes the **already-migrated, already
human-reviewed local state**: all 63 `PUBLISHED` Offers cross-referenced
1:1 against their active `OFFER` `MigrationLineage` rows (0 orphans, 0
unlinked). This is a legitimate production manifest — these 63 rows
already passed through classification, review, and publication in prior
sessions — but it is **not** a fresh live-source diff the way the Places
manifest is, so it cannot report `SKIP_UNCHANGED`/`UPDATE_CONFLICT`
against the current WordPress source. If a true source-side diff is
required before cutover, someone with access to the original
`offers-inventory.json` (or a new bulk-fetch script) must produce it —
this is a founder/dev-team decision, not something invented here. Manifest
saved to `docs/migration/manifests/offers-local-manifest-2026-07-30.json`
(hash above).

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

## 2026-08-14 update: owner decision — 28 Class H legacy Offers excluded permanently

The "28 Class H (no Place relation)" Offers mentioned in the frozen
2026-07-30 Offers row above were, in the meantime, imported by a later
Phoenix rerun as unassigned (no-Place) DRAFT Offers — a capability added by
the "Allow DRAFT Offer without Place" change. The owner manually reviewed
all 28 in PROD and judged them obsolete/garbage; they were deleted from
PROD directly.

**Decision: these 28 legacy WordPress Offer post IDs are permanently
excluded from Phoenix migration and must never be recreated by any future
rerun.** Exact legacy post ID match only (never title/slug/fuzzy):

```
42237, 42299, 43089, 43097, 43300, 43302, 43305, 43318, 43323, 43325,
43597, 43604, 43607, 43609, 43671, 43673, 43759, 43807, 43809, 43811,
43813, 43815, 43817, 44457, 44458, 44459, 44460, 6147
```

Mechanism: `OWNER_EXCLUDED_LEGACY_OFFER_IDS` +
`isOwnerExcludedLegacyOfferSourceRecordKey()` in
`src/lib/migration/validators/policies.ts`, consulted unconditionally (not
behind an opt-in filter flag) at the top of the discover→normalize loop in
`src/lib/migration/core/orchestrator.ts` (`runDiscoverNormalizeLoop`) —
before `normalizeRecord()`, before any lineage lookup is consulted, and
before an `executionCandidate` is ever created. Each excluded record plans
as `action: "SKIP_POLICY"` / `status: "SKIPPED"` with
`summary.reasonCode: "OWNER_EXCLUDED_LEGACY_OFFER"` — the same
non-error vocabulary already used for the past-events exclusion policy, so
it is never counted as a `FAILED`/error record in plan stats
(`skippedCount`, not `failedCount`) and never reaches
`buildOfferCreateDraft`/`OfferCommitWriter` for CREATE or media import.
This is a permanent policy check, not a one-time manifest filter — a rerun
against a live WP source will always re-exclude the same 28 IDs, even if a
stale `MigrationLineage` row still references one of them.

The **8 Class I (alias)** Offers mentioned in the same frozen manifest row
are a separate, unrelated group and remain pending a founder decision — not
covered by this exclusion.

Existing migration scope is otherwise unchanged: the already-migrated,
Place-linked Offers (the frozen local manifest's 63 `PUBLISHED` rows, or a
smaller currently-valid count depending on when this is read) continue to
import/rerun exactly as before — this exclusion only ever intercepts the 28
listed legacy post IDs.

See `docs/engineering/backlog.md` BACKLOG-113 (closed as moot for this
batch) for the media-sync gap this decision makes irrelevant for these 28.
