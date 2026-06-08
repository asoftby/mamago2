# Migration Baseline Deploy Runbook

**Date:** 2026-06-07  
**Branch audited:** `fix/pre-release-p0-blockers` (based on `dev`)  
**Author:** release/database audit (read-only — no DB changes performed)

---

## Context

Pre-release audit flagged **CB-3: migration baseline vs existing production DB** as a critical deploy risk.

There are **two different migration states** in this repository:

| Branch | Migrations in git | Latest migration | Risk profile |
|--------|-------------------|------------------|--------------|
| **`dev`** / `fix/pre-release-p0-blockers` | **177 incremental** folders + `migration_lock.toml` | `20260605120000_sync_schema_drift` | Standard incremental deploy — safe **if** production `_prisma_migrations` matches |
| **`feat/media-unified`** (local, not on remote) | **1 squashed baseline** | `20260606215451_media_unified_architecture` (~4413 lines SQL) | **High risk** on existing DB — must not `migrate deploy` blindly |

Production/staging must be diagnosed **before** choosing a deploy path. This runbook covers both.

**P0 code fixes** (auth DTO, build, sitemap, etc.) are in commit `ced9e07` on `fix/pre-release-p0-blockers`. They do **not** change `schema.prisma` or migrations.

---

## Current Repository Migration State

### Inventory (branch `dev` / `fix/pre-release-p0-blockers`)

```bash
ls -la prisma/migrations
find prisma/migrations -maxdepth 2 -type f -name "migration.sql" | wc -l
# → 177 migration.sql files

cat prisma/migrations/migration_lock.toml
# provider = "postgresql"
```

- **First migration:** `20260224215914_init` — minimal `Healthcheck` table (incremental history, not full baseline).
- **Second init:** `20260227223025_init` — additional early schema (duplicate init naming — historical artifact).
- **Latest migration:** `20260605120000_sync_schema_drift` — idempotent `IF NOT EXISTS` column/enum sync (designed for prod drift repair).
- **No** `media_unified_architecture` migration on this branch.

### Squashed branch (`feat/media-unified`)

```bash
git ls-tree -r --name-only feat/media-unified prisma/migrations/
# → prisma/migrations/20260606215451_media_unified_architecture/migration.sql
```

Single migration recreates **full schema** (CREATE TYPE, CREATE TABLE for all models). Applying this on a DB that already has tables → `relation already exists` errors.

### Seed scripts

| Script | Command | Creates `minsk` city? |
|--------|---------|----------------------|
| System seed | `pnpm db:seed` / `pnpm db:seed:system` | **Yes** (`prisma/seed.ts` upserts `slug: "minsk"`) |
| Demo data | `pnpm db:seed:demo` | Adds demo content (separate) |
| Admin bootstrap | `pnpm bootstrap:admin` | Admin user only |

Migrations do **not** insert cities — seed is required for `/` → `/minsk` redirect.

### Package scripts (migrate/seed/deploy)

```json
"db:migrate:deploy": "prisma migrate deploy"
"db:seed": "prisma db seed"
"db:reset:dev": "prisma migrate reset"          // DEV ONLY — forbidden on prod
"db:reset:safe": "pnpm db:backup && pnpm prisma migrate reset --force"
"db:migrate:safe": "pnpm db:backup && pnpm prisma migrate dev"
"db:backup": "bash scripts/backup-local-db.sh"
"db:backup:sql": "bash scripts/db/backup-sql.sh"
```

