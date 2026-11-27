#!/usr/bin/env bash
# Real Docker + Compose + registry + PostgreSQL 16 rehearsal of preflight,
# deploy, rollback and failure paths, using stand-in application images.
# For a disposable machine only (CI): it creates Compose projects "dev" and "prod".
set -euo pipefail

[[ "${CI:-}" == true ]] || { echo "refusing to run outside a disposable CI machine" >&2; exit 2; }
if docker ps -a --format '{{.Names}}' | grep -E '^(dev|prod)-' >/dev/null; then echo "dev/prod containers already exist" >&2; exit 2; fi

src="$(cd "$(dirname "$0")/.." && pwd)"
root="$(mktemp -d)"
dev="$root/dev" home="$root/uat" prod="$root/prod" img="$root/img" bin="$root/bin"
mkdir -p "$dev" "$home/attestation" "$prod" "$img" "$bin"
repo=localhost:5000/mamago2
sha_new="$(printf 'a%.0s' {1..40})" sha_old="$(printf 'b%.0s' {1..40})" build=uat-20261127-aaaaaaaaaaaa
pending=20261126144500_booking_request_reference_number

step() { echo; echo "=== $*"; }
cleanup() {
  (cd "$dev" && docker compose down -v >/dev/null 2>&1) || true
  (cd "$prod" && docker compose down -v >/dev/null 2>&1) || true
  docker rm -f uat-registry >/dev/null 2>&1 || true
}
trap cleanup EXIT

step "registry and stand-in images"
docker run -d --name uat-registry -p 5000:5000 registry:2 >/dev/null
cat > "$img/server.js" <<'JS'
require("http").createServer((q, r) => {
  const ok = process.env.UNHEALTHY !== "1";
  r.end(JSON.stringify({ status: ok ? "ok" : "error", db: "ok", gitSha: process.env.GIT_COMMIT_SHA, buildId: process.env.BUILD_ID }));
}).listen(3000);
JS
printf 'console.log("[worker] started"); setInterval(() => {}, 1000);\n' > "$img/worker.js"
cat > "$img/prisma" <<'SH'
#!/bin/sh
[ "$FAIL_MIGRATE" = 1 ] && { echo "migration failed"; exit 1; }
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -c "insert into \"_prisma_migrations\"(migration_name, finished_at) select '20261126144500_booking_request_reference_number', now() where not exists (select 1 from \"_prisma_migrations\" where migration_name='20261126144500_booking_request_reference_number')"
SH
cat > "$img/Dockerfile" <<'DOCKER'
FROM postgres:16-alpine
RUN apk add --no-cache nodejs
ARG SHA
ARG BUILD
ARG FAIL_MIGRATE=0
ARG UNHEALTHY=0
LABEL org.opencontainers.image.revision=$SHA
ENV GIT_COMMIT_SHA=$SHA BUILD_ID=$BUILD FAIL_MIGRATE=$FAIL_MIGRATE UNHEALTHY=$UNHEALTHY
WORKDIR /app
COPY server.js server.js
COPY worker.js dist/worker/index.js
COPY --chmod=755 prisma node_modules/.bin/prisma
ENTRYPOINT []
CMD ["node", "server.js"]
DOCKER

publish() { # tag sha build fail_migrate unhealthy
  docker build -q --provenance=false --build-arg SHA="$2" --build-arg BUILD="$3" \
    --build-arg FAIL_MIGRATE="$4" --build-arg UNHEALTHY="$5" -t "$repo:$1" "$img" >/dev/null
  docker push -q "$repo:$1" >/dev/null
}
manifest_digest() { docker buildx imagetools inspect "$repo:$1" --format '{{json .Manifest.Digest}}' | tr -d '"'; }
config_digest() { docker buildx imagetools inspect --raw "$repo:$1" | python3 -c 'import json,sys; print(json.load(sys.stdin)["config"]["digest"])'; }

publish dev-1329 "$sha_old" dev-1329 0 0
publish "$build" "$sha_new" "$build" 0 0
rollback_id="$(docker image inspect --format '{{.Id}}' "$repo:dev-1329")"
digest="$(manifest_digest "$build")" config="$(config_digest "$build")"
docker rmi "$repo:$build" >/dev/null

