# #280 — Telegram host deploy.sh: verified no-DB-recreation patch

## Evidence (2026-10-31)

The Telegram bot on the shared mamaGo server calls
`bash /opt/mamago/scripts/deploy.sh <dev|prod> <tag>`.
This host-managed script is **not** checked into the application repository.
On the original `dev-1073` deployment it issued `docker compose up -d db`,
followed by dependency-enabled Compose migration and app/worker operations.
Telegram logs showed `dev-db-1 Recreated`, even though the effective DB Compose
configuration was identical across the two application tags. The pre-existing
DEV named volume `dev_db_dev_data` remained in place and table counts matched.

The owner applied a guarded patch to the host on 2026-10-31 and then repeated
the `dev-1073` deployment via Telegram. Only app, worker and prisma-studio
were recreated. Before and after, `dev-db-1` was healthy with the **same**
ID `9b8efdb25300aca7d79e37d90e12cc653dea9828316524fee1ba9cd21237bd36`
and StartedAt `2026-10-30T23:48:41.332297329Z`.
App/worker SHA parity, migrations, seed, and health checks passed. PROD was
not deployed or changed during this rehearsal.

## Version-controlled host patch

`scripts/deploy/patch-host-db-guard.py` records the **exact tested host
transformation**, and `scripts/deploy/patch-host-db-guard.test.py` exercises
it in CI. Unlike the host-managed full `deploy.sh`, the patcher contains no
Telegram credentials or environment secrets.

The patcher inserts a fail-closed guard for the existing healthy DB, a
comparison of current/target DB Compose definitions, DB container identity
and StartedAt assertions, and guarded Compose `--no-deps` migration, seed,
and app/worker/prisma-studio cutover commands. It replaces the dangerous
`docker compose up -d db` call.

**Current host script is already patched. Do not apply the patch again.**
To verify the live host file after copying or checking out this tool on the
host, capture the current SHA-256 and use `--verify`:

```bash
sha256sum /opt/mamago/scripts/deploy.sh
python3 scripts/deploy/patch-host-db-guard.py \
  --target /opt/mamago/scripts/deploy.sh \
  --expected-sha256 <64-character-sha256-from-previous-command> \
  --verify
```

The verification is read-only, performs `bash -n`, and refuses any unsafe,
missing, duplicated, or bare dependency-enabled Compose run/up paths.
For an *older, known unpatched* script, the operator must explicitly pin its
SHA and run the patcher without any action flag (dry run) before separately
approving `--apply`. The apply path takes a local backup, validates a
staged script, and atomically replaces the existing file. It executes no
Docker command. Unknown/partially patched script variants fail closed.

This tracked patch is **not** a full, exact copy of the live host script.
It also does not automatically install itself or prevent a different host
administrator from overwriting the script. Host script inventory,
provisioning/install controls, and post-install verification remain operational
requirements. Never assume application image deployment updates this file.

## Backup and release gate

The host `deploy.sh` backs up `.env`, but a verified PostgreSQL backup
before migration is **not** part of the current Telegram deployment script.
On 2026-10-31, the owner manually created off-host PostgreSQL custom dumps
on their Mac (PROD approximately 25 MB and DEV approximately 11 MB). Both
passed `pg_restore --file=/dev/null` archive reading and SHA-256 verification.
No isolated restore rehearsal or encrypted automated off-host deployment
backup gate has been established.

**Do not treat the Telegram deployment process as fully hardened** until
fresh verified, off-host PostgreSQL backup is automatic and required before
migrations, with restore-test evidence. Do not auto-restore databases or run
bare `docker compose up/down` as a rollback. See
`docs/release/no-db-recreate-280.md`,
`scripts/release/compose-db-preflight.sh`, and
`scripts/release/migrate-with-backup.sh`.
