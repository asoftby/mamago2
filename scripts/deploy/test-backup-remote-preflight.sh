#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"
cat > "$TMP/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
case "$*" in
  *"docker info"*)
    case "${MOCK_MODE}" in ssh_fail) exit 255;; docker_fail) exit 1;; esac
    ;;
  *"docker container inspect"*)
    case "${MOCK_MODE}" in missing) exit 1;; stopped) printf 'false\n';; *) printf 'true\n';; esac
    ;;
  *"docker exec"*)
    printf '%s\n' '-- PostgreSQL dump' 'CREATE TABLE sample (id int);'
    ;;
esac
MOCK
chmod +x "$TMP/bin/ssh"

for scenario in ssh_fail docker_fail missing stopped running; do
  dest="$TMP/$scenario"
  mkdir -p "$dest"
  export MOCK_MODE="$scenario"
  if PATH="$TMP/bin:$PATH" bash "$ROOT/scripts/deploy/backup-remote-db.sh" fake-host db-test "$dest" > "$TMP/stdout" 2> "$TMP/stderr"; then
    if [ "$scenario" != running ]; then
      echo "Unexpected success: $scenario" >&2
      exit 1
    fi
  else
    if [ "$scenario" = running ]; then
      cat "$TMP/stderr" >&2
      exit 1
    fi
  fi
  case "$scenario" in
    ssh_fail) grep -q "SSH connection/check failed" "$TMP/stderr";;
    docker_fail) grep -q "remote Docker command failed" "$TMP/stderr";;
    missing) grep -q "does not exist" "$TMP/stderr";;
    stopped) grep -q "exists but is not running" "$TMP/stderr";;
    running)
      test "$(find "$dest" -name '*.sql.gz' | wc -l | tr -d ' ')" -eq 1
      test "$(find "$dest" -name '*.sha256' | wc -l | tr -d ' ')" -eq 1
      gzip -t "$dest"/*.sql.gz
      ;;
  esac
  if [ "$scenario" != running ] && find "$dest" -name '*.sql.gz' | grep -q .; then
    echo "Partial backup created: $scenario" >&2
    exit 1
  fi
done
echo "Backup preflight tests passed"