### Prisma validation (repo-only, no DB)

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/placeholder"
pnpm prisma validate    # schema syntax OK
pnpm prisma generate  # client generation OK
```

---

## Why This Is Risky

### On `dev` (incremental migrations)

| Risk | Description |
|------|-------------|
| **Migration count mismatch** | Prod may be at 166 migrations (per May 2026 audit); repo now has 177. Pending migrations must be applied in order. |
| **Drift from `db push`** | `20260605120000_sync_schema_drift` exists because prod/dev had manual/`db push` changes. If prod drift differs, deploy may still fail or leave gaps. |
| **Duplicate init migrations** | Two early `*_init` folders — unusual but already in history; do not squash retroactively without DBA plan. |

### On `feat/media-unified` (squashed baseline)

| Risk | Description |
|------|-------------|
| **Full CREATE on existing DB** | Baseline tries to CREATE all tables/types → immediate failure if DB populated. |
| **`_prisma_migrations` mismatch** | Prod has ~166 records; git has 1. Prisma will attempt to apply the squashed migration. |
| **False sense of “up to date”** | If someone runs `migrate resolve --applied` without verifying schema parity, future deploys silently skip real changes. |

### Interpretation

- **`dev` branch:** incremental migration chain — **normal** Prisma deploy model, but requires prod history alignment.
- **`feat/media-unified`:** squashed baseline — **dangerous** for existing DB without explicit baseline-marking procedure.

---

## Diagnostic Commands

> **Rules:** Read-only. No `migrate deploy`, `migrate reset`, `db push`, `migrate resolve`, or destructive SQL.  
> Run against **staging clone** of production, not production directly.

### A. Migration records in DB (psql)

```sql
-- How many migrations does this DB think it has applied?
SELECT COUNT(*) FROM "_prisma_migrations";

-- Full history (check for gaps, rolled_back, failed)
SELECT migration_name, started_at, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
ORDER BY started_at;

-- Latest applied migration
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
ORDER BY finished_at DESC
LIMIT 5;

-- Check for squashed baseline (only relevant if deploying feat/media-unified)
SELECT *
FROM "_prisma_migrations"
WHERE migration_name LIKE '%media_unified_architecture%';
```

**Expected on healthy prod (incremental path):**  
`COUNT(*)` ≈ 160–177, latest name close to `20260605120000_sync_schema_drift` or earlier if prod lags repo.

**Red flag:** `COUNT(*)` = 0 but user tables exist → manual/`db push` DB without migration history.

**Red flag:** baseline `media_unified_architecture` already marked applied but schema differs from `schema.prisma`.

### B. Prisma CLI status (read-only-ish)

```bash
export DATABASE_URL="postgresql://USER:PASS@HOST:PORT/DBNAME"

pnpm prisma migrate status
# Shows: up to date | N pending migrations | failed migration
```

Does **not** apply migrations. Safe to run.

### C. Prisma migrate diff (read-only — generates SQL script, does not execute)

#### 1. DB → schema.prisma (most important for prod)

```bash
pnpm prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/diff-db-to-schema.sql

wc -l /tmp/diff-db-to-schema.sql
head -50 /tmp/diff-db-to-schema.sql
```

#### 2. Migrations folder → schema.prisma (repo internal consistency)

```bash
pnpm prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script > /tmp/diff-migrations-to-schema.sql
```

Requires empty shadow DB (Postgres). Use a disposable database, e.g. `mamago_shadow` on staging host.

#### 3. Migrations folder → live DB (what deploy would still need to apply)

```bash
pnpm prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-url "$DATABASE_URL" \
  --script > /tmp/diff-migrations-to-db.sql
