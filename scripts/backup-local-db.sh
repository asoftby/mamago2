#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups/db"
umask 077
mkdir -p "${BACKUP_DIR}"

ENV_FILE=""
DATABASE_URL_LINE=""

for candidate in "${ROOT_DIR}/.env.local" "${ROOT_DIR}/.env"; do
  if [[ -f "${candidate}" ]]; then
    DATABASE_URL_LINE="$(grep -E '^DATABASE_URL=' "${candidate}" | tail -n 1 || true)"
    if [[ -n "${DATABASE_URL_LINE}" ]]; then
      ENV_FILE="${candidate}"
      break
    fi
  fi
done

if [[ -z "${ENV_FILE}" ]]; then
  echo "Error: DATABASE_URL not found in .env.local or .env" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Error: env file not found (.env.local or .env)" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL_LINE}" ]]; then
  echo "Error: DATABASE_URL not found in ${ENV_FILE}" >&2
  exit 1
fi

DATABASE_URL_RAW="${DATABASE_URL_LINE#DATABASE_URL=}"
DATABASE_URL="${DATABASE_URL_RAW%\"}"
DATABASE_URL="${DATABASE_URL#\"}"
export DATABASE_URL

DB_PARTS="$(
  node -e '
    const url = new URL(process.env.DATABASE_URL);
    const decode = (value) => decodeURIComponent(value ?? "");
    const parts = [
      url.hostname,
      url.port || "5432",
      decode(url.username),
      decode(url.password),
      url.pathname.replace(/^\//, ""),
    ];
    process.stdout.write(parts.join("\n"));
  '
)"

# Read fixed positions, including an empty password, without shifting fields.
{
  IFS= read -r DB_HOST
  IFS= read -r DB_PORT
  IFS= read -r DB_USER
  IFS= read -r DB_PASSWORD
  IFS= read -r DB_NAME
} <<< "${DB_PARTS}"

if [[ -z "${DB_HOST}" || -z "${DB_PORT}" || -z "${DB_USER}" || -z "${DB_NAME}" ]]; then
  echo "Error: failed to parse DATABASE_URL" >&2
  exit 1
fi

case "${DB_HOST}" in
  localhost|127.0.0.1|\[::1\]) ;;
  *) echo "Error: local backup requires a loopback DATABASE_URL host" >&2; exit 1 ;;
esac

cd "${ROOT_DIR}"
# The app may use a separate Compose project. Never select a database merely
# because it is named db/postgres in this checkout's Compose file.
CONTAINER_IDS="$(docker ps -q --filter "publish=${DB_PORT}")"
if [[ -z "${CONTAINER_IDS}" ]]; then
  echo "Error: no running container publishes DATABASE_URL port ${DB_PORT}" >&2
  exit 1
fi

# Docker's publish filter can also match container-side ports. Verify the host
# binding and require one unambiguous target before touching backup output.
TARGET="$(docker inspect ${CONTAINER_IDS} | node -e '
  const fs = require("node:fs");
  const url = new URL(process.env.DATABASE_URL);
  const port = url.port || "5432";
  const matches = [];
  for (const container of JSON.parse(fs.readFileSync(0, "utf8"))) {
    for (const [internal, bindings] of Object.entries(container.NetworkSettings?.Ports || {})) {
      if (!internal.endsWith("/tcp")) continue;
      if ((bindings || []).some(b => b.HostPort === port &&
          ["", "0.0.0.0", "::", "127.0.0.1", "::1"].includes(b.HostIp))) {
        matches.push([container.Id, internal.split("/")[0]]);
      }
    }
  }
  if (matches.length !== 1) {
    console.error("Error: DATABASE_URL port must identify exactly one running container");
    process.exit(1);
  }
  process.stdout.write(matches[0].join("\n") + "\n");
')"
{
  IFS= read -r CONTAINER_NAME
  IFS= read -r PG_EXEC_PORT
} <<< "${TARGET}"
PG_EXEC_HOST="127.0.0.1"

if ! docker exec "${CONTAINER_NAME}" pg_isready -h "${PG_EXEC_HOST}" -p "${PG_EXEC_PORT}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
  echo "Error: PostgreSQL is not ready in container '${CONTAINER_NAME}' for ${DB_USER}@${PG_EXEC_HOST}:${PG_EXEC_PORT}/${DB_NAME}" >&2
  exit 1
fi

TIMESTAMP="$(date +"%Y-%m-%d-%H-%M-%S")"
BACKUP_SQL="$(mktemp "${BACKUP_DIR}/mamago-local-${TIMESTAMP}.XXXXXX.sql")"
BACKUP_GZ="${BACKUP_SQL}.gz"

echo "Creating backup from ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} using container ${CONTAINER_NAME}..."

cleanup_partial() {
  rm -f "${BACKUP_SQL}" "${BACKUP_GZ}"
}

trap cleanup_partial ERR

docker exec \
  -e PGPASSWORD="${DB_PASSWORD}" \
  "${CONTAINER_NAME}" \
  pg_dump \
  -h "${PG_EXEC_HOST}" \
  -p "${PG_EXEC_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-privileges \
  > "${BACKUP_SQL}"

gzip -f "${BACKUP_SQL}"
trap - ERR

# Retention is deliberately separate from backup creation: preserve existing
# copies until an explicit archival policy has been reviewed.

echo "Backup created successfully: ${BACKUP_GZ}"
