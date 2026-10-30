#!/usr/bin/env bash
# Read-only gate: refuse a release when an APP_VERSION change would mutate
# the DB service definition or select different application images.
# Run in /opt/mamago/{dev|prod} on the target host BEFORE changing .env.
set -euo pipefail
project="${1:-}"
tag="${2:-}"
if [[ ( "$project" != "dev" && "$project" != "prod" ) ||
      ! "$tag" =~ ^(dev|prod)-[0-9]+$ || "${BASH_REMATCH[1]:-}" != "$project" ]]; then
  echo "ABORT: expected <dev|prod> <same-environment-tag>" >&2
  exit 2
fi
if [[ "$(pwd -P)" != "/opt/mamago/$project" ]]; then
  echo "ABORT: run only from /opt/mamago/$project on target host" >&2
  exit 2
fi
db="$project-db-1"
db_id="$(docker inspect --type container --format '{{.Id}}' "$db")"
db_started="$(docker inspect --type container --format '{{.State.StartedAt}}' "$db")"
db_health="$(docker inspect --type container --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$db")"
if [[ "$db_health" != "healthy" ]]; then
  echo "ABORT: database is not healthy" >&2
  exit 1
fi
docker compose -p "$project" config --quiet
umask 077
scratch="$(mktemp -d "/tmp/mamago-compose-gate.XXXXXXXX")"
trap 'rm -rf "$scratch"' EXIT
docker compose -p "$project" config --format json > "$scratch/before.json"
APP_VERSION="$tag" docker compose -p "$project" config --format json > "$scratch/after.json"
python3 - "$project" "$tag" "$scratch/before.json" "$scratch/after.json" <<'PY'
import json
import sys

project, tag, before_path, after_path = sys.argv[1:]
with open(before_path) as stream:
    before = json.load(stream)
with open(after_path) as stream:
    after = json.load(stream)
old_services = before.get("services", {})
new_services = after.get("services", {})
if old_services.get("db") is None or new_services.get("db") is None:
    raise SystemExit("ABORT: DB service not present in both Compose configs")
if old_services["db"] != new_services["db"]:
    raise SystemExit("ABORT: DB Compose config changes with APP_VERSION")
expected_image = f"ghcr.io/asoftby/mamago2:{tag}"
for name in ("app", "worker", "migrate"):
    if new_services.get(name, {}).get("image") != expected_image:
        raise SystemExit(f"ABORT: {name} is not using exact intended immutable image")
print(f"COMPOSE_DB_CONFIG_SAFE project={project} tag={tag}")
PY

# Re-check after computation, still without performing any host mutation.
if [[ "$(docker inspect --type container --format '{{.Id}}' "$db")" != "$db_id" ||
      "$(docker inspect --type container --format '{{.State.StartedAt}}' "$db")" != "$db_started" ]]; then
  echo "ABORT: DB container changed during preflight" >&2
  exit 1
fi
echo "COMPOSE_DB_PREFLIGHT_OK project=$project db_unchanged=true"
echo "Do not run bare compose up/run for migration. Use --no-deps; recheck DB container ID and StartedAt after cutover."