```

### Diff interpretation guide

| Diff result | Meaning | Action |
|-------------|---------|--------|
| **Empty script** (only comments/blank) | Sources match | Safe — no schema drift |
| **ADD COLUMN / CREATE INDEX IF NOT EXISTS** | Additive, non-destructive | Usually safe; review each statement |
| **CREATE TABLE** on DB→schema | DB missing tables | Pending migrations not applied — run incremental deploy (Scenario A/B) |
| **DROP TABLE / DROP COLUMN / ALTER TYPE destructive** | Critical drift | **STOP release** — manual DBA review |
| **Migrations→schema non-empty** | Repo migrations don't match `schema.prisma` | Fix repo before any deploy |
| **Migrations→DB large CREATE TABLE block** | DB far behind repo OR squashed baseline not applicable | Do not deploy squashed baseline; use incremental path or resolve strategy |
| **DB→schema differs but DB matches applied migrations** | Manual prod edits or `db push` drift | Consider `sync_schema_drift`-style repair migration; do not `db push` on prod |

---

## Scenario A: Fresh DB

**Use when:** new environment, empty Postgres, no `_prisma_migrations`, no user tables.

### Branch: `dev` / `fix/pre-release-p0-blockers`

```bash
export DATABASE_URL="postgresql://..."
pnpm prisma migrate deploy          # applies all 177 migrations in order
pnpm db:seed                        # creates minsk + system data
pnpm bootstrap:admin                # optional first admin
pnpm build && pnpm start            # or Docker deploy
```

### Verification checklist

| Step | Command / URL | Expected |
|------|---------------|----------|
| Migration status | `pnpm prisma migrate status` | "Database schema is up to date" |
| Migration count | `SELECT COUNT(*) FROM "_prisma_migrations"` | 177 |
| City exists | `SELECT slug FROM "City" WHERE slug = 'minsk'` | 1 row |
| Homepage | `GET /` | Redirect to `/minsk` |
| City page | `GET /minsk` | 200 (may be sparse without demo seed) |
| Sitemap | `GET /sitemap.xml` | Valid XML with `/{city}` URLs |

### Branch: `feat/media-unified` (squashed)

```bash
pnpm prisma migrate deploy          # applies single baseline — creates full schema
pnpm db:seed
```

Works on fresh DB **if** baseline SQL matches `schema.prisma` (verify with diff #2 first).

---

## Scenario B: Existing Production DB With Old Migration History

**Most common production case.** DB has `_prisma_migrations` with ~166–177 records and live data.

### Branch: `dev` (incremental) — preferred path for current P0 release

#### What happens on `pnpm prisma migrate deploy`

1. Prisma reads `_prisma_migrations`.
2. Compares with `prisma/migrations/` folder.
3. Applies **only pending** migrations in chronological order.
4. Does **not** re-run already-applied migrations.

**Safe when:** pending migrations are additive and prod schema matches expectations for already-applied steps.

#### Failure modes

| Error | Cause |
|-------|-------|
| `relation "X" already exists` | Migration partially applied or manual DDL duplicated migration |
| `column "Y" already exists` | Drift — column added manually; may need adjusted migration or `IF NOT EXISTS` pattern |
| `enum label already exists` | Enum value added out-of-band |
| Migration marked failed in `_prisma_migrations` | Previous deploy interrupted — must resolve failed migration first |

#### When `prisma migrate resolve --applied` is relevant (incremental)

**NOT** for marking entire baseline on incremental branch. Use only for:

- A specific migration that was applied manually and matches migration SQL exactly.
- Recovering from a failed migration after manual fix.

```bash
# Example — ONLY after verifying migration SQL was applied manually:
pnpm prisma migrate resolve --applied "20260605120000_sync_schema_drift"
```

#### Pre-conditions before any deploy on existing DB

1. `pnpm prisma migrate status` — note pending count.
2. DB→schema diff is empty OR only contains changes explained by pending migrations.
3. Full backup taken (see Staging Runbook step 1).
4. Test on staging clone first.

### Branch: `feat/media-unified` (squashed baseline) — DO NOT deploy directly

#### What happens if you run `migrate deploy` on DB with 166 old records

Prisma sees `20260606215451_media_unified_architecture` as **pending** (not in `_prisma_migrations`).  
It will execute ~4413 lines of CREATE statements → **fail** with "already exists" errors.

#### Possible recovery (staging first, never auto-run)

**Only if** DB→schema diff is **empty** (live DB already matches `schema.prisma`):

```bash
# STAGING ONLY — after empty diff confirmed:
pnpm prisma migrate resolve --applied "20260606215451_media_unified_architecture"
pnpm prisma migrate status   # should show up to date
pnpm prisma migrate deploy   # should apply nothing
```

**Pre-conditions for baseline resolve:**

| # | Check |
|---|-------|
| 1 | `migrate diff --from-url DB --to-schema-datamodel schema.prisma` → empty |
| 2 | All application smoke tests pass on staging |
| 3 | `_prisma_migrations` contains old history OR team accepts replacing history (document decision) |
| 4 | Backup verified restorable |
| 5 | Rollback plan documented |

**If diff is NOT empty:** do **not** resolve. Need incremental repair migration or stay on `dev` branch migration path.

---

## Scenario C: Existing DB Without Reliable Migration History

**Signals:**

- `_prisma_migrations` empty or very few rows, but `User`, `Place`, `Activity` tables exist.
- Prod was maintained with `prisma db push`.
- Manual SQL patches not recorded in git.

### Diagnosis

```sql
SELECT COUNT(*) FROM "_prisma_migrations";
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LIMIT 20;
```

```bash
pnpm prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

