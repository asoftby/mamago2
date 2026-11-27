#!/usr/bin/env bash
# DEV-only UAT deploy and rollback of one allowlisted immutable image.
#
#   deploy-uat-dev.sh status
#   deploy-uat-dev.sh preflight                    read-only
#   deploy-uat-dev.sh deploy   --confirm <fingerprint>
#   deploy-uat-dev.sh rollback-preflight           read-only
#   deploy-uat-dev.sh rollback --confirm <fingerprint>
#
# It does not replace /opt/mamago/scripts/deploy.sh and never touches PROD:
# every Compose call is pinned to project "dev" in /opt/mamago/dev. The
# database container is never recreated, nothing is pruned, no seed runs, and
# a database restore is never automatic. Output carries no environment values.
set -euo pipefail
umask 077

PROJECT=dev
if [[ "${UAT_TEST_MODE:-}" == 1 ]]; then
  DEV_DIR="${UAT_DEV_DIR:?}"
  UAT_HOME="${UAT_HOME:?}"
  LOCK_FILE="${UAT_LOCK_FILE:?}"
  HEALTH_ATTEMPTS="${UAT_HEALTH_ATTEMPTS:-3}"
  SETTLE_SECONDS="${UAT_SETTLE_SECONDS:-0}"
  HEALTH_DELAY="${UAT_HEALTH_DELAY:-0}"
else
  DEV_DIR=/opt/mamago/dev
  UAT_HOME=/opt/mamago/uat
  # Same lock as deploy.sh: one deploy or rollback on this host at a time.
  LOCK_FILE=/tmp/mamago-deploy.lock
  HEALTH_ATTEMPTS=60
  SETTLE_SECONDS=20
  HEALTH_DELAY=2
fi
CONF="$UAT_HOME/release.conf"
MIGRATIONS="$UAT_HOME/migrations.txt"
STATE="$UAT_HOME/state"
LOG_DIR="$UAT_HOME/log"
OVERRIDE="$STATE/compose.uat.yml"
BASE_FILE="$DEV_DIR/docker-compose.yml"
ACTOR="${UAT_ACTOR:-manual}"
[[ "$ACTOR" =~ ^(manual|telegram:[0-9]{1,20})$ ]] || ACTOR=unknown

FAILURES=0
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

say() { printf '%s\n' "$*"; }
pass() { say "PASS $*"; }
fail() { say "FAIL $*"; FAILURES=$((FAILURES + 1)); }
die() { say "ABORT $*"; journal "abort $*"; exit 1; }
journal() {
  mkdir -p "$LOG_DIR"
  printf '%s actor=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ACTOR" "$*" >> "$LOG_DIR/uat.log"
}

# --- configuration -----------------------------------------------------------
conf_get() {
  local key="$1" pattern="$2" value
  value="$(sed -n "s/^${key}=//p" "$CONF")"
  [[ "$value" =~ $pattern ]] || { say "ABORT invalid or missing ${key} in release.conf"; exit 2; }
  printf '%s' "$value"
}

load_conf() {
  [[ -r "$CONF" ]] || { say "ABORT release.conf not found"; exit 2; }
  local sha256='^sha256:[0-9a-f]{64}$' commit='^[0-9a-f]{40}$' number='^[1-9][0-9]{0,3}$'
  IMAGE_REPO="$(conf_get IMAGE_REPO '^[a-z0-9./:_-]+$')"
  IMAGE_TAG="$(conf_get IMAGE_TAG '^uat-[0-9]{8}-[0-9a-f]{12}$')"
  IMAGE_DIGEST="$(conf_get IMAGE_DIGEST "$sha256")"
  IMAGE_CONFIG_DIGEST="$(conf_get IMAGE_CONFIG_DIGEST "$sha256")"
  SOURCE_SHA="$(conf_get SOURCE_SHA "$commit")"
  BUILD_ID="$(conf_get BUILD_ID '^uat-[0-9]{8}-[0-9a-f]{12}$')"
  ROLLBACK_TAG="$(conf_get ROLLBACK_TAG '^dev-[0-9]+$')"
  ROLLBACK_IMAGE_ID="$(conf_get ROLLBACK_IMAGE_ID "$sha256")"
  ROLLBACK_SHA="$(conf_get ROLLBACK_SHA "$commit")"
  EXPECTED_PENDING="$(conf_get EXPECTED_PENDING_MIGRATIONS '^[0-9]{14}_[a-z0-9_]+(,[0-9]{14}_[a-z0-9_]+)*$')"
  MIN_FREE_GB="$(conf_get MIN_FREE_GB "$number")"
  BACKUP_MAX_AGE_HOURS="$(conf_get BACKUP_MAX_AGE_HOURS "$number")"
  PINNED="${IMAGE_REPO}@${IMAGE_DIGEST}"
}

