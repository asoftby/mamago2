#!/usr/bin/env bash
# Disposable CI runner only. Installs the gate at its production paths, serves it
# through a real sshd with per-environment forced commands, and drives deploys
# against real Docker, Compose, a local registry and PostgreSQL 16.
set -euo pipefail

[[ "${CI:-}" == true && "${RUNNER_ENVIRONMENT:-}" == github-hosted ]] || { echo "refusing to run outside a disposable CI runner" >&2; exit 2; }
if docker ps -a --format '{{.Names}}' | grep -E '^(dev|prod)-' >/dev/null; then echo "dev/prod containers already exist" >&2; exit 2; fi

src="$(cd "$(dirname "$0")/.." && pwd)"
root="$(mktemp -d)"
dev="$root/dev" prod="$root/prod" img="$root/img" keys="$root/keys" ssh_dir="$root/sshd"
mkdir -p "$dev" "$prod" "$img" "$keys" "$ssh_dir"
repo=localhost:5000/mamago2
pending=20261126144500_booking_request_reference_number

step() { echo; echo "=== $*"; }

step "registry and stand-in images"
docker run -d --name registry -p 5000:5000 registry:2 >/dev/null
cat > "$img/server.js" <<'JS'
require("http").createServer((q, r) => {
  const ok = process.env.UNHEALTHY !== "1";
  r.end(JSON.stringify({ status: ok ? "ok" : "error", db: "ok", gitSha: process.env.GIT_COMMIT_SHA, buildId: process.env.BUILD_ID }));
}).listen(3000);
JS
printf 'console.log("[worker] started"); setInterval(() => {}, 1000);\n' > "$img/worker.js"
cat > "$img/prisma" <<'SH'
#!/bin/sh
sleep "${MIGRATE_SECONDS:-0}"
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
ARG MIGRATE_SECONDS=0
LABEL org.opencontainers.image.revision=$SHA
ENV GIT_COMMIT_SHA=$SHA BUILD_ID=$BUILD FAIL_MIGRATE=$FAIL_MIGRATE UNHEALTHY=$UNHEALTHY MIGRATE_SECONDS=$MIGRATE_SECONDS
WORKDIR /app
COPY server.js server.js
COPY worker.js dist/worker/index.js
COPY --chmod=755 prisma node_modules/.bin/prisma
ENTRYPOINT []
CMD ["node", "server.js"]
DOCKER
sha_old="$(printf 'b%.0s' {1..40})"
publish() { # tag sha fail unhealthy seconds
  docker build -q --provenance=false --build-arg SHA="$2" --build-arg BUILD="$1" --build-arg FAIL_MIGRATE="$3" \
    --build-arg UNHEALTHY="$4" --build-arg MIGRATE_SECONDS="$5" -t "$repo:$1" "$img" >/dev/null
  docker push -q "$repo:$1" >/dev/null
}
publish dev-1 "$sha_old" 0 0 0
release() { # id sha fail unhealthy seconds
  publish "uat-$1" "$2" "$3" "$4" "$5"
  local digest config
  digest="$(docker buildx imagetools inspect "$repo:uat-$1" --format '{{json .Manifest.Digest}}' | tr -d '"')"
  config="$(docker buildx imagetools inspect --raw "$repo:uat-$1" | python3 -c 'import json,sys; print(json.load(sys.stdin)["config"]["digest"])')"
  docker rmi "$repo:uat-$1" >/dev/null
  python3 - "$src/releases/rc3-uat.json" "$1" "$2" "$digest" "$config" <<'PY' | sudo tee "/etc/mamago-deploy/releases/$1.json" >/dev/null
import json, sys
template, name, sha, digest, config = sys.argv[1:]
data = json.load(open(template))
data.update(id=name, image_tag=f"uat-{name}", build_id=f"uat-{name}", source_sha=sha, image_digest=digest, config_digest=config)
print(json.dumps(data))
PY
}