### Options (choose with DBA — not automated here)

| Option | When | Risk |
|--------|------|------|
| **Baseline resolve** (mark all repo migrations applied) | Diff empty, schema complete | Medium — hides history gaps |
| **Incremental deploy from scratch** | Diff shows missing tables only | Low if additive |
| **Custom repair migration** | Diff shows specific gaps | Medium — needs review |
| **Restore from backup + migrate deploy on fresh clone** | Severe corruption | High downtime |
| **`db push`** | — | **FORBIDDEN on production** |

---

## Staging Clone Runbook

### 1. Backup production DB

```bash
# On prod/staging host — adjust connection vars
pnpm db:backup:sql
# or
bash scripts/db/backup-sql.sh
# Verify backup file exists and size > 0
```

Store backup off-server. Confirm restore procedure on disposable DB before proceeding.

### 2. Create staging clone

Options (pick one):

- `pg_dump` → restore to `mamago_staging` database on separate instance.
- Cloud provider clone/snapshot (RDS, etc.).
- Docker: duplicate volume from `docker-compose` postgres.

```bash
# Example logical clone
pg_dump "$PROD_DATABASE_URL" | psql "$STAGING_DATABASE_URL"
```

### 3. Point app branch at staging clone

```bash
git checkout fix/pre-release-p0-blockers   # or target release branch
export DATABASE_URL="postgresql://...@staging-host/mamago_staging"
export APP_ENV=staging
export SITE_NOINDEX_DEFAULT=true           # keep staging noindexed
```

Deploy app container **without** running migrate yet.

### 4. Read-only diagnostics (save all output to files)

```bash
mkdir -p /tmp/mamago-migrate-audit-$(date +%Y%m%d)
cd /path/to/mamago2

pnpm prisma migrate status | tee /tmp/mamago-migrate-audit-*/migrate-status.txt

pnpm prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script | tee /tmp/mamago-migrate-audit-*/diff-db-to-schema.sql

pnpm prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-url "$DATABASE_URL" \
  --script | tee /tmp/mamago-migrate-audit-*/diff-migrations-to-db.sql
```

Run psql queries from section A; save results.

### 5. Decision gate (do not proceed if STOP conditions)

| Condition | Decision |
|-----------|----------|
| DB→schema diff empty, N pending incremental migrations | Proceed to step 6 (incremental deploy) |
| DB→schema diff empty, on squashed branch | Consider baseline resolve on staging (step 6b) |
| DB→schema diff has DROP/destructive | **STOP** |
| Pending migrations include CREATE TABLE for existing tables | **STOP** — drift repair needed |
| `migrate status` shows failed migration | **STOP** — resolve failed state first |

### 6a. Incremental deploy (dev branch path)

```bash
pnpm prisma migrate deploy
pnpm prisma migrate status
pnpm db:seed    # only if staging should have system data; skip if clone already has data
```

### 6b. Baseline resolve (squashed branch ONLY — staging first)

```bash
# ONLY if diff-db-to-schema.sql is empty:
pnpm prisma migrate resolve --applied "20260606215451_media_unified_architecture"
pnpm prisma migrate deploy
pnpm prisma migrate status
```

### 7. Smoke tests on staging

| Test | Expected |
|------|----------|
| `GET /` | Redirect or setup notice |
| `GET /minsk` | 200 |
| `GET /api/health` | 200 |
| `GET /api/auth/me` (authenticated) | No `passwordHash` in JSON |
| `GET /sitemap.xml` | Valid XML |
| Business login | Works |
| Admin login | Works |
| `pnpm build` in CI | Green |

