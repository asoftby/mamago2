#!/usr/bin/env bash
# mamaGo release gate: read-only host/runtime/Prisma evidence.
# No environment files, secrets, database writes, service restarts, or image pulls.
set -euo pipefail

if [ "$#" -gt 1 ]; then
  printf 'Usage: %s [SSH_ALIAS]\n' "$0" >&2
  exit 2
fi
ssh_host="${1:-mamago-prod}"
if [ -z "$ssh_host" ] || [[ "$ssh_host" == -* ]]; then
  echo 'Invalid SSH host alias' >&2
  exit 2
fi

printf 'mamaGo read-only release evidence (SSH host: %s)\n' "$ssh_host"
printf 'No .env contents, credentials, or DB application data will be requested.\n'

# Input is a fixed, single-quoted remote script. No local variables are
# interpolated into the remote commands. SSH host-key checks remain enabled.
ssh -T -o ConnectTimeout=10 "$ssh_host" 'bash -s' <<'REMOTE_SCRIPT'
set -u
export LC_ALL=C
problems=0
printf 'EVIDENCE_BEGIN\n'
printf 'host_utc='; date -u '+%Y-%m-%dT%H:%M:%SZ'
printf 'host_name='; hostname
printf '\n=== SHARED DISK (READ ONLY) ===\n'
df -h / || problems=1
printf '\n=== DOCKER DISK (READ ONLY) ===\n'
docker system df || problems=1

for env in prod dev; do
  printf '\n=== ENVIRONMENT %s ===\n' "$env"
  app_rev=''
  worker_rev=''
  for service in app worker db; do
    name="${env}-${service}-1"
    if ! docker container inspect "$name" >/dev/null 2>&1; then
      printf 'container=%s NOT_FOUND\n' "$name"
      problems=1
      continue
    fi
    docker container inspect "$name" \
      --format 'container={{.Name}} status={{.State.Status}} image_ref={{.Config.Image}} image_id={{.Image}}' || problems=1
    if [ "$service" = app ] || [ "$service" = worker ]; then
      image_id=$(docker container inspect "$name" --format '{{.Image}}') || { problems=1; continue; }
      if ! docker image inspect "$image_id" \
        --format 'image_revision={{index .Config.Labels "org.opencontainers.image.revision"}} repo_digests={{json .RepoDigests}}'; then
        printf 'image_inspect=%s FAILED\n' "$name"
        problems=1
      fi
      revision=$(docker image inspect "$image_id" \
        --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null) || revision=''
      if [ "$service" = app ]; then app_rev="$revision"; else worker_rev="$revision"; fi
    fi
  done
  if [ -n "$app_rev" ] && [ -n "$worker_rev" ] && [ "$app_rev" != '<no value>' ] && [ "$worker_rev" != '<no value>' ]; then
    if [ "$app_rev" = "$worker_rev" ]; then
      printf 'app_worker_revision_match=YES revision=%s\n' "$app_rev"
    else
      printf 'app_worker_revision_match=NO app=%s worker=%s\n' "$app_rev" "$worker_rev"
      problems=1
    fi
  else
    printf 'app_worker_revision_match=UNVERIFIED\n'
    problems=1
  fi

  db="${env}-db-1"
  if docker container inspect "$db" >/dev/null 2>&1; then
    printf '\n=== PRISMA MIGRATION METADATA %s (SELECT ONLY) ===\n' "$env"
    if ! docker exec -i "$db" sh -c \
      'exec psql -X -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'PRISMA_SQL'
SELECT 'migration_totals', COUNT(*)::text,
       COUNT(*) FILTER (WHERE finished_at IS NOT NULL)::text,
       COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::text
FROM "_prisma_migrations";
WITH expected(migration_name) AS (VALUES
  ('20261021120000_party_anchor_confirmation'),
  ('20261022020000_business_telegram_bot'),
  ('20261022120000_gsc_query_cache')
)
SELECT 'release_migration', expected.migration_name,
       CASE WHEN m.migration_name IS NULL THEN 'NOT_RECORDED'
            WHEN m.finished_at IS NOT NULL THEN 'APPLIED'
            WHEN m.rolled_back_at IS NOT NULL THEN 'ROLLED_BACK'
            ELSE 'INCOMPLETE'
       END,
       COALESCE(to_char(m.finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '-')
FROM expected LEFT JOIN "_prisma_migrations" m USING (migration_name)
ORDER BY expected.migration_name;
PRISMA_SQL
    then
      printf 'migration_query=%s FAILED\n' "$env"
      problems=1
    fi
  else
    printf 'migration_query=%s SKIPPED_DB_MISSING\n' "$env"
    problems=1
  fi
done

printf '\nEVIDENCE_END incomplete=%s\n' "$problems"
exit "$problems"
REMOTE_SCRIPT