# --- docker helpers ----------------------------------------------------------
compose_base() { docker compose --project-name "$PROJECT" --project-directory "$DEV_DIR" -f "$BASE_FILE" "$@"; }
compose_uat() { docker compose --project-name "$PROJECT" --project-directory "$DEV_DIR" -f "$BASE_FILE" -f "$OVERRIDE" "$@"; }
inspect() { docker inspect --type container --format "$2" "$1" 2>/dev/null; }
image_id() { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null; }
# containerd image store reports the manifest digest as image ID, the classic
# store reports the config digest. Both pin the same content.
is_release_image() { [[ "$1" == "$IMAGE_DIGEST" || "$1" == "$IMAGE_CONFIG_DIGEST" ]]; }
db_identity() { inspect "${PROJECT}-db-1" '{{.Id}} {{.State.StartedAt}}'; }
prod_identity() {
  local id
  for id in $(docker ps -q --no-trunc --filter label=com.docker.compose.project=prod | sort); do
    inspect "$id" '{{.Name}} {{.Id}} {{.State.StartedAt}}'
  done
}

write_override() {
  local target="$1"
  mkdir -p "$(dirname "$target")"
  printf 'services:\n  migrate:\n    image: "%s"\n  app:\n    image: "%s"\n  worker:\n    image: "%s"\n' \
    "$PINNED" "$PINNED" "$PINNED" > "$target.tmp"
  mv "$target.tmp" "$target"
}

# --- checks ------------------------------------------------------------------
check_layout() {
  [[ -f "$BASE_FILE" ]] || { fail "DEV compose file missing"; return; }
  local extra
  for extra in docker-compose.override.yml compose.override.yaml compose.override.yml compose.yaml compose.yml; do
    [[ ! -e "$DEV_DIR/$extra" ]] || fail "unexpected auto-loaded Compose file $extra"
  done
}

check_compose_unchanged() {
  write_override "$SCRATCH/override.yml"
  if ! compose_base config --format json > "$SCRATCH/base.json" 2>/dev/null ||
     ! docker compose --project-name "$PROJECT" --project-directory "$DEV_DIR" -f "$BASE_FILE" \
         -f "$SCRATCH/override.yml" config --format json > "$SCRATCH/uat.json" 2>/dev/null; then
    fail "Compose configuration does not render"; return
  fi
  if python3 - "$SCRATCH/base.json" "$SCRATCH/uat.json" "$PINNED" <<'PY'
import json, sys
base, uat = (json.load(open(p)) for p in sys.argv[1:3])
pinned = sys.argv[3]
assert base["name"] == "dev" and uat["name"] == "dev"
assert set(base["services"]) == set(uat["services"])
assert {"db", "app", "worker", "migrate"} <= set(base["services"])
for name, service in base["services"].items():
    other = uat["services"][name]
    if name in ("app", "worker", "migrate"):
        assert other["image"] == pinned
        assert {k: v for k, v in service.items() if k != "image"} == {k: v for k, v in other.items() if k != "image"}
    else:
        assert service == other
assert base.get("volumes") == uat.get("volumes") and base.get("networks") == uat.get("networks")
PY
  then pass "override changes only app, worker and migrate images; db definition unchanged"
  else fail "UAT override would change more than application images"; fi
}

