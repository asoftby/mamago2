#!/usr/bin/env bash
set -euo pipefail

# Runs a migration command ONLY after a fresh, verified pg_dump of the target
# DB exists on this machine. Reuses scripts/deploy/backup-remote-db.sh for the
# dump itself; this wrapper adds the gate: no verified dump -> no migration.
#
# Usage:
#   scripts/release/migrate-with-backup.sh <ssh-host-alias> <db-container> [--backup-dir DIR] -- <migration command...>
#
# Example:
#   scripts/release/migrate-with-backup.sh mamago-dev dev-db-1 -- \
#     ssh mamago-dev 'cd /opt/mamago/dev && docker compose -p dev run --rm --no-deps migrate'

USAGE="Usage: $0 <ssh-host-alias> <db-container> [--backup-dir DIR] -- <migration command...>"
SSH_HOST="${1:?${USAGE}}"
DB_CONTAINER="${2:?${USAGE}}"
shift 2

backup_args=()
if [ "${1:-}" = "--backup-dir" ]; then
  [ -n "${2:-}" ] || { echo "${USAGE}" >&2; exit 2; }
  backup_args=("$2")
  shift 2
fi
[ "${1:-}" = "--" ] || { echo "${USAGE}" >&2; exit 2; }
shift
[ "$#" -gt 0 ] || { echo "Error: no migration command after '--'" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPT="${HERE}/../deploy/backup-remote-db.sh"

log="$(mktemp)"
trap 'rm -f "${log}"' EXIT

echo "[migrate-with-backup] step 1/3: pg_dump of ${DB_CONTAINER} via ${SSH_HOST}"
if ! "${BACKUP_SCRIPT}" "${SSH_HOST}" "${DB_CONTAINER}" ${backup_args[@]+"${backup_args[@]}"} | tee "${log}"; then
  echo "[migrate-with-backup] ABORT: backup failed; migration NOT run" >&2
  exit 1
fi

dump="$(sed -n 's/^  File: *//p' "${log}" | tail -n 1)"
echo "[migrate-with-backup] step 2/3: verifying ${dump:-<none>}"
if [ -z "${dump}" ] || [ ! -s "${dump}" ]; then
  echo "[migrate-with-backup] ABORT: dump file missing or empty; migration NOT run" >&2
  exit 1
fi
if ! gzip -t "${dump}"; then
  echo "[migrate-with-backup] ABORT: dump is not a valid gzip; migration NOT run" >&2
  exit 1
fi
# A truncated pg_dump still gzips fine; a complete plain dump ends with this marker.
if ! gzip -dc "${dump}" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
  echo "[migrate-with-backup] ABORT: dump is incomplete (no completion marker); migration NOT run" >&2
  exit 1
fi
if [ ! -f "${dump}.sha256" ] || ! shasum -a 256 -c "${dump}.sha256" >/dev/null; then
  echo "[migrate-with-backup] ABORT: checksum missing or mismatched; migration NOT run" >&2
  exit 1
fi
echo "[migrate-with-backup] BACKUP_OK ${dump}"

echo "[migrate-with-backup] step 3/3: running migration command"
"$@"
