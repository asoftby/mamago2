#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups/db"
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

DB_HOST=""
DB_PORT=""
DB_USER=""
DB_PASSWORD=""
DB_NAME=""

while IFS= read -r line; do
  if [[ -z "${DB_HOST}" ]]; then
    DB_HOST="${line}"
  elif [[ -z "${DB_PORT}" ]]; then
    DB_PORT="${line}"
  elif [[ -z "${DB_USER}" ]]; then
    DB_USER="${line}"
  elif [[ -z "${DB_PASSWORD}" ]]; then
    DB_PASSWORD="${line}"
  elif [[ -z "${DB_NAME}" ]]; then
    DB_NAME="${line}"
  fi
done <<< "${DB_PARTS}"

if [[ -z "${DB_HOST}" || -z "${DB_PORT}" || -z "${DB_USER}" || -z "${DB_NAME}" ]]; then
  echo "Error: failed to parse DATABASE_URL from ${ENV_FILE}" >&2
  exit 1
fi

PG_EXEC_HOST="${DB_HOST}"
PG_EXEC_PORT="${DB_PORT}"
if [[ "${DB_HOST}" == "localhost" || "${DB_HOST}" == "127.0.0.1" ]]; then
  PG_EXEC_HOST="127.0.0.1"
  PG_EXEC_PORT="5432"
fi

cd "${ROOT_DIR}"

COMPOSE_CMD=(docker compose)
if ! "${COMPOSE_CMD[@]}" version >/dev/null 2>&1; then
  echo "Error: docker compose is not available" >&2
  exit 1
fi

CONTAINER_NAME=""
for service in db postgres; do
  candidate="$("${COMPOSE_CMD[@]}" ps -q "${service}" 2>/dev/null || true)"
  if [[ -n "${candidate}" ]]; then
    CONTAINER_NAME="$("${COMPOSE_CMD[@]}" ps --format json "${service}" 2>/dev/null | node -e '
      const fs = require("node:fs");
      const lines = fs.readFileSync(0, "utf8").trim().split(/\n+/).filter(Boolean);
      for (const line of lines) {
        try {
          const row = JSON.parse(line);
          if (row.Service && row.State === "running") {
            process.stdout.write(row.Name || "");
            process.exit(0);
          }
        } catch {}
      }
    ' || true)"
    if [[ -n "${CONTAINER_NAME}" ]]; then
      break
    fi
  fi
done

if [[ -z "${CONTAINER_NAME}" ]]; then
  echo "Error: could not find a running postgres container via 'docker compose ps' (expected service 'db' or 'postgres')" >&2
  exit 1
fi

if ! docker exec "${CONTAINER_NAME}" pg_isready -h "${PG_EXEC_HOST}" -p "${PG_EXEC_PORT}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
  echo "Error: PostgreSQL is not ready in container '${CONTAINER_NAME}' for ${DB_USER}@${PG_EXEC_HOST}:${PG_EXEC_PORT}/${DB_NAME}" >&2
  exit 1
fi

TIMESTAMP="$(date +"%Y-%m-%d-%H-%M-%S")"
BACKUP_SQL="${BACKUP_DIR}/mamago-local-${TIMESTAMP}.sql"
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

find "${BACKUP_DIR}" -type f \( -name '*.sql' -o -name '*.sql.gz' \) -mtime +14 -delete

echo "Backup created successfully: ${BACKUP_GZ}"