check_env_flags() {
  [[ -s "$SCRATCH/base.json" ]] || { fail "environment not checked"; return; }
  if python3 - "$SCRATCH/base.json" <<'PY'
import json, sys
services = json.load(open(sys.argv[1]))["services"]
problems = []
for name in ("app", "worker"):
    env = services[name].get("environment") or {}
    if env.get("APP_ENV") != "dev":
        problems.append(f"{name}: APP_ENV is not dev")
    for flag in ("ENABLE_PUBLIC_CLASSES", "ENABLE_PUBLIC_BIRTHDAY", "ENABLE_PUBLIC_PLACES_CATALOG"):
        if str(env.get(flag) or "").strip().lower() == "true":
            problems.append(f"{name}: {flag} is enabled")
app = services["app"].get("environment") or {}
if app.get("TRUST_PROXY_HEADERS") != "true":
    problems.append("app: TRUST_PROXY_HEADERS is not true")
for price in ("BOOST_PRICE_1D_BYN", "BOOST_PRICE_3D_BYN", "BOOST_PRICE_7D_BYN"):
    if not str(app.get(price) or "").strip():
        problems.append(f"app: {price} is not set")
for line in problems:
    print("  " + line)
sys.exit(1 if problems else 0)
PY
  then pass "DEV environment: APP_ENV=dev, release flags off, proxy headers and Boost prices set"
  else fail "DEV environment does not meet UAT requirements"; fi
}

check_db() {
  local health project
  health="$(inspect "${PROJECT}-db-1" '{{if .State.Health}}{{.State.Health.Status}}{{end}}' || true)"
  project="$(inspect "${PROJECT}-db-1" '{{index .Config.Labels "com.docker.compose.project"}}' || true)"
  if [[ "$health" == healthy && "$project" == "$PROJECT" ]]; then pass "dev-db-1 healthy"
  else fail "dev-db-1 not healthy (health=${health:-missing})"; fi
}

current_images() {
  APP_IMAGE_ID="$(inspect "${PROJECT}-app-1" '{{.Image}}' || true)"
  WORKER_IMAGE_ID="$(inspect "${PROJECT}-worker-1" '{{.Image}}' || true)"
}

check_rollback_image() {
  local id
  id="$(image_id "${IMAGE_REPO}:${ROLLBACK_TAG}" || true)"
  if [[ "$id" == "$ROLLBACK_IMAGE_ID" ]]; then pass "rollback image ${ROLLBACK_TAG} present locally (${id:0:19})"
  else fail "rollback image ${ROLLBACK_TAG} missing or different"; fi
}

check_disk() {
  local root free_kb need_kb
  root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
  [[ -d "$root" ]] || root=/
  free_kb="$(df -Pk "$root" | awk 'NR==2 {print $4}')"
  need_kb=$((MIN_FREE_GB * 1024 * 1024))
  if [[ "$free_kb" =~ ^[0-9]+$ ]] && ((free_kb >= need_kb)); then pass "free disk $((free_kb / 1048576)) GB (minimum ${MIN_FREE_GB})"
  else fail "free disk below ${MIN_FREE_GB} GB"; fi
}

check_registry() {
  local resolved
  resolved="$(docker buildx imagetools inspect "${IMAGE_REPO}:${IMAGE_TAG}" --format '{{json .Manifest.Digest}}' 2>/dev/null | tr -d '"' || true)"
  if [[ "$resolved" == "$IMAGE_DIGEST" ]]; then pass "registry tag resolves to the allowlisted digest"
  else fail "registry tag does not resolve to the allowlisted digest"; fi
  docker buildx imagetools inspect --raw "$PINNED" > "$SCRATCH/manifest.json" 2>/dev/null || true
  docker buildx imagetools inspect "$PINNED" --format '{{json .Image}}' > "$SCRATCH/image.json" 2>/dev/null || true
  if python3 - "$SCRATCH/manifest.json" "$SCRATCH/image.json" "$IMAGE_CONFIG_DIGEST" "$SOURCE_SHA" "$BUILD_ID" <<'PY'
import json, sys
manifest, image = (json.load(open(p)) for p in sys.argv[1:3])
config_digest, sha, build = sys.argv[3:6]
config = image.get("config") or {}
env = dict(item.split("=", 1) for item in config.get("Env", []))
assert manifest["config"]["digest"] == config_digest
assert image.get("os") == "linux" and image.get("architecture") == "amd64"
assert (config.get("Labels") or {}).get("org.opencontainers.image.revision") == sha
assert env.get("GIT_COMMIT_SHA") == sha and env.get("BUILD_ID") == build
PY
  then pass "image is linux/amd64, SHA ${SOURCE_SHA:0:12}, Build ID ${BUILD_ID}"
  else fail "image architecture, SHA, Build ID or content digest mismatch"; fi
}

