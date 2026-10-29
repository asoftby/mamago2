#!/usr/bin/env bash
# Fixture test: the migration command must run only after a verified dump.
set -euo pipefail
root=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
# Mock ssh: mirror the independent Docker preflight checks; pg_dump emits $MOCK_DUMP.
cat > "$tmp/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
case "$*" in
  *"docker info"*) exit 0 ;;
  *"docker container inspect"*) echo "true" ;;
  *pg_dump*)
    [ "${MOCK_DUMP_FAIL:-0}" = 1 ] && exit 3
    printf '%b' "${MOCK_DUMP:-}" ;;
  *) echo "Unexpected mock SSH command: $*" >&2; exit 64 ;;
esac
MOCK
chmod +x "$tmp/bin/ssh"
export PATH="$tmp/bin:$PATH"
wrapper="$root/migrate-with-backup.sh"
marker="$tmp/migrated"
run() {
  MOCK_DUMP="$1" MOCK_DUMP_FAIL="${2:-0}" \
    "$wrapper" mamago-dev dev-db-1 --backup-dir "$tmp/out" -- touch "$marker" >/dev/null 2>&1
}

# 1) healthy dump -> migration runs
rm -f "$marker"
run "select 1;\n-- PostgreSQL database dump complete\n" || { echo "FAIL: wrapper failed on good dump"; exit 1; }
[ -f "$marker" ] || { echo "FAIL: migration did not run after good dump"; exit 1; }

# 2) pg_dump fails -> migration must NOT run
rm -f "$marker"
if run "x" 1; then echo "FAIL: wrapper succeeded on dump failure"; exit 1; fi
[ ! -f "$marker" ] || { echo "FAIL: migration ran after dump failure"; exit 1; }

# 3) empty dump -> migration must NOT run
rm -f "$marker"
if run ""; then echo "FAIL: wrapper succeeded on empty dump"; exit 1; fi
[ ! -f "$marker" ] || { echo "FAIL: migration ran after empty dump"; exit 1; }

# 3b) truncated dump (no completion marker) -> migration must NOT run
rm -f "$marker"
if run "select 1;"; then echo "FAIL: wrapper succeeded on truncated dump"; exit 1; fi
[ ! -f "$marker" ] || { echo "FAIL: migration ran after truncated dump"; exit 1; }

# 4) missing '--' / command -> usage error
if "$wrapper" mamago-dev dev-db-1 >/dev/null 2>&1; then echo "FAIL: accepted missing command"; exit 1; fi

echo "migrate-with-backup tests passed"