### 8. Production (only after staging sign-off)

Repeat steps 4–7 on production during maintenance window with fresh backup.

---

## Production Runbook

1. Announce maintenance window.
2. `pnpm db:backup:sql` — verify backup.
3. Run diagnostics (section 4) — **same commands, save logs**.
4. If decision gate passes → `pnpm prisma migrate deploy`.
5. `pnpm prisma migrate status` — must be "up to date".
6. Deploy application artifact (Docker image from green build).
7. **Do not** run `db:seed` on prod if data already exists (seed is idempotent for system entities but review first).
8. Smoke tests (section 7).
9. Monitor Sentry/logs for 30–60 minutes.

**Do not merge `feat/media-unified` migration squash into production path until Scenario B squashed-branch procedure completed on staging.**

---

## Decision Matrix

| Finding | Action |
|---------|--------|
| DB schema matches `schema.prisma`, old incremental migrations exist, pending = incremental only | **`migrate deploy`** on `dev` branch |
| DB schema matches `schema.prisma`, squashed baseline in git, old history in DB | **`migrate resolve --applied <baseline>`** on staging first, then deploy |
| DB schema differs — additive columns/tables only in diff | Create **repair migration** (new task); do not `db push` |
| DB missing tables/columns vs schema | **STOP** — analyze pending migrations; deploy incrementally after backup |
| DB has extra manual columns not in schema | Document or add migration to align; **do not drop** without DBA sign-off |
| `_prisma_migrations` empty but tables exist | Diff first; likely **`db push` history** — baseline resolve or repair plan |
| Baseline already marked applied, status up to date | Normal operation — deploy app only |
| `migrate diff` output contains **DROP** / destructive ALTER | **STOP release** |
| `migrate status` shows **failed** migration | Fix + `migrate resolve` — **do not** deploy until cleared |
| Prod at migration 166, repo at 177 | **Incremental deploy** of 11 pending — verify each in staging |

---

## Commands That Are Forbidden

| Command | Why |
|---------|-----|
| `prisma migrate reset` | Destroys all data |
| `prisma db push` | Bypasses migration history; caused prod drift |
| `prisma migrate dev` | Creates new migrations; dev-only |
| `prisma migrate resolve` **without** empty diff verification | Marks migrations applied when schema differs |
| `DROP TABLE` / `DROP COLUMN` on prod without backup | Data loss |
| `migrate deploy` on squashed baseline against populated DB | CREATE conflicts |
| Deleting rows from `_prisma_migrations` | Breaks Prisma tracking |
| Running diagnostics on production without backup | Operational risk |

---

## Final Recommendation

### For immediate P0 release (`fix/pre-release-p0-blockers` from `dev`)

1. **Do not merge** until staging clone diagnostics complete.
2. Use **incremental** path: `pnpm prisma migrate deploy` (177-migration chain).
3. Expect prod may be ~11 migrations behind latest (`20260605120000_sync_schema_drift` and predecessors).
4. Run DB→schema diff on staging — must be empty or fully explained by pending migrations before prod.
5. P0 app deploy is safe code-wise (build green); **database step gates the release**.

### For future `feat/media-unified` merge

1. **Do not** merge squashed migration into `dev`/prod until separate migration strategy approved.
2. If schema already matches on prod, use baseline `migrate resolve` **on staging only** after empty diff.
3. Consider keeping incremental history and generating **forward repair migrations** instead of squash for prod.

### Next action on staging server

```bash
# 1. Clone DB to staging
# 2. Checkout fix/pre-release-p0-blockers
# 3. Run:
export DATABASE_URL="..."
pnpm prisma migrate status
pnpm prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script | head -100
# 4. Save output and compare against Decision Matrix
# 5. Do NOT run migrate deploy until diff review passes
```

---

## Related documents

- `docs/audits/release-readiness-sanity-audit.md` — May 2026 audit (166 migrations at that time)
- `README.md` — Production deploy checklist (seed, noindex env)
- P0 commit: `ced9e07` — `fix: resolve pre-release p0 blockers`