db_query() {
  # Read-only session; credentials stay inside the database container.
  # shellcheck disable=SC2016
  docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "${PROJECT}-db-1" \
    sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"' sh "$1"
}

check_migrations() {
  local mode="$1"
  if ! db_query 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL' > "$SCRATCH/applied" 2>/dev/null ||
     ! db_query 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL' > "$SCRATCH/broken" 2>/dev/null; then
    fail "cannot read migration history"; return
  fi
  [[ "$(cat "$SCRATCH/broken")" == 0 ]] || { fail "database has an unfinished or failed migration"; return; }
  LC_ALL=C sort -u "$SCRATCH/applied" > "$SCRATCH/applied.sorted"
  LC_ALL=C sort -u "$MIGRATIONS" > "$SCRATCH/expected.sorted"
  local extra pending
  extra="$(LC_ALL=C comm -23 "$SCRATCH/applied.sorted" "$SCRATCH/expected.sorted" | paste -sd, -)"
  pending="$(LC_ALL=C comm -13 "$SCRATCH/applied.sorted" "$SCRATCH/expected.sorted" | paste -sd, -)"
  [[ -z "$extra" ]] || { fail "database has migrations unknown to the release: $extra"; return; }
  if [[ "$mode" == complete ]]; then
    if [[ -z "$pending" ]]; then pass "all release migrations applied"; else fail "migrations still pending: $pending"; fi
  elif [[ -z "$pending" || "$pending" == "$EXPECTED_PENDING" ]]; then
    pass "pending migrations as expected: ${pending:-none}"
  else
    fail "unexpected pending migrations: $pending"
  fi
}

