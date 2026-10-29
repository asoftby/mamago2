#!/usr/bin/env bash
set -euo pipefail

# Execute from the server's /opt/mamago/{dev,prod} directory, which owns
# the real Compose configuration. Does not install/change host configuration.
# Usage: safe-compose-db-guard.sh <dev|prod> <migrate|cutover>
usage='Usage: safe-compose-db-guard.sh <dev|prod> <migrate|cutover>'
if [ "$#" -ne 2 ]; then echo "$usage" >&2; exit 2; fi
project="$1"
action="$2"
case "$project" in dev|prod) ;; *) echo "$usage" >&2; exit 2;; esac
case "$action" in migrate|cutover) ;; *) echo "$usage" >&2; exit 2;; esac

# Never target an unrelated checkout or another Compose project.
expected_dir="/opt/mamago/$project"
if [ "$(pwd -P)" != "$expected_dir" ]; then
  echo "ABORT: run in $expected_dir (actual server Compose project)" >&2
  exit 1
fi
db_container="$project-db-1"
db_id="$(docker inspect --type container --format '{{.Id}}' "$db_container")"
db_started="$(docker inspect --type container --format '{{.State.StartedAt}}' "$db_container")"
db_running="$(docker inspect --type container --format '{{.State.Running}}' "$db_container")"
if [ "$db_running" != true ]; then
  echo "ABORT: $db_container is not running" >&2; exit 1
fi
db_health="$(docker inspect --type container --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$db_container")"
if [ "$db_health" != healthy ]; then
  echo "ABORT: $db_container health=$db_health (expected healthy)" >&2; exit 1
fi

# Validate the actual host compose configuration before any mutating action.
docker compose -p "$project" config --quiet
db_config_before="$(docker compose -p "$project" config --format json | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["services"]["db"],sort_keys=True))')"
# Validate all service images before migration OR cutover.
config_json="$(docker compose -p "$project" config --format json)"
service_images="$(printf '%s' "$config_json" | python3 -c 'import json,sys; s=json.load(sys.stdin)["services"]; print("\n".join(s[n].get("image","") for n in ("app","worker","migrate")))')"
app_image="$(printf '%s\n' "$service_images" | sed -n '1p')"
worker_image="$(printf '%s\n' "$service_images" | sed -n '2p')"
migrate_image="$(printf '%s\n' "$service_images" | sed -n '3p')"
if [ -z "$app_image" ] || [ "$app_image" != "$worker_image" ] || [ "$app_image" != "$migrate_image" ]; then
  echo "ABORT: app, worker and migrate must share the selected immutable image" >&2
  exit 1
fi
case "$app_image" in
  ghcr.io/asoftby/mamago2:dev-[0-9]*|ghcr.io/asoftby/mamago2:prod-[0-9]*|ghcr.io/asoftby/mamago2@sha256:*) ;;
  *) echo "ABORT: unsupported release image: $app_image" >&2; exit 1 ;;
esac
echo "Selected release image: $app_image"

check_migration_status() {
  docker compose -p "$project" run --rm --no-deps --entrypoint sh migrate -c 'pnpm prisma migrate status'
}

if [ "$action" = cutover ]; then
  # Fail closed if the selected release image has unapplied migrations.
  check_migration_status
  echo "Cutting over app + worker: $app_image"
  docker compose -p "$project" pull app worker
  docker compose -p "$project" up -d --no-deps app worker
else
  echo "Pulling migration image for selected release: $migrate_image"
  docker compose -p "$project" pull migrate
  docker compose -p "$project" run --rm --no-deps migrate
  check_migration_status
fi

db_id_after="$(docker inspect --type container --format '{{.Id}}' "$db_container")"
db_started_after="$(docker inspect --type container --format '{{.State.StartedAt}}' "$db_container")"
db_config_after="$(docker compose -p "$project" config --format json | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["services"]["db"],sort_keys=True))')"
if [ "$db_id" != "$db_id_after" ] || [ "$db_started" != "$db_started_after" ] || [ "$db_config_before" != "$db_config_after" ]; then
  echo "CRITICAL: database container identity/start time/config changed; stop release" >&2
  exit 1
fi
echo "DB_GUARD_OK $db_container id=$db_id started=$db_started"
