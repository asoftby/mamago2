#!/usr/bin/env bash
# Test the two pending release SQL migrations on a disposable RESTORED DEV
# database. Isolated Docker container: no network, no published ports, no
# bind mounts, no access to production/dev database services.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 ~/mamago-backups/dev-db-1/dev-db-1-YYYYMMDD-HHMMSS.sql.gz" >&2
  exit 2
fi

backup_dir="$HOME/mamago-backups/dev-db-1"
backup_name=$(basename "$1")
case "$backup_name" in
  dev-db-1-*.sql.gz) ;;
  *) echo "Only DEV database backups are allowed" >&2; exit 2 ;;
esac
source_dir=$(cd -P "$(dirname "$1")" && pwd -P)
expected_dir=$(cd -P "$backup_dir" && pwd -P)
if [ "$source_dir" != "$expected_dir" ]; then
  echo "Backup must be in the approved local DEV backup directory" >&2
  exit 2
fi
backup="$source_dir/$backup_name"
[ -f "$backup" ] && [ -f "$backup.sha256" ] || { echo "Missing backup/checksum" >&2; exit 2; }

root=$(cd "$(dirname "$0")/../.." && pwd -P)
migration_a="$root/prisma/migrations/20261022020000_business_telegram_bot/migration.sql"
migration_b="$root/prisma/migrations/20261022120000_gsc_query_cache/migration.sql"
[ -f "$migration_a" ] && [ -f "$migration_b" ] || { echo "Expected migration SQL files missing" >&2; exit 2; }

# Verify independent local file integrity before running Docker.
shasum -a 256 -c "$backup.sha256"
gzip -t "$backup"
echo "BACKUP_INTEGRITY_OK"

docker info >/dev/null || { echo "Local Docker daemon unavailable" >&2; exit 1; }
docker image inspect postgres:16-alpine >/dev/null || {
  echo "postgres:16-alpine not cached: refusing automatic pull" >&2
  exit 1
}

container="mamago-migration-scratch-$$"
created=0
cleanup() {
  if [ "$created" = 1 ]; then
    docker rm -f "$container" >/dev/null 2>&1 || echo "WARNING: scratch cleanup failed: $container" >&2
  fi
}
trap cleanup EXIT HUP INT TERM

# No SSH, Compose, or connection string from any existing environment.
docker run -d --name "$container" --pull never \
  --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,size=2g \
  -e POSTGRES_USER=postgres -e POSTGRES_DB=restore_scratch \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
created=1
ready=0
for attempt in {1..45}; do
  if docker exec "$container" pg_isready -U postgres -d restore_scratch >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[ "$ready" = 1 ] || { echo "Scratch PostgreSQL did not start" >&2; exit 1; }

echo "RESTORE_BEGIN scratch_container=$container"
gzip -dc "$backup" | docker exec -i "$container" \
  psql -X -q -v ON_ERROR_STOP=1 -U postgres -d restore_scratch >/dev/null
echo "RESTORE_OK"

# Fail rather than accepting a backup with these migrations already applied.
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d restore_scratch <<'SQL'
DO $$
BEGIN
  IF to_regclass('public."BusinessTelegramConnection"') IS NOT NULL
     OR to_regclass('public."BusinessTelegramLinkToken"') IS NOT NULL
     OR to_regclass('public."GscQueryCache"') IS NOT NULL THEN
    RAISE EXCEPTION 'Scratch backup already contains release tables';
  END IF;
END $$;
SQL

echo "APPLYING_SQL_ONLY business_telegram_bot"
docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d restore_scratch < "$migration_a"
echo "APPLYING_SQL_ONLY gsc_query_cache"
docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d restore_scratch < "$migration_b"

docker exec -i "$container" psql -X -A -t -v ON_ERROR_STOP=1 -U postgres -d restore_scratch <<'SQL'
DO $$
BEGIN
  IF to_regclass('public."BusinessTelegramConnection"') IS NULL
     OR to_regclass('public."BusinessTelegramLinkToken"') IS NULL
     OR to_regclass('public."GscQueryCache"') IS NULL THEN
    RAISE EXCEPTION 'Missing expected release table(s)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public'
      AND indexname='GscQueryCache_expiresAt_idx'
  ) THEN
    RAISE EXCEPTION 'Missing GSC cache index';
  END IF;
END $$;
SELECT 'RELEASE_SQL_OK', count(*) FROM "_prisma_migrations";
SQL

echo "SQL_MIGRATIONS_SCRATCH_OK"
echo "IMPORTANT: This validates SQL against a disposable restored DEV snapshot."
echo "It does NOT record migrations in Prisma history or validate app behavior."
