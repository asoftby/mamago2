#!/usr/bin/env bash
set -euo pipefail

# Runs on the authorized DEV host over SSH, with /opt/mamago/dev as cwd.
# Called ONLY after a verified off-host encrypted backup has been uploaded.
# No PROD commands, no Docker volumes, no auto-rollback after migrations.
tag="${1:-}"
sha="${2:-}"
digest="${3:-}"
if [[ ! "$tag" =~ ^dev-[0-9]+$ ]] ||
   [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]] ||
   [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "ABORT: invalid release identity" >&2; exit 2
fi
if [[ "$(pwd -P)" != "/opt/mamago/dev" ]]; then
  echo "ABORT: not in /opt/mamago/dev" >&2; exit 2
fi
umask 077
exec 9>.ci-dev-deploy.lock
flock -n 9 || { echo "ABORT: another DEV CI deployment holds the lock" >&2; exit 1; }

image="ghcr.io/asoftby/mamago2:$tag"
db="dev-db-1"
db_id="$(docker inspect --type container --format '{{.Id}}' "$db")"
db_started="$(docker inspect --type container --format '{{.State.StartedAt}}' "$db")"
health="$(docker inspect --type container --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$db")"
[[ "$health" == healthy ]] || { echo "ABORT: DEV DB not healthy" >&2; exit 1; }

# Compare the *actual host* Compose DB config before and after APP_VERSION.
# Refuse to change .env if it would alter DB config or service image selection.
docker compose -p dev config --quiet
before="$(docker compose -p dev config --format json)"
after="$(APP_VERSION="$tag" docker compose -p dev config --format json)"
scratch="$(mktemp -d /tmp/mamago-dev-ci.XXXXXXXX)"
trap 'rm -rf "$scratch"' EXIT
printf '%s\n' "$before" > "$scratch/before.json"
printf '%s\n' "$after" > "$scratch/after.json"

python3 - "$image" "$scratch/before.json" "$scratch/after.json" <<'PY'
import json, sys
image, before, after = sys.argv[1:]
old = json.load(open(before))
new = json.load(open(after))
assert old["services"]["db"] == new["services"]["db"], "DB service config changed with APP_VERSION"
for service in ("app", "worker", "migrate"):
    assert new["services"][service].get("image") == image, f"{service}: image mismatch"
print("DEV_COMPOSE_CONFIG_OK")
PY

# Verify the remote image's immutable manifest digest and baked-in identity.
docker pull "$image"
actual_digest="$(docker image inspect "$image" --format '{{json .RepoDigests}}' | python3 -c 'import json,sys; print("\n".join(json.load(sys.stdin)))')"
printf '%s\n' "$actual_digest" | grep -Fqx "ghcr.io/asoftby/mamago2@$digest" || {
  echo "ABORT: registry digest mismatch" >&2; exit 1;
}
image_id="$(docker image inspect "$image" --format '{{.Id}}')"
revision="$(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
build="$(docker image inspect "$image" --format '{{json .Config.Env}}' | python3 -c 'import json,sys; print(next((v for v in json.load(sys.stdin) if v.startswith("BUILD_ID=")), ""))')"
[[ "$revision" == "$sha" && "$build" == "BUILD_ID=$tag" ]] || {
  echo "ABORT: image SHA/build does not match expected release" >&2; exit 1;
}
previous_image="$(docker inspect --type container --format '{{.Config.Image}}' dev-app-1)"
echo "DEV_PREVIOUS_IMAGE=$previous_image"
echo "DEV_IMAGE_VERIFIED tag=$tag sha=$sha digest=$digest"

# Only the APP_VERSION assignment changes. Preserve other .env values and mode.
# The old tag remains in the retained owner-controlled release notes/logs.
python3 - "$tag" <<'PY'
from pathlib import Path
import os, re, sys, tempfile
target = sys.argv[1]
path = Path("/opt/mamago/dev/.env")
content = path.read_text()
matches = list(re.finditer(r"(?m)^APP_VERSION=([^\r\n]*)$", content))
if len(matches) != 1:
    raise SystemExit("ABORT: expected exactly one APP_VERSION assignment in DEV .env")
updated = content[:matches[0].start()] + "APP_VERSION=" + target + content[matches[0].end():]
fd, name = tempfile.mkstemp(prefix=".env.ci-", dir=path.parent)
try:
    with os.fdopen(fd, "w") as stream:
        stream.write(updated)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(name, path.stat().st_mode & 0o777)
    os.replace(name, path)
finally:
    if os.path.exists(name):
        os.unlink(name)
PY

# No dependency reconciliation: the healthy database container cannot be
# recreated by any of these Compose commands. Never call 'down' or 'up db'.
docker compose -p dev run --rm --no-deps migrate
docker compose -p dev run --rm --no-deps --entrypoint sh migrate -c 'pnpm prisma migrate status'
docker compose -p dev up -d --no-deps app worker

for service in app worker; do
  actual="$(docker inspect --type container --format '{{.Image}}' "dev-$service-1")"
  [[ "$actual" == "$image_id" ]] || {
    echo "CRITICAL: dev-$service-1 is not running target image" >&2; exit 1;
  }
done
db_id_after="$(docker inspect --type container --format '{{.Id}}' "$db")"
db_started_after="$(docker inspect --type container --format '{{.State.StartedAt}}' "$db")"
[[ "$db_id_after" == "$db_id" && "$db_started_after" == "$db_started" ]] || {
  echo "CRITICAL: DEV DB restarted/recreated" >&2; exit 1;
}
echo "DEV_HOST_CUTOVER_OK tag=$tag sha=$sha db_unchanged=true"
