# Production migration runbook — 2026-07-29 (FINAL GO/NO-GO PREPARATION)

Status: **planning document, commands documented but NOT executed against
production.** This supplements — does not replace —
[`production-cutover-runbook.md`](production-cutover-runbook.md), whose
backup/rollback/preflight mechanics are still valid. That runbook's
"current implementation scope" table is stale (it predates the Users/
Places/Offers/Events/Routes work now substantially complete per
[`prelaunch-checklist.md`](prelaunch-checklist.md)) — use this doc for the
up-to-date entity scope and execution order, and the older doc for the
generic commit-CLI mechanics (`migration:commit:wordpress-db`,
`migration:preview:wordpress-db`, ledger/CAS semantics).

Technical RC source SHA: `17c9dd29787bbab0462ca581c546ca83a5dc2e73`

## 0. Production target worksheet (2026-07-30)

None of these values are named anywhere in the docs corpus, the codebase,
or any env file available in this local/dev environment. They are not
guessed here, and no connection or write of any kind was attempted against
any production target. Every row below is a required founder/ops input
before the migration runbook's preflight (§1) can move from ❌ to ✅.

| Input | Value |
|---|---|
| Application hosting target | `FOUNDER_INPUT_REQUIRED` |
| Production PostgreSQL target | `FOUNDER_INPUT_REQUIRED` |
| Production storage target | `FOUNDER_INPUT_REQUIRED` |
| Deploy mechanism | `FOUNDER_INPUT_REQUIRED` |
| DNS provider | `FOUNDER_INPUT_REQUIRED` |
| Production domain | `FOUNDER_INPUT_REQUIRED` |
| Production env/secrets owner | `FOUNDER_INPUT_REQUIRED` |
| Launch window | `FOUNDER_INPUT_REQUIRED` |
| Responsible operator | `FOUNDER_INPUT_REQUIRED` |

## 1. Preflight checklist

| Item | Status | Note |
|---|---|---|
| Exact approved RC SHA frozen | ✅ `17c9dd29787bbab0462ca581c546ca83a5dc2e73` | Confirmed docs-only diff to current HEAD in this session's baseline gate |
| Clean branch/tag | ✅ `codex/product-regression-rc-20260729`, working tree clean | |
| Docker/CI success for exact SHA | ⚠️ Not re-verified this session | Per prior handoff log entries; do not re-run without a new code change |
| Production environment confirmed | ❌ **Gap** — no hosting provider named anywhere in the docs corpus | `production-cutover-runbook.md` states explicitly: "This runbook does not know your production hosting setup — fill this in explicitly before the first real run." Founder must supply. |
| DB target confirmed | ❌ Same gap | Founder must supply production `DATABASE_URL` target and confirm it is not the local dev DB |
| Storage target confirmed | ❌ Same gap | Founder must supply production `MEDIA_STORAGE_ROOT` (or object-storage target if migrated off local disk) |
| Backup completed | ⏳ PENDING GO WINDOW | Local rehearsal PASS this session (see below); production execution requires the production target above |
| Restore command available | ✅ Rehearsed locally this session | `pg_dump -Fc` / `pg_restore`; production equivalent depends on hosting (managed snapshot vs. self-hosted — runbook flags this explicitly) |
| Manifests/checksums frozen | ⚠️ Partial | Users (578) and Articles (2) manifests are frozen with hashes; Places and Offers are explicitly deferred to cutover time (see `production-entity-manifests-2026-07-29.md`) |
| Kill switches documented | ✅ | `MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED=false` disables activation sends with no deploy; `SITE_INDEXING_ENABLED=false` / `SITE_NOINDEX_FORCE=true` forces noindex |
| Maintenance/content freeze | ⏳ Not yet declared | Founder must declare a freeze window before the first real write |
| Source snapshot freeze | ⏳ Not yet declared | WordPress source must be frozen read-only for the duration (checklist §1 rule 3: "WordPress — строго read-only source") |

## 2. Execution order

The checklist never states a single formal cross-entity order as a "rule"
the way it does for Place→Article→Event (see
`production-cutover-runbook.md` lines 104–124). The order below is
synthesized from (a) that explicit Place→Article→Event dependency rule and
(b) the de facto sequence realized in the checklist's own status table and
handoff history. It is not a new invention — it is the order this project
has actually executed in local/dev, made explicit for production:

1. **Users** (identity + manual/privileged classification) — no dependency
   on anything else; everything downstream references `ownerUserId` /
   `createdByUserId`.
2. **Businesses** — depends on Users (owner).
3. **Places** — depends on Businesses (ownerBusinessId) for
   business-owned places; independent otherwise. Per the explicit rule:
   "places landing first means later entities can resolve real place
   links instead of leaving them null."
4. **Offers** — depends on Places (`placeId` is required, not nullable).
5. **Routes / RouteStops** — depends on Places (RouteStop can reference a
   Place).
6. **Events (Activity)** — depends on Places (optional) and Users
   (`ownerUserId` via commit-context config) — explicitly last in the
   documented rule: "`EventMediaSyncer` needs `ownerUserId` resolved... and
   event-to-place linking benefits from places already existing."
7. **Articles** — no dependency on Events; safe to run in parallel with
   step 6, but keep sequential per checklist §1 rule 6 (first full write
   per entity is sequential, stop-on-first-error).
8. **Redirects** — build-time/runtime manifest, not a DB write; validate
   after all content entities exist so canonical destinations resolve.
9. **Media reconciliation** — storage manifest + `MediaAsset` rows,
   after the entities that reference them exist.
10. **Activation email canary** — only after all of the above are verified
    and a backup has been taken (see
    `activation-canary-plan-2026-07-29.md`).

For each phase: run `migration:preview:wordpress-db --entity <entity> --out preview.json`
(read-only) first, review the plan, then `migration:commit:wordpress-db`
for that entity only, `stop-on-first-error`, no automatic retry (checklist
§1 rules 6, 9). After each phase: cumulative DB/storage audit + one
idempotency rerun (expect `SKIP_UNCHANGED` on already-committed rows).

## 3. Partial failure policy (unchanged from `production-cutover-runbook.md`)

- No automatic cleanup.
- No blind rollback.
- Record the exact last successful `sourceRecordKey` / run `runId`.
- Preserve `MigrationLineage` and commit-report audit evidence for that run.
- Resume only through a documented, targeted re-run scoped to the
  remaining un-committed `sourceRecordKey`s — never a blind full re-run.
- Database restore only after a **separate, explicit founder decision** —
  restoring loses anything written after the backup, migration or not.
- **Rollback trigger threshold is explicitly undecided** in the existing
  runbook ("Decide and document the rollback trigger threshold... before
  the run starts, not during an incident.") This remains open — see the
  founder decision matrix.

## 4. Final verification (per phase and at the end)

- Counts match the manifest's expected CREATE/UPDATE/SKIP for that entity.
- `MigrationLineage` rows exist 1:1 with committed target rows for that
  run's `sourceRecordKey`s.
- No duplicate rows (`sourceRecordKey` uniqueness holds).
- Public URLs for a sample of newly-committed entities return 200 with the
  expected canonical/redirect behavior.
- Media referenced by committed entities resolves (no broken image at
  scale beyond the already-known external-Unsplash-fallback P1).
- Auth: activation manifest hash re-verified against the frozen hash
  before step 10; any mismatch stops the canary before a single email goes
  out.
- Admin: `ADMIN` count still exactly 1 (founder's `user:1`), no role
  inheritance from legacy WordPress roles occurred.
- SEO: redirect manifest still validates (0 collisions/chains/loops),
  sitemap count moves as expected, `SITE_INDEXING_ENABLED` still false
  until the dedicated DNS/noindex step.
- Forbidden tables/fields: no writes outside the entities listed in
  section 2; `ProductionMigrationGuard` refuses to run unless
  `--confirm-production`, the redirect manifest validates, and the site is
  not globally noindexed.

## 5. Idempotency rerun rule

Identical to checklist §1 rule 9 — one rerun of the same commit command
against already-committed data must report only `SKIP_UNCHANGED` for every
row from the prior successful run. A rerun that reports `UPDATE_CONFLICT`
for rows known to be manually edited post-import (see memory: Places
437/5389/895 are expected exceptions in the *local* dataset — re-check
whether equivalent manually-edited production rows exist before the real
run) is expected and should be reported as `EXPECTED_MANUAL_UPDATE_CONFLICTS`,
never force-overridden.