check_backup() {
  local manifest="$UAT_HOME/attestation/backup.manifest" signers="$UAT_HOME/allowed_signers"
  [[ -f "$manifest" && -f "$manifest.sig" && -f "$signers" ]] || { fail "signed backup attestation is missing"; return; }
  if ! ssh-keygen -Y verify -f "$signers" -I uat-backup -n mamago-uat-backup -s "$manifest.sig" < "$manifest" >/dev/null 2>&1; then
    fail "backup attestation signature is invalid"; return
  fi
  local db_id
  db_id="$(inspect "${PROJECT}-db-1" '{{.Id}}' || true)"
  if python3 - "$manifest" "$BACKUP_MAX_AGE_HOURS" "$db_id" "$IMAGE_DIGEST" "$ROLLBACK_IMAGE_ID" <<'PY'
import datetime as dt, re, sys
path, max_age, db_id, digest, rollback = sys.argv[1:6]
data = dict(line.split("=", 1) for line in open(path).read().splitlines() if "=" in line)
problems = []
for key in ("db_sha256", "media_sha256"):
    if not re.fullmatch(r"[0-9a-f]{64}", data.get(key, "")):
        problems.append(f"{key} missing")
for key in ("db_bytes", "media_bytes"):
    if not data.get(key, "").isdigit() or int(data[key]) == 0:
        problems.append(f"{key} missing")
if data.get("restore_check") != "PASS":
    problems.append("restore check not attested")
if data.get("dev_db_container_id") != db_id:
    problems.append("backup belongs to another database container")
if data.get("release_digest") != digest or data.get("rollback_image_id") != rollback:
    problems.append("attestation is for another release")
try:
    created = dt.datetime.strptime(data["created_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    age = (dt.datetime.now(dt.timezone.utc) - created).total_seconds() / 3600
    if age > float(max_age) or age < -0.1:
        problems.append(f"backup is {age:.1f} h old (limit {max_age} h)")
except (KeyError, ValueError):
    problems.append("created_utc missing")
for line in problems:
    print("  " + line)
sys.exit(1 if problems else 0)
PY
  then pass "off-host backups attested by signature (database and media, restore checked)"
  else fail "backup attestation rejected"; fi
}

fingerprint() {
  # Binds a confirmation to the exact state the owner saw.
  {
    printf '%s\n' "$1" "$IMAGE_DIGEST" "$APP_IMAGE_ID" "$WORKER_IMAGE_ID" "$(db_identity || true)"
    cat "$CONF" "$BASE_FILE" 2>/dev/null
    cat "$DEV_DIR/.env" "$UAT_HOME/attestation/backup.manifest" 2>/dev/null || true
  } | sha256sum | cut -c1-16
}

# --- health ------------------------------------------------------------------
health_matches() {
  HEALTH_JSON="$1" WANT_SHA="$2" WANT_BUILD="$3" python3 -c '
import json, os, sys
try:
    d = json.loads(os.environ["HEALTH_JSON"])
except Exception:
    sys.exit(1)
sys.exit(0 if d.get("status") == "ok" and d.get("db") == "ok" and d.get("gitSha") == os.environ["WANT_SHA"] and d.get("buildId") == os.environ["WANT_BUILD"] else 1)'
}

internal_health() {
  docker exec "${PROJECT}-app-1" node -e 'fetch("http://127.0.0.1:3000/api/health",{cache:"no-store"}).then(async r=>{if(!r.ok)process.exit(2);process.stdout.write(await r.text())}).catch(()=>process.exit(3))' 2>/dev/null
}

public_health() {
  local url host
  url="$(sed -n 's/^APP_PUBLIC_URL=//p' "$DEV_DIR/.env" | tr -d '\r"' | sed 's#/*$##')"
  [[ "$url" == https://* ]] || return 2
  host="${url#https://}"; host="${host%%[:/]*}"
  curl -fsS --connect-timeout 2 --max-time 5 --resolve "${host}:443:127.0.0.1" -H 'Cache-Control: no-cache' "$url/api/health" 2>/dev/null
}

wait_health() {
  local sha="$1" build="$2" source="$3" i body
  for ((i = 1; i <= HEALTH_ATTEMPTS; i++)); do
    body="$("$source" || true)"
    if health_matches "$body" "$sha" "$build"; then pass "${source/_/ }: ok, db ok, SHA ${sha:0:12}, Build ID $build"; return 0; fi
    sleep "$HEALTH_DELAY"
  done
  fail "${source/_/ } did not confirm SHA ${sha:0:12} / Build ID $build"
  return 1
}

verify_fleet() {
  local expected_check="$1" sha="$2" build="$3" name status restarts
  sleep "$SETTLE_SECONDS"
  current_images
  if [[ -n "$APP_IMAGE_ID" && "$APP_IMAGE_ID" == "$WORKER_IMAGE_ID" ]] && "$expected_check" "$APP_IMAGE_ID"; then
    pass "app and worker run the same expected image (${APP_IMAGE_ID:0:19})"
  else
    fail "app/worker image mismatch (app=${APP_IMAGE_ID:0:19} worker=${WORKER_IMAGE_ID:0:19})"
  fi
  for name in app worker; do
    status="$(inspect "${PROJECT}-${name}-1" '{{.State.Status}}' || true)"
    restarts="$(inspect "${PROJECT}-${name}-1" '{{.RestartCount}}' || true)"
    if [[ "$status" == running && "$restarts" == 0 ]]; then pass "$name running, no restarts"
    else fail "$name is ${status:-missing}, restarts=${restarts:-?}"; fi
  done
  if docker logs "${PROJECT}-worker-1" 2>&1 | grep -qF '[worker] started'; then pass "worker reported start"
  else fail "worker did not report start"; fi
  wait_health "$sha" "$build" internal_health || true
  wait_health "$sha" "$build" public_health || true
}

is_rollback_image() { [[ "$1" == "$ROLLBACK_IMAGE_ID" ]]; }

check_neighbours() {
  if [[ "$(db_identity || true)" == "$1" ]]; then pass "dev-db-1 not recreated or restarted"
  else fail "CRITICAL dev-db-1 identity changed"; fi
  if [[ "$(prod_identity)" == "$2" ]]; then pass "PROD containers unchanged"
  else fail "CRITICAL PROD container identity changed during the operation"; fi
}

# --- commands ----------------------------------------------------------------
run_preflight() {
  check_layout
  check_db
  current_images
  if [[ -n "$APP_IMAGE_ID" && "$APP_IMAGE_ID" == "$WORKER_IMAGE_ID" && "$APP_IMAGE_ID" == "$ROLLBACK_IMAGE_ID" ]]; then
    pass "app and worker currently run ${ROLLBACK_TAG}"
  else
    fail "app/worker are not both on ${ROLLBACK_TAG}"
  fi
  if [[ -n "$(prod_identity)" ]]; then pass "PROD containers recorded (read only)"; else fail "cannot record PROD containers"; fi
  check_compose_unchanged
  check_env_flags
  check_rollback_image
  check_disk
  check_registry
  check_migrations pending
  check_backup
}

finish_preflight() {
  if ((FAILURES == 0)); then
    say "PREFLIGHT_FINGERPRINT=$(fingerprint "$1")"
    say "RESULT READY"
  else
    say "RESULT NOT_READY ($FAILURES failed checks)"
    return 1
  fi
}

cmd_status() {
  current_images
  say "release: $BUILD_ID  digest ${IMAGE_DIGEST:0:19}  SHA ${SOURCE_SHA:0:12}"
  say "app:    $(inspect "${PROJECT}-app-1" '{{.Config.Image}} {{.State.Status}}' || echo missing)"
  say "worker: $(inspect "${PROJECT}-worker-1" '{{.Config.Image}} {{.State.Status}}' || echo missing)"
  say "db:     $(inspect "${PROJECT}-db-1" '{{.State.Health.Status}} since {{.State.StartedAt}}' || echo missing)"
  if is_release_image "$APP_IMAGE_ID"; then say "state:  UAT release is running"
  elif is_rollback_image "$APP_IMAGE_ID"; then say "state:  ${ROLLBACK_TAG} is running"
  else say "state:  another image is running (${APP_IMAGE_ID:0:19})"; fi
  say "health: $(internal_health | head -c 300 || echo unavailable)"
  check_rollback_image
  check_disk
}

cmd_deploy() {
  [[ "$1" =~ ^[0-9a-f]{16}$ ]] || die "invalid confirmation"
  run_preflight
  ((FAILURES == 0)) || die "preflight failed; nothing changed"
  [[ "$(fingerprint deploy)" == "$1" ]] || die "state changed since confirmation; run preflight again; nothing changed"
  local db_before prod_before id env_ok
  db_before="$(db_identity)"; prod_before="$(prod_identity)"
  journal "deploy start $BUILD_ID $IMAGE_DIGEST"

  docker pull "$PINNED" >/dev/null || die "image pull failed; nothing changed"
  id="$(image_id "$PINNED" || true)"
  is_release_image "$id" || die "pulled image ID does not match the release; nothing changed"
  env_ok="$(docker image inspect --format '{{.Os}}/{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}} {{range .Config.Env}}{{println .}}{{end}}' "$PINNED")"
  if [[ "$env_ok" != "linux/amd64 $SOURCE_SHA "* ]] || ! grep -qxF "BUILD_ID=$BUILD_ID" <<<"${env_ok#* * }"; then
    die "pulled image identity mismatch; nothing changed"
  fi
  pass "pulled and verified $PINNED"

  mkdir -p "$STATE"
  printf 'previous_image_id=%s\nprevious_tag=%s\nstarted_utc=%s\n' \
    "$APP_IMAGE_ID" "$ROLLBACK_TAG" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE/previous"
  write_override "$OVERRIDE"

  say "Running migrations..."
  if ! compose_uat run --pull never --rm --no-deps -T migrate < /dev/null; then
    journal "deploy migration_failed"
    die "migration failed; app and worker were NOT switched. Inspect migration state before any retry"
  fi
  check_migrations complete
  ((FAILURES == 0)) || { journal "deploy migration_incomplete"; die "migrations incomplete; app and worker were NOT switched"; }

  say "Switching app and worker..."
  if ! compose_uat up -d --pull never --no-deps --force-recreate app worker; then
    fail "container switch failed"
  else
    verify_fleet is_release_image "$SOURCE_SHA" "$BUILD_ID"
  fi
  check_neighbours "$db_before" "$prod_before"
  if ((FAILURES == 0)); then
    journal "deploy success $BUILD_ID"
    say "RESULT DEPLOYED $BUILD_ID"
    say "Seed was not run. Do not use the bot's regular DEV update button during UAT."
  else
    journal "deploy failed after switch"
    say "RESULT FAILED ($FAILURES checks). Rollback is recommended (/uat_rollback). Database is not restored automatically."
    return 1
  fi
}

run_rollback_preflight() {
  check_layout
  check_db
  check_rollback_image
  current_images
  if [[ "$APP_IMAGE_ID" == "$ROLLBACK_IMAGE_ID" && "$WORKER_IMAGE_ID" == "$ROLLBACK_IMAGE_ID" ]]; then
    fail "nothing to roll back: app and worker already run ${ROLLBACK_TAG}"
  elif [[ -f "$STATE/previous" ]]; then
    pass "previous deployment state recorded"
  else
    fail "no UAT deployment recorded by this tool"
  fi
  check_compose_unchanged
}

cmd_rollback() {
  [[ "$1" =~ ^[0-9a-f]{16}$ ]] || die "invalid confirmation"
  run_rollback_preflight
  ((FAILURES == 0)) || die "rollback preflight failed; nothing changed"
  [[ "$(fingerprint rollback)" == "$1" ]] || die "state changed since confirmation; nothing changed"
  local db_before prod_before
  db_before="$(db_identity)"; prod_before="$(prod_identity)"
  journal "rollback start $ROLLBACK_TAG"
  # Base Compose file only: no override, no migrations, no database restore.
  if ! APP_VERSION="$ROLLBACK_TAG" compose_base up -d --pull never --no-deps --force-recreate app worker; then
    fail "container switch failed"
  else
    verify_fleet is_rollback_image "$ROLLBACK_SHA" "$ROLLBACK_TAG"
  fi
  check_neighbours "$db_before" "$prod_before"
  if ((FAILURES == 0)); then
    mv "$STATE/previous" "$STATE/previous.rolled-back"
    rm -f "$OVERRIDE"
    journal "rollback success $ROLLBACK_TAG"
    say "RESULT ROLLED_BACK $ROLLBACK_TAG. The schema keeps the new migration; no data was restored."
  else
    journal "rollback failed"
    say "RESULT ROLLBACK_FAILED ($FAILURES checks). Manual intervention required."
    return 1
  fi
}

main() {
  local command="${1:-}"
  case "$command" in
    status|preflight|rollback-preflight) [[ $# -eq 1 ]] || die "unexpected arguments" ;;
    deploy|rollback) [[ $# -eq 3 && "$2" == --confirm ]] || die "usage: $command --confirm <fingerprint>" ;;
    *) say "usage: deploy-uat-dev.sh status|preflight|deploy|rollback-preflight|rollback"; exit 2 ;;
  esac
  load_conf
  [[ -d "$DEV_DIR" ]] || die "DEV directory missing"
  cd "$DEV_DIR"
  # Keep Compose from inheriting values that would override DEV configuration.
  unset APP_VERSION COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_PROFILES COMPOSE_ENV_FILES DOCKER_HOST DOCKER_CONTEXT
  if [[ "$command" != status ]]; then
    exec 9>>"$LOCK_FILE"
    flock -n 9 || die "another deploy or rollback is running"
  fi
  case "$command" in
    status) cmd_status ;;
    preflight) run_preflight; finish_preflight deploy ;;
    deploy) cmd_deploy "$3" ;;
    rollback-preflight) run_rollback_preflight; finish_preflight rollback ;;
    rollback) cmd_rollback "$3" ;;
  esac
}

main "$@"
