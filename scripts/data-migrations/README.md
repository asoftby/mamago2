# Data Migrations

One-time scripts for backfilling or recomputing data in the database.

## When to use

- After a schema migration that adds a new field requiring backfill
- When recomputing denormalized data (e.g., slugs, geo enrichment)
- When marking existing records with new flags (e.g., `isSystem`)

## Rules

- Schema changes → `prisma migrate dev` / `prisma migrate deploy`
- Data backfill → scripts in this directory
- Scripts must be **idempotent** (safe to run multiple times)
- Scripts must be **non-destructive** (no hard deletes of user/content data)
- Name format: `YYYYMMDD-description.ts`

## Environment policy

| Env     | Schema migration | Data backfill | Reset |
|---------|-----------------|---------------|-------|
| DEV     | ✅ anytime       | ✅ anytime     | ✅    |
| STAGING | ✅ planned       | ✅ planned     | ⚠️ rarely |
| PROD    | ✅ migrate deploy only | ✅ via backfill scripts | ❌ never |

## Running a script

```bash
tsx scripts/data-migrations/YYYYMMDD-description.ts
```
