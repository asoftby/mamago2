#!/usr/bin/env bash
set -euo pipefail

# GitHub runner stage: verified remote pg_dump, encrypt before any host mutation.
# The encrypted backup must be uploaded as a durable artifact before deploy.
tag="${1:-}"
recipient="${2:-}"
host="${3:-}"
if [[ ! "$tag" =~ ^dev-[0-9]+$ ]] || [[ ! "$recipient" =~ ^age1[0-9a-z]+$ ]] || [[ "$host" != mamago-dev-release ]]; then
  echo "ABORT: invalid backup inputs" >&2; exit 2
fi
umask 077
base="${RUNNER_TEMP:?}/mamago-dev-backup-$tag"
mkdir -p "$base"
chmod 700 "$base"
log="$base/backup.log"
# Wrapper verifies gzip, completeness marker, SHA-256 before returning.
bash scripts/release/migrate-with-backup.sh "$host" dev-db-1 --backup-dir "$base" -- true | tee "$log"
dump="$(sed -n 's/^  File: *//p' "$log" | tail -n 1)"
[[ -n "$dump" && -s "$dump" && -s "$dump.sha256" ]] || {
  echo "ABORT: no verified DEV backup" >&2; exit 1;
}
encrypted="$base/dev-db-$tag.sql.gz.age"
age -r "$recipient" -o "$encrypted" "$dump"
[[ -s "$encrypted" ]] || { echo "ABORT: encryption failed" >&2; exit 1; }
# Never upload an unencrypted dump; all payload artifacts use an .age suffix.
rm -f "$dump" "$dump.sha256" "$log"
printf 'BACKUP_ARCHIVE=%s\n' "$encrypted" >> "${GITHUB_ENV:?}"
echo "ENCRYPTED_BACKUP_READY"
