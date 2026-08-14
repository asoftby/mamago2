# Project Phoenix: Phase 3 — Production Cutover Runbook

**Status:** planning document only. No code changes, no Prisma migrations, no
database writes, and no deploys happen as part of writing this runbook. It
defines the sequence a human operator follows to execute a real cutover,
using the CLI and guard rails already built through Phase 2D.

## Current implementation (2026-08-14) — use this, not the Phase 2D table below

Historical Phase 2D scope below is preserved as evidence. Current `dev`:

| Entity | Path |
| --- | --- |
| Users | `pnpm migration:user:live` (PROD writes: `--confirm-production --confirm-writes --acknowledge-prod-user-import`). Passwords are not migrated. Golden 564-user CLI stays localhost-only. |
| Places | `pnpm migration:commit:wordpress-db --entity place --profile FULL_IMPORT --media-policy FULL` — cover, gallery, logo |
| Events | `--entity event --media-policy FULL` — current/future published only; Event images ARE imported |
| Articles | `--entity article --media-policy FULL` — all valid published; cover + inline on the normal FULL path |
| Routes | `--entity route --media-policy FULL` — RouteStop media on first FULL run |
| Offers | `--entity offer --media-policy FULL` — valid Place mapping required; otherwise SKIP with reason |
| Reviews | `--entity review` — Voxel `post_reviews` → `PlaceReview` |
| Fresh inventory | `pnpm migration:scope:wordpress-db --allow-remote-readonly` (read-only, no freeze) |

Pre-cutover profile: `--profile FULL_IMPORT` or `--profile PROD_IMPORT`. Keep `prod.mamago.by` noindex. Do not use `--profile PRODUCTION` until mamago.by cutover.

Topology: Owner Mac → live WordPress (SSH/HTTP read-only) → Phoenix process → PROD DB/media. Do not run the importer on the shared PROD host (`134.17.17.134` cannot reach WordPress). Do not use `migration:phoenix-release --apply`.

Related: [`migration-engine.md`](./migration-engine.md) (Phase 2 architecture),
[`wordpress-to-mamago.md`](./wordpress-to-mamago.md) (Phase 1 discovery/GAP
analysis), [`migration-ledger-schema-proposal.md`](./migration-ledger-schema-proposal.md)
(ledger schema), [`../audits/migration-baseline-deploy-runbook.md`](../audits/migration-baseline-deploy-runbook.md)
(generic Prisma deploy runbook — schema/DB state, not content migration).

## Current implementation scope (as of Phase 2D)

Before using this runbook, know what actually exists. The `Migration*`
ledger tables and CLI (`scripts/migration-commit-wordpress-db.ts`) are real
and idempotent, but only three source entity types have a working adapter
path today:

| Entity | Adapter/normalizer | Commit runner |
| --- | --- | --- |
| `places` | `normalizePlace` | `PlaceCommitRunner` |
| `post` (articles) | `normalizeArticle` | `ArticleCommitRunner` |
| `events` | `normalizeEvent` | `EventCommitRunner` (+ `EventMediaSyncer`) |

