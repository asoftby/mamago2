# Pre-release isolated SQL migration rehearsal (Telegram / GSC)

This test is a **local, SQL-only dry rehearsal** against the already verified 2026-10-24 DEV backup. It never connects to the shared remote host, deployed DEV/PROD containers, or database networks.

## Preconditions

- Docker Desktop on the owner's MacBook, already running, with **local** `postgres:16-alpine` image present (the script refuses automatic pull).
- Verified archive with `.sha256` in `~/mamago-backups/dev-db-1/`; latest known `dev-db-1-20261024-121448.sql.gz`.
- Check the script before execution; local working directory must be a complete copy of the task branch (including both `prisma/migrations/*/migration.sql` files).
- The terminal output must be limited to status messages, aggregate Prisma metadata and database DDL notices; do not upload raw dump or application data.

## Safe one-off checkout (without touching canonical dev checkout)

From the canonical repository, fetch and create a separate *detached* temporary worktree with the task source. Run only after confirming no pre-existing directory at the proposed path.

```bash
cd ~/dev/mamago2-dev
git fetch origin test/release-migrations-isolated-20261024
git worktree add --detach /tmp/mamago-release-migration-audit-20261024 FETCH_HEAD
bash -n /tmp/mamago-release-migration-audit-20261024/scripts/release/verify-pending-migrations-on-dev-backup.sh
bash /tmp/mamago-release-migration-audit-20261024/scripts/release/verify-pending-migrations-on-dev-backup.sh \
  "$HOME/mamago-backups/dev-db-1/dev-db-1-20261024-121448.sql.gz"
```

After checking the result, retire **only the temporary task worktree**:

```bash
cd ~/dev/mamago2-dev
git worktree remove /tmp/mamago-release-migration-audit-20261024
```

No `git reset`, `git clean`, `git stash pop` or modification of the canonical checkout.

## Safety and meaning

- The archive is checksum-validated and gunzipped into a fresh PostgreSQL 16 container with `--network none`, no host port, no host volumes and `tmpfs` data directory.
- Applies only two migration.sql files **to scratch**: Business Telegram tables, then GSC query cache. This does **not** execute `prisma migrate deploy`, add records to `_prisma_migrations`, or prove the application's compiled Prisma Client is compatible.
- Test requires all three new tables and GSC cache index to exist after applying the SQL; any SQL error fails the test.
- Temporary container is removed on script exit. If interrupted hard, verify local orphan containers by exact `mamago-migration-scratch-` prefix manually before deleting anything.
- Outputs `SQL_MIGRATIONS_SCRATCH_OK` only upon a successful isolated SQL rehearsal. This alone does **not** authorize DEV or PROD deploy.
- App+worker version parity, expected image digest, real `prisma migrate status` on DEV, service credentials and E2E smoke are separate blockers.

See [Release Control #714](https://github.com/asoftby/mamago2/issues/714) and the pinned [PROD-to-DEV audit](prod-dev-delta-2026-10-23.md).