step "install executor at production paths"
sudo install -d /opt/mamago-deploy /etc/mamago-deploy/releases
sudo cp -r "$src/mamago_deploy" /opt/mamago-deploy/
sudo install -m 755 "$src/gate" /opt/mamago-deploy/gate
sudo cp "$src/releases/rc3-uat.migrations" /etc/mamago-deploy/releases/
sudo install -d -o "$USER" /var/lib/mamago-deploy
ssh-keygen -q -t ed25519 -N '' -f "$keys/signer"
echo "uat-backup $(cat "$keys/signer.pub")" | sudo tee /etc/mamago-deploy/allowed_signers >/dev/null
python3 - "$dev" "$prod" "$root" "$repo" <<'PY' | sudo tee /etc/mamago-deploy/host.json >/dev/null
import json, sys
dev, prod, root, repo = sys.argv[1:]
def env(name, directory):
    return {"compose_dir": directory, "project": name, "db_container": f"{name}-db-1", "image_repo": repo, "tag_deploy": name == "dev",
            "log_services": ["app", "worker"], "public_health_url": f"https://{name}.example.test/api/health",
            "required_env": {"APP_ENV": "dev", "TRUST_PROXY_HEADERS": "true"} if name == "dev" else {},
            "min_free_gb": 1, "require_attestation": False, "local_dump": True, "backup_max_age_hours": 24,
            "attestation_dir": f"{root}/{name}-attestation", "allowed_signers": "/etc/mamago-deploy/allowed_signers"}
print(json.dumps({"host_id": "ci-host", "state_dir": "/var/lib/mamago-deploy", "releases_dir": "/etc/mamago-deploy/releases",
                  "lock_file": "/tmp/mamago-deploy.lock", "health_attempts": 40, "health_delay": 1, "settle_seconds": 3,
                  "environments": {"dev": env("dev", dev), "prod": env("prod", prod)}}))
PY
# No TLS proxy in this rehearsal: the "public" probe reads the app directly.
sudo tee /usr/local/bin/curl >/dev/null <<'SH'
#!/bin/sh
exec docker exec dev-app-1 node -e 'fetch("http://127.0.0.1:3000/api/health").then(async r=>process.stdout.write(await r.text()))'
SH
sudo chmod 755 /usr/local/bin/curl

step "DEV and PROD stand-in stacks"
cat > "$dev/.env" <<ENV
APP_VERSION=dev-1
APP_ENV=dev
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
  worker:
    image: $repo:\${APP_VERSION:-dev}
    env_file: .env
    command: ["node", "dist/worker/index.js"]
volumes:
  db_dev_data:
YML
printf 'services:\n  app:\n    image: postgres:16-alpine\n    command: ["sleep", "3600"]\n' > "$prod/docker-compose.yml"
(cd "$prod" && docker compose up -d >/dev/null 2>&1)
(cd "$dev" && docker compose up -d db >/dev/null 2>&1)
for _ in $(seq 1 60); do [[ "$(docker inspect --format '{{.State.Health.Status}}' dev-db-1)" == healthy ]] && break; sleep 2; done
grep -v "^$pending\$" "$src/releases/rc3-uat.migrations" > "$root/applied"
{
  echo 'create table "_prisma_migrations"(migration_name text, finished_at timestamptz, rolled_back_at timestamptz);'
  sed "s/.*/insert into \"_prisma_migrations\"(migration_name, finished_at) values ('&', now());/" "$root/applied"
} | docker exec -i dev-db-1 psql -q -v ON_ERROR_STOP=1 -U dev -d dev
(cd "$dev" && docker compose up -d --no-deps app worker >/dev/null 2>&1)

step "sshd with per-environment forced commands"
ssh-keygen -q -t ed25519 -N '' -f "$ssh_dir/host_key"
for name in dev prod; do ssh-keygen -q -t ed25519 -N '' -f "$keys/$name"; done
for name in dev prod; do
  echo "restrict,command=\"/opt/mamago-deploy/gate --env $name\" $(cat "$keys/$name.pub")"
done > "$ssh_dir/authorized_keys"
chmod 600 "$ssh_dir/authorized_keys"
cat > "$ssh_dir/sshd_config" <<CONF
Port 2222
ListenAddress 127.0.0.1
HostKey $ssh_dir/host_key
AuthorizedKeysFile $ssh_dir/authorized_keys
PasswordAuthentication no
KbdInteractiveAuthentication no
UsePAM no
StrictModes no
PidFile $ssh_dir/sshd.pid
CONF
sudo mkdir -p /run/sshd
/usr/sbin/sshd -f "$ssh_dir/sshd_config" -E "$ssh_dir/sshd.log"
echo "[127.0.0.1]:2222 $(cut -d' ' -f1,2 "$ssh_dir/host_key.pub")" > "$keys/known_hosts"

step "releases"
release good "$(printf 'a%.0s' {1..40})" 0 0 4
release badmigration "$(printf 'c%.0s' {1..40})" 1 0 0
release unhealthy "$(printf 'd%.0s' {1..40})" 0 1 0

python3 -B "$src/tests/e2e_ssh.py" "$root" "$keys" "$USER" "$pending"

step "real systemd: sandbox pre-check, credentials and automatic rollback"
bash "$src/tests/systemd.sh" "$src" "$keys"