No adapter/normalizer/runner exists yet for **users, profiles, offers
(services/hb-programs), routes, or reviews**. RankMath redirect ingestion is
also not implemented — only slug-history/article redirects flow through
`manifest.csv`. A cutover run today can only migrate Place/Article/Event
content; it is not a full WordPress retirement. Treat "full cutover" as a
future milestone gated on the open items in
[Not yet implemented](#not-yet-implemented-blocks-full-cutover) below, and
scope any near-term production run explicitly to `--entity place`,
`--entity article`, `--entity event`, or a combination — not `all` under the
assumption that "all" means "everything in WordPress."

## Preflight checklist

Run through this in order. Every item must be explicitly checked off before
touching production — do not skip on the assumption staging already proved it,
since profile/env selection changes behavior (see
[Profile selection](#profile-selection)).

- [ ] `git status -sb` clean on the branch being deployed; confirm it's merged
  into `dev` (or whatever branch production deploys from) and the PR is not
  still open with unresolved review comments.
- [ ] `pnpm exec tsc --noEmit` green.
- [ ] Full migration test sweep green: every `*.test.ts` under
  `src/lib/migration/` and `scripts/migration-*.test.ts`.
- [ ] `pnpm build` (or `pnpm check`) green — this also exercises the
  redirect-manifest loader against whatever `manifest.csv` is checked in.
- [ ] Confirm which WordPress source will be read: live DB over SSH
  (`WP_SSH_HOST`, `WP_SSH_USER`, `WP_DB_NAME`, `WP_DB_USER`,
  `WP_DB_PASSWORD`) vs. a JSON snapshot
  (`scripts/migration-commit-wordpress-db-from-json.ts`). Prefer a frozen
  snapshot for the actual cutover run so the source doesn't change mid-run;
  use `migration:preview:wordpress-db`/`migration:inspect:wordpress-db`
  against the live DB beforehand to produce that snapshot.
- [ ] Run `pnpm migration:preview:wordpress-db --entity all --out preview.json`
  (read-only, no DB writes, no ledger rows) and review the human-readable
  summary for unexpected counts, quarantines, or warnings before any commit
  run.
- [ ] Confirm which `MigrationProfile` this run uses and why (see below) —
  do not default silently.
- [ ] Confirm `--context-config` for the run: owner/default assignment rules,
  city defaults, any per-record overrides needed for known-ambiguous
  records flagged by the preview.
- [ ] Confirm business decisions blocking full fidelity are either resolved
  or explicitly accepted as deferred for this run (event eligibility cutoff,
  taxonomy mapping completeness, article HTML→`contentJson` fidelity spot
  check) — see the "Needs Decision" list in `wordpress-to-mamago.md`.
- [ ] Confirm no one else is running a competing migration commit against the
  same production DB concurrently (this CLI has no run-level lock beyond
  per-record ledger idempotency).

## Backup strategy

Phoenix commit writes go through the normal Prisma/`DATABASE_URL` connection
— there is no separate migration-specific backup path. Use the same backup
discipline as any other production write:

1. **Before the run:** take a full production DB backup/snapshot through
   whatever mechanism the hosting provider uses (managed Postgres
   snapshot, `pg_dump`, etc.) — the repo's `scripts/db/backup.sh` /
   `scripts/db/backup-sql.sh` / `pnpm db:backup:sql` are the local/self-hosted
   path; if production runs on managed infra, use its native
   snapshot/point-in-time-recovery feature instead and record where the
   snapshot lives and how to restore it. **This runbook does not know your
   production hosting setup — fill this in explicitly before the first real
   run, don't assume the local Docker scripts apply.**
2. **Verify the backup is restorable** (to a scratch DB, not production)
   before proceeding — an unverified backup is not a backup.
3. **Do not** run `prisma migrate reset`, `prisma db push`, or any of the
   commands in the "Commands That Are Forbidden" table in
   `../audits/migration-baseline-deploy-runbook.md` at any point in this
   flow. Phoenix commit writes are ordinary Prisma Client `create`/`update`
   calls, not schema migrations, but a bad commit-context config or a wrong
   `--entity` scope is still a real-data mistake a backup is the only
   recovery path for.
4. **Retention:** keep the pre-cutover backup until post-launch monitoring
   (see below) has run its full window without a rollback being triggered.

## Migration order

Within current scope (Place/Article/Event only), the dependency order
`migration-engine.md` already specifies still applies for what exists:

1. **Places** first — events and articles can reference a `placeId`, so
   places landing first means later entities can resolve real place links
   instead of leaving them null for a follow-up pass.
2. **Articles** next (no dependency on events).
3. **Events** last — `EventMediaSyncer` needs `ownerUserId` resolved via the
   commit-context config, and event-to-place linking benefits from places
   already existing.

Run each entity as its own `migration:commit:wordpress-db --entity <type>`
invocation rather than one `--entity all` pass, so a problem in one entity
type doesn't block or conflate with another, and so the human report per
entity is easy to review before moving to the next.

Users, profiles, offers, routes, and reviews are **not** part of this
migration order — they have no runner yet. Do not attempt to work around
this by hand-mapping them through the Place/Article/Event runners.

## Profile selection

The CLI (`scripts/migration-commit-wordpress-db.ts`) resolves a
`MigrationProfile` from `--profile` (or `APP_ENV`/`VERCEL_ENV` if omitted —
see `resolveMigrationProfile()` in
[`../../src/lib/migration/runtime/MigrationProfile.ts`](../../src/lib/migration/runtime/MigrationProfile.ts)),
bundling a media/SEO/redirect policy:

| Profile | Media | SEO | Redirects | Use for |
| --- | --- | --- | --- | --- |
| `FULL_IMPORT` | `FULL` | `DRY_RUN` | `VALIDATE` | Local/dev full-fidelity runs against a scratch or staging DB. |
| `DEV_VALIDATION` | `METADATA` | `VALIDATE` | `VALIDATE` | Staging dry-run-equivalent: writes content rows but only reports media evidence — no downloads — so a staging pass is fast and doesn't fill staging media storage with production assets. |
| `PRODUCTION` | `FULL` | `PRODUCTION` | `APPLY` | The real cutover run. |

For the actual cutover, always pass `--profile PRODUCTION` explicitly (don't
rely on `APP_ENV` auto-detection silently doing the right thing) plus
`--confirm-production`. `ProductionMigrationGuard`
([`../../src/lib/migration/runtime/ProductionMigrationGuard.ts`](../../src/lib/migration/runtime/ProductionMigrationGuard.ts))
then blocks the run before any WordPress SSH connection or `PrismaClient` is
opened unless:

- `--confirm-production` was passed, **and**
- `manifest.csv` validates (exists, meets `REDIRECT_MANIFEST_MIN_ROWS`,
  no bad-path/cycle/duplicate/unknown-destination-section issues), **and**
- the site is not globally noindexed (`SITE_INDEXING_ENABLED=true` and
  neither `SITE_NOINDEX_FORCE` nor `SITE_NOINDEX_DEFAULT` blocking it —
  see [`../../src/lib/seo/globalNoindex.ts`](../../src/lib/seo/globalNoindex.ts)).

Individual policies can be overridden (`--media-policy`, `--seo-policy`,
`--redirect-policy`) if a specific run genuinely needs a different mix (e.g.
a `PRODUCTION`-profile run with `--media-policy METADATA` to commit content
now and backfill media in a follow-up pass) — but overriding away from
`PRODUCTION`'s defaults on the real cutover run should be a deliberate,
documented decision at preflight time, not a default.

## Redirect rollout

1. Regenerate the manifest against production content **after** the
   Place/Article commit passes: `pnpm build-migration-manifest` (reads
   published `Article`/slug-history data via Prisma, writes `manifest.csv`
   at repo root).
2. Validate it explicitly before relying on the build to catch problems:
   the same `loadRedirectManifest()` the build and the production guard use
   — check row count against `REDIRECT_MANIFEST_MIN_ROWS` (default 900) and
   read through reported issues (`bad-path`, `self-redirect`, `cycle`,
   `duplicate-source`, `unknown-destination-section`) rather than only
   trusting the pass/fail count.
3. **RankMath redirects are not included** in this manifest today (see
   Phase 1 "Redirects" gap in `wordpress-to-mamago.md` — RankMath's
   serialized `exact`/`start`/`contains` rules have no normalization/review
   stage yet). `wordpress-to-mamago.md` also references a "WP legacy
   catch-all classifier" that falls back uncovered WP paths to the default
   city hub — that code (`src/lib/routing/wpLegacyCatchAll.ts`) is now on
   `dev`, merged via PR #33. Confirm with the business owner whether that
   fallback behavior is acceptable for launch, or whether RankMath redirect
   normalization is still a launch blocker — this runbook does not resolve
   that decision.
4. Deploy with `REQUIRE_REDIRECT_MANIFEST=1` set in the production build so
   a missing/underfilled/invalid manifest **fails the build** rather than
   silently shipping with broken redirects (mirrors
   `next.config.ts`'s existing fail-loud contract).
5. Spot-check a sample of real legacy URLs (a mix of known-high-traffic
   pages, not just the first few manifest rows) resolve to the intended
   new URL with the correct status.

## SEO validation

`ProductionMigrationGuard`'s SEO check is narrow (redirect manifest validity
+ global-noindex state) — it is **not** a full SEO audit. Before flipping
`SITE_INDEXING_ENABLED=true` for real:

- [ ] Confirm `robots.ts`/`sitemap.ts` output looks correct against a
  production-like build (`GET /robots.txt`, `GET /sitemap.xml`).
- [ ] Spot-check canonical URLs, `seoTitle`/`seoDescription`, and OG fields
  on a sample of migrated Places/Articles/Events — these come from
  normalizer defaults plus whatever the commit-context config supplied, not
  from RankMath field migration (RankMath SEO postmeta → native SEO field
  mapping is listed as "Requires transformation" in `wordpress-to-mamago.md`
  and is not implemented in the current normalizers).
- [ ] Confirm `REDIRECT_MANIFEST_MIN_ROWS` reflects the real expected count
  for this launch, not a stale default copied from an earlier smaller
  content set.
- [ ] Only after the above: flip `SITE_INDEXING_ENABLED=true` (and confirm
  `SITE_NOINDEX_FORCE`/`SITE_NOINDEX_DEFAULT` are not still forcing
  noindex) — this is also the exact condition `ProductionMigrationGuard`
  checks, so a `PRODUCTION`-profile run will refuse to proceed until this
  step is genuinely done, not just planned.

## Deploy sequence

1. Preflight checklist (above) fully checked off.
2. Backup taken and verified restorable.
3. Run `migration:commit:wordpress-db --entity place --profile PRODUCTION
   --confirm-production --context-config <path> --confirm-writes --out
   place-commit-report.json`. Review the report before continuing.
4. Repeat for `--entity article`, then `--entity event`, in that order (see
   [Migration order](#migration-order)), each with its own report reviewed
   before moving on.
5. Regenerate and validate the redirect manifest (see
   [Redirect rollout](#redirect-rollout)).
6. Complete [SEO validation](#seo-validation), then flip
   `SITE_INDEXING_ENABLED=true`.
7. Deploy the application build with `REQUIRE_REDIRECT_MANIFEST=1` and the
   updated `manifest.csv` committed.
8. Run [smoke tests](#smoke-tests).
9. Begin [post-launch monitoring](#post-launch-monitoring).

Each commit step is independently re-runnable: the ledger
(`MigrationLineage`) makes re-running the same entity a plan of
`UPDATE`/`SKIP_UNCHANGED` against already-migrated records, not duplicate
creation, so a failure partway through step 3 or 4 does not require starting
over — re-run the same command after fixing the underlying issue.

## Smoke tests

Beyond the generic checklist in `../audits/migration-baseline-deploy-runbook.md`
(`GET /`, `GET /{city}`, `GET /api/health`, auth, `pnpm build` green), verify
migration-specific outcomes:

- [ ] A known migrated Place page renders with correct name, address, hours,
  cover image, and gallery.
- [ ] A known migrated Article renders with correct content, cover image,
  and author.
- [ ] A known migrated Event renders with correct schedule/sessions and
  (per current scope) **no** cover/gallery image unless `--media-policy FULL`
  was used and the source actually had approved event media evidence —
  confirm this matches the product decision made at preflight, not just "no
  image" being treated as a bug.
- [ ] A sample of redirected legacy URLs (see
  [Redirect rollout](#redirect-rollout) step 5) resolve correctly in the
  deployed environment, not just against the local manifest file.
- [ ] `GET /sitemap.xml` includes the migrated content's canonical URLs.
- [ ] Re-run `pnpm migration:preview:wordpress-db --entity all` (read-only)
  against the same source after the commit run and confirm the plan now
  shows `SKIP_UNCHANGED`/`UPDATE` for migrated records, not fresh `CREATE` —
  this is the fastest idempotency check available.

## Rollback plan

There is no automated rollback command for Phoenix commits — plan for these
paths, cheapest first:

1. **Redirect/indexing rollback (fastest, no data changes):** revert
   `SITE_INDEXING_ENABLED` and/or redeploy the previous manifest/build if
   the problem is redirect- or SEO-shaped rather than data-shaped.
2. **Targeted re-run:** if specific records committed incorrectly (bad
   commit-context default, wrong owner assignment), fix the
   `--context-config`/`--source-record-key` inputs and re-run
   `migration:commit:wordpress-db` for just the affected `sourceRecordKey`s
   — the ledger will plan them as `UPDATE`, not duplicate them.
3. **Entity-scoped data rollback:** if a whole entity type's commit run
   needs to be undone, this requires either (a) restoring from the
   pre-cutover backup to a scratch DB and manually reconciling, or (b) a
   manual cleanup pass using `MigrationLineage` rows for that run (`runId`)
   to identify exactly which target rows this run created/touched — no
   built-in "undo run" command exists, so this is a manual, careful
   operation, not a script to run blind.
4. **Full restore:** worst case, restore the full pre-cutover backup. This
   is why the backup must be taken and verified *before* step 3 of the
   deploy sequence, and why non-migration production writes during the
   cutover window should be minimized or paused if possible — a full
   restore loses anything written after the backup, migration or not.

Decide and document the rollback trigger threshold (e.g. "more than N%
records report `FAILED` in the commit report" or "smoke test suite finds a
data-corrupting bug") before the run starts, not during an incident.

## Post-launch monitoring

- [ ] Watch Sentry/application logs for the standard 30–60 minute window
  (per `../audits/migration-baseline-deploy-runbook.md`'s production
  runbook), plus specifically watch for `EVENT_MEDIA_DOWNLOAD_FAILED`,
  `EVENT_MEDIA_ATTACHMENT_MISSING`, and other `MigrationWarning` codes
  surfacing in application logs if migrated content triggers any
  runtime re-processing.
- [ ] Re-run the idempotency check (smoke tests, last bullet) again after a
  few hours to confirm nothing external is re-triggering unwanted
  re-imports.
- [ ] Track redirect 404s / catch-all fallback hits (via existing
  analytics/logs) for the legacy-URL long tail — this is the practical
  signal for whether the RankMath-redirect gap (see
  [Redirect rollout](#redirect-rollout)) is actually costing traffic and
  needs to be prioritized as a fast-follow.
- [ ] Confirm no duplicate content appears for records that existed both as
  manually-created mamaGo content and WordPress source content before this
  migration (lineage/idempotency should have prevented this, but this is
  worth an explicit spot-check given it was called out as a risk in
  `migration-engine.md`).
- [ ] Keep the pre-cutover backup until this monitoring window closes clean.

## Not yet implemented (blocks full cutover)

Carried forward from the Phase 1/2 "Needs Decision" and "Missing In Prisma"
lists — still open as of Phase 2D, and blocking anything broader than the
Place/Article/Event scope this runbook covers:

- User, Business/Organizer, Offer (services/hb-programs), Route, and
  PlaceReview adapters/normalizers/runners — none exist yet.
- WordPress `profile` post classification (personal vs. business) — no
  target model decision made.
- RankMath redirect ingestion and normalization.
- Non-past event eligibility rule (exact cutoff/timezone/recurring
  handling) — `shouldExcludePastEvent()` exists
  (`src/lib/migration/validators/policies.ts`) but the product-level
  cutoff policy behind it should be reconfirmed against current business
  expectations before a production run, not assumed unchanged since Phase 1.
- Voxel relation mapping (`wp_voxel_relations`) — no relation linker exists.
- WP taxonomy → mamaGo taxonomy curated mapping table.

None of these block a **scoped** Place/Article/Event production cutover
using this runbook. They block calling that cutover "the WordPress
migration is done."
