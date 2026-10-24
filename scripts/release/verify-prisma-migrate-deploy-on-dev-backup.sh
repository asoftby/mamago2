#!/usr/bin/env bash
# Run Prisma migrate deploy ONLY on a disposable local restore of DEV.
set -euo pipefail
[ "$#" -eq 1 ] || { echo "Usage: $0 <dev-backup.sql.gz>" >&2; exit 2; }
[ "$(git branch --show-current)" = dev ] || { echo "STOP: requires canonical dev checkout" >&2; exit 2; }
git diff --quiet && git diff --cached --quiet || { echo "STOP: dirty tracked checkout" >&2; exit 2; }
[ -f prisma.config.ts ] && [ -d node_modules/.pnpm ] || { echo "STOP: missing repo/dependencies" >&2; exit 2; }
command -v pnpm >/dev/null || exit 2
dir=$(cd -P "$(dirname "$1")" && pwd -P)
expected=$(cd -P "$HOME/mamago-backups/dev-db-1" && pwd -P)
[ "$dir" = "$expected" ] || { echo "STOP: unexpected archive directory" >&2; exit 2; }
archive="$dir/$(basename "$1")"
case "$(basename "$archive")" in dev-db-1-*.sql.gz) ;; *) exit 2 ;; esac
[ -f "$archive" ] && [ -f "$archive.sha256" ] || exit 2
shasum -a 256 -c "$archive.sha256"
gzip -t "$archive"
echo BACKUP_OK

unset DOCKER_CONTEXT DOCKER_HOST
uri=$(command docker context inspect "$(command docker context show)" --format '{{(index .Endpoints "docker").Host}}')
case "$uri" in unix:///*) ;; *) echo "STOP: remote Docker endpoint" >&2; exit 2 ;; esac
[ -S "${uri#unix://}" ] || { echo "STOP: local Docker socket unavailable" >&2; exit 2; }
docker() { command docker --host "$uri" "$@"; }
docker info >/dev/null || exit 2
docker image inspect postgres:16-alpine >/dev/null || { echo "STOP: postgres image not cached" >&2; exit 2; }
name="mamago-prisma-scratch-$$"
created=0
cleanup() {
  if [ "$created" = 1 ]; then
    docker rm -f "$name" >/dev/null 2>&1 && echo SCRATCH_REMOVED || echo "WARNING: cleanup failed for $name" >&2
  fi
}
trap cleanup EXIT
password=$(openssl rand -hex 24)
docker run -d --name "$name" --pull never --network bridge -p 127.0.0.1::5432 \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,size=2g \
  -e POSTGRES_USER=postgres -e POSTGRES_DB=mamago_release_scratch \
  -e POSTGRES_PASSWORD="$password" postgres:16-alpine >/dev/null
created=1
port_line=$(docker port "$name" 5432/tcp)
case "$port_line" in 127.0.0.1:[0-9]*) ;; *) echo "STOP: non-loopback Docker port" >&2; exit 2 ;; esac
port="${port_line#127.0.0.1:}"
case "$port" in ''|*[!0-9]*) exit 2 ;; esac
ready=0
for i in $(seq 1 60); do
  if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres -d mamago_release_scratch >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" = 1 ] || { echo "STOP: scratch DB not ready" >&2; exit 1; }
echo RESTORE_START
gzip -dc "$archive" | docker exec -i "$name" \
  psql -X -q -v ON_ERROR_STOP=1 -U postgres -d mamago_release_scratch >/dev/null
echo RESTORE_OK
query() { docker exec "$name" psql -X -A -t -v ON_ERROR_STOP=1 -U postgres -d mamago_release_scratch -c "$1"; }
before=$(query 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
[ "$before" = 292 ] || { echo "STOP: unexpected baseline migration count: $before" >&2; exit 1; }
for m in 20261022020000_business_telegram_bot 20261022120000_gsc_query_cache; do
  [ "$(query "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='$m'")" = 0 ] || { echo "STOP: $m is already recorded" >&2; exit 1; }
done
url="postgresql://postgres:$password@127.0.0.1:$port/mamago_release_scratch?schema=public"
echo PRISMA_MIGRATE_DEPLOY_START
DATABASE_URL="$url" pnpm exec prisma migrate deploy
[ "$(query 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')" = 294 ] || { echo "STOP: expected 294 completed migrations" >&2; exit 1; }
for m in 20261022020000_business_telegram_bot 20261022120000_gsc_query_cache; do
  [ "$(query "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='$m' AND finished_at IS NOT NULL")" = 1 ] || exit 1
done
for t in BusinessTelegramConnection BusinessTelegramLinkToken GscQueryCache; do
  [ "$(query "SELECT CASE WHEN to_regclass('public.\"$t\"') IS NOT NULL THEN 1 ELSE 0 END")" = 1 ] || exit 1
done
DATABASE_URL="$url" pnpm exec prisma migrate status
echo PRISMA_MIGRATE_SCRATCH_OK
echo 'This verifies Prisma migration execution on disposable DB only, not application runtime.'