step "DEV and PROD stand-in stacks"
cat > "$dev/.env" <<ENV
APP_VERSION=dev-1329
APP_ENV=dev
APP_PUBLIC_URL=https://dev.example.test
POSTGRES_USER=dev
POSTGRES_PASSWORD=synthetic_only
POSTGRES_DB=dev
DATABASE_URL=postgresql://dev:synthetic_only@db:5432/dev
TRUST_PROXY_HEADERS=true
BOOST_PRICE_1D_BYN=1
BOOST_PRICE_3D_BYN=2
BOOST_PRICE_7D_BYN=3
ENV
cat > "$dev/docker-compose.yml" <<YML
services:
  db:
    image: postgres:16-alpine
    env_file: .env
    volumes: [db_dev_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U \$\$POSTGRES_USER -d \$\$POSTGRES_DB"]
      interval: 2s
      retries: 30
  migrate:
    image: $repo:\${APP_VERSION:-dev}
    env_file: .env
    command: ["./node_modules/.bin/prisma", "migrate", "deploy"]
    depends_on: {db: {condition: service_healthy}}
  app:
    image: $repo:\${APP_VERSION:-dev}
    env_file: .env
    depends_on: {migrate: {condition: service_completed_successfully}}
  worker:
    image: $repo:\${APP_VERSION:-dev}
    env_file: .env
    command: ["node", "dist/worker/index.js"]
volumes:
  db_dev_data:
YML
cat > "$prod/docker-compose.yml" <<'YML'
services:
  app:
    image: postgres:16-alpine
    command: ["sleep", "3600"]
YML
(cd "$prod" && docker compose up -d >/dev/null 2>&1)
(cd "$dev" && docker compose up -d db >/dev/null 2>&1)
for _ in $(seq 1 60); do [[ "$(docker inspect --format '{{.State.Health.Status}}' dev-db-1)" == healthy ]] && break; sleep 2; done
grep -v "^$pending\$" "$src/migrations.txt" > "$root/applied"
{
  echo 'create table "_prisma_migrations"(migration_name text, finished_at timestamptz, rolled_back_at timestamptz);'
  sed "s/.*/insert into \"_prisma_migrations\"(migration_name, finished_at) values ('&', now());/" "$root/applied"
} | docker exec -i dev-db-1 psql -q -v ON_ERROR_STOP=1 -U dev -d dev
(cd "$dev" && docker compose up -d --no-deps app worker >/dev/null 2>&1)

step "tool installation and signed backup attestation"
cp "$src/migrations.txt" "$home/"
write_conf() { # digest config tag build
  cat > "$home/release.conf" <<CONF
IMAGE_REPO=$repo
IMAGE_TAG=$3
IMAGE_DIGEST=$1
IMAGE_CONFIG_DIGEST=$2
SOURCE_SHA=$sha_new
BUILD_ID=$4
ROLLBACK_TAG=dev-1329
ROLLBACK_IMAGE_ID=$rollback_id
ROLLBACK_SHA=$sha_old
EXPECTED_PENDING_MIGRATIONS=$pending
MIN_FREE_GB=1
BACKUP_MAX_AGE_HOURS=24
CONF
}
write_conf "$digest" "$config" "$build" "$build"
ssh-keygen -q -t ed25519 -N '' -f "$root/signer"
echo "uat-backup $(cat "$root/signer.pub")" > "$home/allowed_signers"
docker exec dev-db-1 pg_dump -U dev -d dev | gzip > "$root/db.sql.gz"
tar -czf "$root/media.tar.gz" -C "$img" server.js
attest() {
  mkdir -p "$root/mac" && cp "$src/make-backup-attestation.sh" "$root/mac/" && cp "$home/release.conf" "$root/mac/"
  bash "$root/mac/make-backup-attestation.sh" "$root/db.sql.gz" "$root/media.tar.gz" "$root/signer" \
    "$(docker inspect --format '{{.Id}}' dev-db-1)" --restore-check-passed >/dev/null
  cp "$root/backup.manifest" "$root/backup.manifest.sig" "$home/attestation/"
}
attest
cat > "$bin/curl" <<'SH'
#!/bin/sh
# No TLS proxy in this rehearsal: the "public" probe reads the app directly.
exec docker exec dev-app-1 node -e 'fetch("http://127.0.0.1:3000/api/health").then(async r=>process.stdout.write(await r.text()))'
SH
chmod +x "$bin/curl"

uat() {
  env PATH="$bin:$PATH" UAT_TEST_MODE=1 UAT_DEV_DIR="$dev" UAT_HOME="$home" UAT_LOCK_FILE="$root/lock" \
    UAT_HEALTH_ATTEMPTS=30 UAT_HEALTH_DELAY=1 UAT_SETTLE_SECONDS=3 bash "$src/deploy-uat-dev.sh" "$@"
}
fingerprint() { local out; out="$(uat "$1")" || { echo "$out" >&2; return 1; }; echo "$out" >&2; sed -n 's/^PREFLIGHT_FINGERPRINT=//p' <<<"$out"; }
identity() { docker inspect --format '{{.Id}} {{.State.StartedAt}}' dev-db-1 "$(cd "$prod" && docker compose ps -q app)"; }
app_image() { docker inspect --format '{{.Image}}' dev-app-1; }
before="$(identity)"

step "preflight and deploy"
fp="$(fingerprint preflight)"
uat deploy --confirm "$fp"
[[ "$(app_image)" == "$digest" || "$(app_image)" == "$config" ]]
[[ "$(identity)" == "$before" ]]
applied="$(docker exec dev-db-1 psql -U dev -d dev -Atc "select count(*) from \"_prisma_migrations\" where migration_name='$pending'")"
[[ "$applied" == 1 ]]

step "replayed confirmation is refused"
if uat deploy --confirm "$fp"; then exit 1; fi

step "rollback"
fp="$(fingerprint rollback-preflight)"
uat rollback --confirm "$fp"
[[ "$(app_image)" == "$rollback_id" ]]
[[ "$(identity)" == "$before" ]]

reset_migration() { docker exec dev-db-1 psql -q -U dev -d dev -c "delete from \"_prisma_migrations\" where migration_name='$pending'"; }
bad_release() { # fail_migrate unhealthy
  local tag="uat-20261127-cccccccccccc"
  publish "$tag" "$sha_new" "$tag" "$1" "$2"
  write_conf "$(manifest_digest "$tag")" "$(config_digest "$tag")" "$tag" "$tag"
  docker rmi "$repo:$tag" >/dev/null
  attest
}

step "migration failure leaves the application untouched"
reset_migration
bad_release 1 0
fp="$(fingerprint preflight)"
if uat deploy --confirm "$fp"; then exit 1; fi
[[ "$(app_image)" == "$rollback_id" ]]
[[ "$(identity)" == "$before" ]]

step "unhealthy release is reported, then rolled back"
bad_release 0 1
fp="$(fingerprint preflight)"
if uat deploy --confirm "$fp"; then exit 1; fi
fp="$(fingerprint rollback-preflight)"
uat rollback --confirm "$fp"
[[ "$(app_image)" == "$rollback_id" ]]
[[ "$(identity)" == "$before" ]]

echo
echo "INTEGRATION PASS: deploy, replay refusal, rollback, migration failure, unhealthy release; dev-db and prod untouched"
