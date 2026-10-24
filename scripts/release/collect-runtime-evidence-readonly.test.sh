#!/usr/bin/env bash
# Deterministic local fixture for the read-only collector. No network or Docker needed.
set -euo pipefail
root=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/bin/ssh" <<'MOCK_SSH'
#!/usr/bin/env bash
# Execute the exact remote script locally through stdin for the fixture.
exec bash -s
MOCK_SSH
cat > "$tmp/bin/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -eu
case "$1 $2" in
  "system df") echo 'Mock Docker disk usage' ;;
  "container inspect")
    if [[ "${3:-}" == *db-1 ]]; then
      case "$*" in
        *--format*) echo "container=/$3 status=running image_ref=postgres:16 image_id=sha256:pg" ;;
        *) exit 0 ;;
      esac
    elif [[ "${3:-}" == *app-1 || "${3:-}" == *worker-1 ]]; then
      case "$*" in
        *--format*) echo "container=/$3 status=running image_ref=ghcr.io/asoftby/mamago2:dev-test image_id=sha256:runtime" ;;
        *) exit 0 ;;
      esac
    else exit 7; fi ;;
  "image inspect")
    case "$*" in
      *repo_digests*) echo 'image_revision=testsha repo_digests=["ghcr.io/asoftby/mamago2@sha256:0123"]' ;;
      *) echo 'testsha' ;;
    esac ;;
  "exec -i")
    sql=$(cat)
    if printf '%s' "$sql" | grep -Eiq '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b'; then
      echo 'unsafe sql' >&2
      exit 50
    fi
    echo 'migration_totals|300|300|0'
    echo 'release_migration|20261021120000_party_anchor_confirmation|APPLIED|2026-10-23T10:00:00Z'
    echo 'release_migration|20261022020000_business_telegram_bot|NOT_RECORDED|-'
    echo 'release_migration|20261022120000_gsc_query_cache|NOT_RECORDED|-'
    ;;
  *) printf 'Unexpected mock docker command: %s\n' "$*" >&2; exit 3 ;;
esac
MOCK_DOCKER
chmod +x "$tmp/bin/ssh" "$tmp/bin/docker"
bash -n "$root/collect-runtime-evidence-readonly.sh"
PATH="$tmp/bin:$PATH" bash "$root/collect-runtime-evidence-readonly.sh" > "$tmp/output"
grep -q 'EVIDENCE_END incomplete=0' "$tmp/output"
grep -q 'app_worker_revision_match=YES' "$tmp/output"
[ "$(grep -c '^migration_totals' "$tmp/output")" = 2 ]
[ "$(grep -c '^release_migration' "$tmp/output")" = 6 ]
echo 'PASS: readonly collector, SSH fixture, both envs and migration rows'
