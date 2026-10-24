# Read-only PROD/DEV runtime and Prisma evidence

**Release tracker:** [#714](https://github.com/asoftby/mamago2/issues/714). **Audit comparison:** [#716](https://github.com/asoftby/mamago2/pull/716).

This diagnostic collects release evidence from the *already-authorized* SSH host alias `mamago-prod`. The same physical host contains two separate Compose projects: `prod` and `dev`. The script never touches configuration files, uses no credentials or secret output, does not restart/stop containers, and does not apply Prisma migrations.

## What the script reads

- Host UTC timestamp and hostname, root filesystem free space, `docker system df`.
- The `prod-app-1`, `prod-worker-1`, `prod-db-1`, `dev-app-1`, `dev-worker-1`, and `dev-db-1` container status, running image refs/IDs, OCI revision and image RepoDigests.
- Whether `app` and `worker` of each environment run the *same source revision*.
- Only `_prisma_migrations` metadata: counts, incomplete migrations, and exact recorded states for three recent release migrations. Uses PostgreSQL `SELECT` only. Does not read business or user records.

## Run from the owner's MacBook

Review this script in the PR before running it. To use the current unmerged task branch **without changing the canonical dev checkout**:

```bash
cd ~/dev/mamago2-dev
git fetch origin chore/release-readonly-runtime-evidence-20261023
git show FETCH_HEAD:scripts/release/collect-runtime-evidence-readonly.sh > /tmp/mamago-release-readonly-audit.sh
bash -n /tmp/mamago-release-readonly-audit.sh
bash /tmp/mamago-release-readonly-audit.sh mamago-prod
```

The command intentionally does not use `sudo`, `docker pull`, `docker system prune`, `docker compose up`, `prisma migrate` or read any `.env`. A normal SSH authentication prompt may appear; do not paste credentials.

## Interpretation

- `migration_totals|TOTAL|APPLIED|INCOMPLETE`: if INCOMPLETE is nonzero, release gate fails pending diagnosis.
- `release_migration|NAME|APPLIED / NOT_RECORDED / ROLLED_BACK / INCOMPLETE|timestamp`: confirm whether DB schema migrations match each running image.
- `app_worker_revision_match=NO`: release gate fails until investigated; do not restart either service as part of this audit.
- `repo_digests`: registry reference may be unavailable for a locally built image; do not manufacture one.
- `EVIDENCE_END incomplete=1`: missing container, permission/SQL error, mismatch, or missing Docker image label; capture error text and investigate, not treat as success.

**Observed app gitSha values from 23 October 2026:** PROD `e3681f5390ce22b5b8538045686077a3a72f0a59`, running DEV `3ecbde45f3d23dc847da30d5668ad52a58c9c701`. These are a snapshot only. Verify live OCI revisions against fresh `/api/health` when collecting evidence.

After running, paste output **without SSH credentials or environment contents** into the release discussion. The resulting metadata does not authorize migration or deployment by itself. Actual backup/restore evidence and a DEV smoke run remain separate release gates.

Local fixture test, without network or Docker:

```bash
bash scripts/release/collect-runtime-evidence-readonly.test.sh
```
