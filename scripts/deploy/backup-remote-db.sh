#!/usr/bin/env bash
set -euo pipefail

# Backs up a Postgres DB running in a Docker container on a remote host
# (DEV/PROD, both on the same disk-constrained host) by streaming pg_dump
# output over SSH straight into a local file. The dump never touches the
# remote host's disk, so it is safe to run even when the remote root
# filesystem is nearly full.
#
# Usage:
#   scripts/deploy/backup-remote-db.sh <ssh-host-alias> <db-container-name> [local-backup-dir]
#
# Example:
#   scripts/deploy/backup-remote-db.sh mamago-prod prod-db-1
#   scripts/deploy/backup-remote-db.sh mamago-prod dev-db-1 ~/mamago-backups/dev
#
# Requires: the target container to be a stock `postgres` image container
# (POSTGRES_USER / POSTGRES_DB env vars set inside it, as prod-db-1/dev-db-1
# already are) and SSH access to the host. Does not require any credentials
# on this machine — pg_dump runs inside the remote container using its own
# environment.

SSH_HOST="${1:?Usage: $0 <ssh-host-alias> <db-container-name> [local-backup-dir]}"
DB_CONTAINER="${2:?Usage: $0 <ssh-host-alias> <db-container-name> [local-backup-dir]}"
LOCAL_DIR="${3:-$HOME/mamago-backups/${DB_CONTAINER}}"

mkdir -p "${LOCAL_DIR}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${LOCAL_DIR}/${DB_CONTAINER}-${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${OUT_FILE}.sha256"

echo "Verifying container '${DB_CONTAINER}' is running on ${SSH_HOST}..."
if ! ssh "${SSH_HOST}" "docker ps --format '{{.Names}}'" | grep -qx "${DB_CONTAINER}"; then
  echo "Error: container '${DB_CONTAINER}' is not running on ${SSH_HOST}" >&2
  exit 1
fi

echo "Backing up ${DB_CONTAINER} via ${SSH_HOST} -> ${OUT_FILE}"
echo "(streaming directly to this machine; nothing is written to ${SSH_HOST}'s disk)"

cleanup_partial() {
  rm -f "${OUT_FILE}"
}
trap cleanup_partial ERR

ssh "${SSH_HOST}" \
  "docker exec ${DB_CONTAINER} sh -c 'pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" --no-owner --no-privileges'" \
  | gzip > "${OUT_FILE}"

trap - ERR

if [ ! -s "${OUT_FILE}" ]; then
  echo "Error: backup file is empty" >&2
  rm -f "${OUT_FILE}"
  exit 1
fi

shasum -a 256 "${OUT_FILE}" > "${CHECKSUM_FILE}"

echo "Backup complete."
echo "  File:     ${OUT_FILE}"
echo "  Size:     $(ls -lh "${OUT_FILE}" | awk '{print $5}')"
echo "  Checksum: $(cat "${CHECKSUM_FILE}")"
echo ""
echo "To restore (DESTRUCTIVE — replaces the target DB's public schema):"
echo "  gunzip -c ${OUT_FILE} | ssh ${SSH_HOST} \"docker exec -i ${DB_CONTAINER} sh -c 'psql -U \\\"\\\$POSTGRES_USER\\\" -d \\\"\\\$POSTGRES_DB\\\"'\""
