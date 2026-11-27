#!/usr/bin/env bash
# Run on the Mac that holds the off-host backups. Re-checks the archives and
# signs a manifest the server can verify. The server never trusts a bare note.
#
#   make-backup-attestation.sh <db.sql.gz> <media.tar.gz> <ssh-signing-key> <db container id> <release id> <environment> <host id> --restore-check-passed
set -euo pipefail
umask 077

fail() { echo "ABORT: $*" >&2; exit 1; }
[[ $# -eq 8 && "$8" == --restore-check-passed ]] || fail "usage: $0 <db.sql.gz> <media.tar.gz> <signing-key> <db-container-id> <release-id> <environment> <host-id> --restore-check-passed"
db="$1" media="$2" key="$3" db_id="$4" release="$5" environment="$6" host="$7"
here="$(cd "$(dirname "$0")" && pwd)"
[[ -s "$db" && -s "$media" && -r "$key" ]] || fail "missing or empty input"
[[ "$db_id" =~ ^[0-9a-f]{64}$ ]] || fail "db container id must be the full 64-hex id"
[[ "$release" =~ ^[a-z0-9][a-z0-9.-]{0,29}$ && "$environment" =~ ^(dev|prod)$ && "$host" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]] || fail "invalid release, environment or host id"
gzip -t "$db" || fail "database dump is corrupt"
gzip -dc "$db" | tail -n 20 | grep -q 'PostgreSQL database dump complete' || fail "database dump is incomplete"
tar -tzf "$media" >/dev/null || fail "media archive is corrupt"

sha() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | awk '{print $1}'; }
size() { wc -c < "$1" | tr -d ' '; }
digest="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["image_digest"])' "$here/releases/$release.json")"
# The age limit is measured from when the database dump was written, not signed.
created="$(python3 -c 'import datetime as d,os,sys; print(d.datetime.fromtimestamp(os.path.getmtime(sys.argv[1]), d.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))' "$db")"
out="$(dirname "$db")/backup.manifest"
{
  echo "db_sha256=$(sha "$db")"
  echo "db_bytes=$(size "$db")"
  echo "media_sha256=$(sha "$media")"
  echo "media_bytes=$(size "$media")"
  echo "created_utc=$created"
  echo "restore_check=PASS"
  echo "environment=$environment"
  echo "host_id=$host"
  echo "db_container_id=$db_id"
  echo "release_digest=$digest"
} > "$out"
rm -f "$out.sig"
ssh-keygen -Y sign -f "$key" -n mamago-uat-backup "$out" >/dev/null 2>&1 || fail "signing failed"
echo "Signed attestation: $out and $out.sig"
