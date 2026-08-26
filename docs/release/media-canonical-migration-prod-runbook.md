# Media Canonical Migration — Production Runbook

**Status:** code hardening complete in repo; **no PROD mutation in this
document's authoring session.** Operational dry-runs / apply remain a
separate authorized session.

**Scope:** promote `dev` commit `256d398c` ("preserve legacy urls during
canonical migration" — `MediaUrlAlias` + production-safe canonical engine)
to indexed production `https://mamago.by`, then safely run MediaUsage repair
and canonical rename against real PROD data.

---

## Indexed production warning

`mamago.by` is **real, indexed production** — not a noindex preview.

Confirmed live:

| Fact | Value |
|---|---|
| Domain | `https://mamago.by` |
| `APP_ENV` | `production` |
| `SITE_INDEXING_ENABLED` | `true` |
| `SITE_NOINDEX_DEFAULT` | `false` |
| `SITE_NOINDEX_FORCE` | `false` |

Legacy-URL redirect correctness after canonical apply is a **hard SEO gate**.
A mass OLD→404 for previously public assets is a PROD blocker, not an
acceptable transient.

---

## Confirmed PROD baseline (read-only audit)

Re-verify immediately before any real action — host state is not static.

| | |
|---|---|
| Current PROD gitSha | `bb70e999` |
| Current build | `prod-334` / `dev-364` |
| Analytics commit | already on PROD (`bb70e999`) |
| Promotion gap to `dev` HEAD | exactly one commit: `256d398c` |
| Pending Prisma migration | exactly one: `20260825180000_add_media_url_alias` |
| Unexpected pending migrations | none |
| Historical BrandingConfig failed/rolled-back migration | investigated; not a blocker |
| `MediaAsset` | 3568 |
| `MediaUsage` | 7 (practically empty; PROD repair never run) |
| Media library size | ~1.2 GB (~22,051 files under uploads at audit time) |
| Free disk | ~57 GB — capacity is not a blocker |
| Storage volume | Docker named volume `prod_mamago2_storage` → `/app/storage` |
| DB | `prodmamago` in `prod-db-1` |

Exact MediaUsage repair counts and canonical rename/skip counts are **not
yet known** — they require an authorized PROD `DATABASE_URL` session running
the official JS dry-run CLIs. Do not invent those numbers.

---

## Code hardening landed in this repo

| Item | Path | Status |
|---|---|---|
| Shared production guard | `assertCanonicalEnvironment()` in `scripts/data-migrations/backfill-media-canonical-names.ts` | reused |
| MediaUsage repair guard | `scripts/data-migrations/repair-media-usage.ts` | **done** — same guard model as canonical/alias CLIs |
| Guard tests | `scripts/data-migrations/repair-media-usage.test.ts` | **done** |
| Media storage backup | `scripts/deploy/backup-remote-media.sh` | **done** |
| DB backup (pre-existing) | `scripts/deploy/backup-remote-db.sh` | ready |

Production safety model (all three media data-migration CLIs):

- default = dry-run / read-only;
- mutation only via `--apply`;
- production mutation requires explicit `--allow-production`;
- checks `DATABASE_URL` + `current_database()` fingerprint;
- production = DB name `prodmamago` **or** `APP_ENV` production/prod;
- `--allow-production` against a non-production target is refused;
- PROD `--apply` without `--allow-production` hard-fails;
- dry-run on PROD remains allowed and read-only.

---

## Mandatory deployment ordering

Future PROD rollout **must** follow this order. Do not skip or reorder.

1. **Verify current PROD SHA** — `GET https://mamago.by/api/health` → confirm
   live `gitSha` (expected baseline before this promotion: `bb70e999…`).
2. **DB backup** — `scripts/deploy/backup-remote-db.sh mamago-prod prod-db-1`
3. **Verify DB backup** — non-empty file + `.sha256` sidecar (script prints both)
4. **Media storage backup** —
   ```bash
   scripts/deploy/backup-remote-media.sh mamago-prod prod-app-1 \
     --volume prod_mamago2_storage \
     --dry-run
   # then, after dry-run looks correct:
   scripts/deploy/backup-remote-media.sh mamago-prod prod-app-1 \
     --volume prod_mamago2_storage
   ```
5. **Verify media backup** — script enforces `gzip -t`, `tar -tzf`,
   source↔archive file-count equality, SHA-256 sidecar, source/archive bytes
6. **Prisma migration diagnostics** — via `prod-migrate`-style one-shot on the
   Docker network: `prisma migrate status` (expect exactly
   `20260825180000_add_media_url_alias` pending)
7. **`prisma migrate deploy`** — applies additive `MediaUrlAlias` only
8. **Verify migration status clean** — `prisma migrate status` → up to date;
   no unexpected pending
9. **Deploy app image containing `256d398c`** — re-tag already-built
   `dev-365` → `prod-N` (no rebuild), roll `prod-app-1` / `prod-worker-1`
10. **`/api/health`** — `status:"ok"`, `db:"ok"`, `gitSha` starts with `256d398c`
11. **Alias-aware route smoke** — known public OLD media URL behavior before
    any data rewrite (pre-rename: mostly 200/404 as today; post-rename later
    must be 308→200)
12. **MediaUsage repair dry-run** —
    `tsx scripts/data-migrations/repair-media-usage.ts`
13. **Separate approval** — owner decision; not implied by a clean dry-run
14. **MediaUsage repair apply** —
    `tsx scripts/data-migrations/repair-media-usage.ts --apply --allow-production`
15. **Post-repair audit** — re-run dry-run; expect create/stale/duplicates ≈ 0
16. **Canonical dry-run** —
    ```bash
    tsx scripts/data-migrations/backfill-media-canonical-names.ts \
      --report /path/to/prod-canonical-dry-run.json
    ```
17. **Separate approval** — owner decision after reviewing rename/skip/
    collision/missing-source counts
18. **Canonical apply** —
    `tsx scripts/data-migrations/backfill-media-canonical-names.ts \
      --apply --allow-production --report /path/to/prod-canonical-apply.json`
19. **Full OLD→308→NEW acceptance audit** — public OLD→308→200, private OLD→404,
    no redirect chains/5xx, filesystem + reverse-ref consistency

### Hard rule: schema before alias-aware app

The new app image **must not** run before `MediaUrlAlias` exists.

`GET /api/media/file/[...path]` calls
`findMediaUrlAliasByStorageRelativePath()` with **no** `P2021` fallback.
If the table is missing, missing-file alias lookups can 500 instead of
falling through cleanly. Steps 7–8 before step 9 are mandatory.

Promotion unit (no cherry-pick):

```bash
docker buildx imagetools create \
  --tag ghcr.io/asoftby/mamago2:prod-<N> \
  ghcr.io/asoftby/mamago2:dev-365
```

---

## MediaUsage repair

```bash
# read-only (allowed on PROD)
tsx scripts/data-migrations/repair-media-usage.ts

# mutation (PROD requires both flags)
tsx scripts/data-migrations/repair-media-usage.ts --apply --allow-production
```

Apply refuses when `duplicates` or `unresolved` are non-zero.
Record exact dry-run counts before any apply approval:

- `createCount` / `staleCount` / `duplicateCount` / `unresolvedCount`

---

## Canonical dry-run / apply

```bash
tsx scripts/data-migrations/backfill-media-canonical-names.ts \
  --report /path/to/report.json

tsx scripts/data-migrations/backfill-media-canonical-names.ts \
  --apply --allow-production --report /path/to/apply-report.json
```

Review before apply approval:

- rename vs skip breakdown
- collisions / missing source
- duplicate proposed targets
- temporary disk need (engine renames one asset at a time; peak is one
  master + variants, not the whole 1.2 GB library)

---

## Backup tooling

### DB

```bash
scripts/deploy/backup-remote-db.sh mamago-prod prod-db-1
```

Streams `pg_dump` over SSH → local `.sql.gz` + `.sha256`. Remote disk is
not used for the dump payload.

### Media storage

```bash
scripts/deploy/backup-remote-media.sh mamago-prod prod-app-1 \
  --volume prod_mamago2_storage \
  --dry-run

scripts/deploy/backup-remote-media.sh mamago-prod prod-app-1 \
  --volume prod_mamago2_storage
```

Behavior:

- explicit SSH host + app container (+ optional `--volume`);
- source mounted read-only (`:ro`);
- discovers / validates active storage path (default `/app/storage`);
- checks local free disk before archive;
- `tar` + `gzip` with relative paths;
- timestamped artifact + SHA-256 sidecar;
- post-backup: `gzip -t`, `tar -tzf`, source vs archive file-count compare;
- prints source bytes / archive bytes;
- exits non-zero on any validation failure;
- no hardcoded PROD credentials.

A DB backup alone is **not** sufficient before canonical apply — the
migration rewrites DB rows and physical filenames together.

---

## Rollback

### Before canonical apply (after migrate + app deploy only)

- Previous app image (`prod-334` / `bb70e999`) can be redeployed.
- Additive `MediaUrlAlias` table **may remain**.
- Old app code does not query that table; leaving it is inert and preferred
  over a schema rollback.

### After canonical apply

Full rollback requires **both**:

1. verified pre-apply **DB** backup
2. verified pre-apply **media storage** backup

Restoring only one side re-opens broken references.

#### Safe restore order (nothing executed here — documentation only)

Goal: never return traffic while DB filenames disagree with storage, and
never leave a served window where DB points at missing files.

1. **Stop** `prod-app-1` and `prod-worker-1` (mandatory gate).
2. **Restore media storage first** from the verified pre-apply archive into
   `prod_mamago2_storage` (app stays offline).
3. **Restore DB second** from the matching pre-apply dump into `prod-db-1`
   (same pre-apply point-in-time as the storage archive).
4. **Verify** a sample of `MediaAsset.publicUrl` / storageKey paths exist on
   the restored volume before any traffic.
5. **Start** app/worker only after step 4 is green.
6. Optionally redeploy the pre-canonical app image if the alias-aware build
   should also be rolled back (usually optional if only data is reverted).

Why storage before DB: once the DB is restored to pre-apply filenames, those
files must already be present on disk. Completing storage restore first
makes the DB restore land onto an already-populated filesystem. Keeping the
app offline for steps 2–4 is what prevents any user-visible
DB→missing-file window during the brief intermediate.

Do **not**:

- restore DB only while storage still has only post-apply names;
- restore storage only while DB still has post-apply names and then take
  traffic;
- bring the app online between the two restores.

For a small blast radius, prefer targeted recovery from the canonical
`--report` old→new mapping over a full dual restore.

---

## Post-apply acceptance (indexed PROD)

| Check | Required |
|---|---|
| Public OLD → `308` → canonical NEW `200` | hard gate |
| Redirect depth = 1 (no chains) | hard gate |
| Canonical NEW → `200` | hard gate |
| Private OLD → `404` (never redirect to private) | hard gate |
| No mass public OLD→404 | hard gate |
| Filesystem matches DB publicUrl/storageKey | required |
| Reverse-ref / MediaUsage consistency | required |

---

## Next operational session (read-only only)

After this repo hardening commit is on `dev`, an authorized session should
run **only** PROD read-only dry-runs and return exact counts:

- MediaUsage repair: create / stale / conflicts(duplicates) / unresolved
- Canonical: rename / skip counts
- Collisions / missing source
- Exact temporary disk requirement from the dry-run report

Still forbidden in that session until separate approvals:

- PROD DB/media backup execution is allowed as pre-flight, but
  `migrate deploy`, app deploy, repair `--apply`, canonical `--apply`,
  alias repair, orphan cleanup, shared/branding rename are not implied.

---

## Appendix — audit notes preserved from read-only session

- Promotion image for `256d398c` was observed as GHCR `dev-365` at audit time;
  confirm the exact tag again before re-tag to `prod-*`.
- `MEDIA_STORAGE_ROOT` may be blank in the running container; effective path
  is still `/app/storage` via cwd fallback.
- Canonical apply engine processes one asset at a time (copy → verify → DB
  txn → delete old). Peak transient disk is one asset family, not 2× library.
- Host SSH can be intermittent; budget retries into the operational window.
