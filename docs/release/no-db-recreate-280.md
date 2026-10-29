# #280 — No-DB-recreate deployment guard (DEV first)

The live Compose files under `/opt/mamago/dev` and `/opt/mamago/prod` are host-managed and **not** the root checkout's `docker-compose.yml`. The exact historical reason for the 13 September database recreation cannot be proven without examining the host's Compose config labels and diffs; changing `APP_VERSION` alone is not proof of cause.

## Contract

- Do **not** run bare `docker compose run --rm migrate` or `docker compose up -d app worker` on either live stack; the default dependency handling may reconcile/recreate `db`.
- The guarded script invokes `docker compose run --rm --no-deps migrate` and `docker compose up -d --no-deps app worker`, preventing Compose from starting/recreating dependencies.
- The script requires a healthy, already-running `<project>-db-1`, checks ID and started time before and after, and verifies that the Compose `db` service definition has not changed during the action.
- `app`, `worker` and `migrate` must refer to the same approved immutable GHCR image in the host Compose config. DEV and PROD must each use their own image and volume isolation.
- The migration action **must** be called only after the separate verified-backup gate `scripts/release/migrate-with-backup.sh` succeeds. This guard is not a substitute for backup, schema review, or rollback planning.
- In a failure during the action, inspect the database separately; after-action checking does not run when the underlying Docker command fails.
- Do not use this script to reset, drop, restore, or recreate the DB.

## DEV rehearsal (owner-initiated, only after all PRs are merged)

1. Read-only: capture `docker inspect dev-db-1` ID, Created, StartedAt, health, config hash; inspect actual `/opt/mamago/dev/docker-compose.yml`, `docker compose -p dev config`, and volume list. Confirm `APP_VERSION` is interpolated only for app image services; if DB configuration changes between old/new tags, **stop and fix host config** before proceeding.
2. Set the **target immutable APP_VERSION** in the host Compose environment through the established owner-controlled process **before** any migration runs. Check resolved `app`, `worker` and `migrate` images: all three must be identical. Confirm resolved DB service config has not changed compared to the pre-change baseline; if it did, stop.
3. Run a verified off-host backup through `migrate-with-backup.sh`. Its migration command must execute `cd /opt/mamago/dev && bash /path/to/safe-compose-db-guard.sh dev migrate`. The guard pulls the target migration image, applies its migrations with `--no-deps`, then requires successful Prisma migration status.
4. Only after successful target-image migrations, run `cd /opt/mamago/dev && bash /path/to/safe-compose-db-guard.sh dev cutover`. The guard checks migration status from the selected image **before** starting app/worker. Do not cut over if this check fails.
5. Compare DB container ID/Created/StartedAt before and after; check `/api/health` and Prisma `migrate status` separately, plus matching runtime git SHA and image digest for app+worker. Record evidence in #280.
6. Do not perform the PROD cutover until DEV passes and the host-side configuration differences are understood and fixed.

**Rollback:** Reverting an image alone may be unsafe after database migrations. Use the existing Task 15 rollback decision tree. Never automate a destructive restore.
