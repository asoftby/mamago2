# Rehearse Prisma migrate deploy on restored DEV backup (release gate #714)

The isolated SQL test in PR #720 passed, but did not execute Prisma migration bookkeeping. This script executes `pnpm exec prisma migrate deploy` against a disposable local PostgreSQL 16 instance restored from the operator's **verified** DEV backup. It must not be run on deployed DEV/PROD.

## Execution from the clean canonical checkout

```bash
cd ~/dev/mamago2-dev
sh scripts/git/session-start-gate.sh
git fetch origin test/release-prisma-deploy-scratch-20261024
git show FETCH_HEAD:scripts/release/verify-prisma-migrate-deploy-on-dev-backup.sh > /tmp/mamago-prisma-release-scratch.sh
bash -n /tmp/mamago-prisma-release-scratch.sh
bash /tmp/mamago-prisma-release-scratch.sh \
  "$HOME/mamago-backups/dev-db-1/dev-db-1-20261024-121448.sql.gz"
```

The script demands a clean `dev` checkout with local dependencies, rejects any archive outside the local DEV backup folder, independently verifies SHA256 and gzip, rejects remote Docker contexts/hosts, pins Docker commands to a local Unix socket, uses a new randomly named local Docker container with a PostgreSQL 16 `tmpfs` data directory, and exposes only a random **127.0.0.1** host port. It restores the dump into the scratch container, requires 292 previously completed migrations and neither pending migration recorded, executes the actual Prisma CLI against the random scratch port, verifies 294 completed migrations and three expected tables, runs `prisma migrate status`, then removes only its own scratch container.

**Security limits:** Prisma CLI is given an explicit scratch `DATABASE_URL`; there is no SSH, remote DB connection, Docker cleanup/prune or server mutation. This script uses `postgres:16-alpine` already cached locally and refuses to pull a new image. It cannot verify application runtime compatibility, correct bot credentials, GSC sync, or all migration side effects.

Expected successful terminal marker: `PRISMA_MIGRATE_SCRATCH_OK` and `SCRATCH_REMOVED`. Stop on any failure. Do not copy DB dumps or credentials to GitHub/comments. Archive paths and command errors without secrets are sufficient.

After the result is recorded in [Release Control #714](https://github.com/asoftby/mamago2/issues/714), review the exact target DEV SHA, CI, image, and smoke-test plan before authorizing a **DEV-only** rollout.
