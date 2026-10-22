# Host deployment cleanup safety

The DEV and PROD Compose projects share the same physical Docker host.

## Confirmed 2026-10-22 (read-only)

The host file at /opt/mamago/scripts/deploy.sh ends with an asynchronous global image prune operation:

    nohup sh -c 'docker image prune -a -f --filter "until=12h" && docker system df' >/tmp/docker-prune.log 2>&1 &

Observed SHA-256: a681c8cf5a771c171f146ad765d47095897502127215084e9de5003ee830b738.

This is a record, not permission to modify the live host. Never automatically run unscoped Docker image pruning during a routine DEV deployment.

## Proposed controlled installation

1. Manually verify there is no concurrent deploy/rollback and record DEV/PROD images, digests, health, and disk headroom.
2. Recheck host script SHA-256. Resolve any differences from the reviewed version.
3. Transfer the reviewed scripts/deploy/patch-host-prune.py to the authorized operator's host.
4. Run it with --target /opt/mamago/scripts/deploy.sh and --expected-sha256 <verified-sha>, **without** --apply. Only proceed after DRY_RUN_PASS.
5. With separate owner approval, add --apply. The tool changes only the two-line prune block, validates bash syntax, and writes a named backup. It does not invoke Docker or deploy.
6. Run bash -n on the modified deploy script; inspect last lines; verify that running DEV/PROD containers and digests have not changed.
7. If rollback is needed, restore only the reviewed backup under explicit supervision.

The installer is intentionally not executed during this PR. Do not delete images automatically under a different name. Storage cleanup must be a separately authorized and reviewed operation based on exact unused image IDs and rollback retention.

Offline regression test: python3 scripts/deploy/patch-host-prune.test.py.
