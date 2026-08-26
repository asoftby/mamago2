#!/usr/bin/env bash
set -euo pipefail

# Production-safe remote media-storage backup.
# Streams a read-only tar.gz of the Docker named volume (or container mount)
# over SSH to the operator machine. Source files are never modified.
#
# Usage:
#   scripts/deploy/backup-remote-media.sh <ssh-host-alias> <app-container-name> [options]
#
# Options:
#   --volume <name>         Docker volume name (default: derive from compose
#                           project of <app-container>, e.g. prod_mamago2_storage)
#   --storage-path <path>   Path inside the app container / volume root that
#                           holds media (default: /app/storage)
#   --local-dir <path>      Local destination directory
#                           (default: ~/mamago-backups/<container>-media)
#   --min-free-bytes <n>    Refuse if local free space is below this
#                           (default: source bytes * 2, floored at 2 GiB)
#   --dry-run               Plan + validate only; write nothing
#
# Examples:
#   scripts/deploy/backup-remote-media.sh mamago-prod prod-app-1 --dry-run
#   scripts/deploy/backup-remote-media.sh mamago-prod prod-app-1 \
#     --volume prod_mamago2_storage
#   scripts/deploy/backup-remote-media.sh mamago-prod prod-app-1 \
#     --local-dir ~/mamago-backups/prod-media
#
# Integrity checks after a real backup:
#   - archive non-empty
#   - gzip -t
#   - tar -tzf listing
#   - source file count == archive regular-file count
#   - SHA-256 sidecar written
#
# No credentials are hardcoded. SSH host aliases and Docker names are
# supplied by the operator.

usage() {
  cat <<'EOF' >&2
Usage: scripts/deploy/backup-remote-media.sh <ssh-host-alias> <app-container-name> [options]

Options:
  --volume <name>
  --storage-path <path>     (default: /app/storage)
  --local-dir <path>
  --min-free-bytes <n>
  --dry-run
  -h, --help
EOF
  exit 2
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

SSH_HOST="${1:?$(usage)}"
APP_CONTAINER="${2:?$(usage)}"
shift 2

VOLUME_NAME=""
STORAGE_PATH="/app/storage"
LOCAL_DIR=""
MIN_FREE_BYTES=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --volume)
      VOLUME_NAME="${2:?--volume requires a value}"
      shift 2
      ;;
    --storage-path)
      STORAGE_PATH="${2:?--storage-path requires a value}"
      shift 2
      ;;
    --local-dir)
      LOCAL_DIR="${2:?--local-dir requires a value}"
      shift 2
      ;;
    --min-free-bytes)
      MIN_FREE_BYTES="${2:?--min-free-bytes requires a value}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Error: unknown argument: $1" >&2
      usage
      ;;
  esac
done

LOCAL_DIR="${LOCAL_DIR:-$HOME/mamago-backups/${APP_CONTAINER}-media}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${LOCAL_DIR}/${APP_CONTAINER}-media-${TIMESTAMP}.tar.gz"
CHECKSUM_FILE="${OUT_FILE}.sha256"

remote() {
  ssh "${SSH_HOST}" "$@"
}

echo "Verifying container '${APP_CONTAINER}' is running on ${SSH_HOST}..."
if ! remote "docker ps --format '{{.Names}}'" | grep -qx "${APP_CONTAINER}"; then
  echo "Error: container '${APP_CONTAINER}' is not running on ${SSH_HOST}" >&2
  exit 1
fi

if [[ -z "${VOLUME_NAME}" ]]; then
  # Prefer the named volume behind STORAGE_PATH when present.
  VOLUME_NAME="$(
    remote "docker inspect -f '{{range .Mounts}}{{println .Destination \"|\" .Name \"|\" .Type}}{{end}}' '${APP_CONTAINER}'" \
      | awk -F' [|] ' -v want="${STORAGE_PATH}" '
          $1 == want && $3 == "volume" && $2 != "" { print $2; found=1; exit }
          END { exit found ? 0 : 1 }
        '
  )" || true
  if [[ -z "${VOLUME_NAME}" ]]; then
    PROJECT="$(remote "docker inspect -f '{{index .Config.Labels \"com.docker.compose.project\"}}' '${APP_CONTAINER}'")"
    if [[ -z "${PROJECT}" || "${PROJECT}" == "<no value>" ]]; then
      echo "Error: could not derive Docker volume; pass --volume explicitly" >&2
      exit 1
    fi
    VOLUME_NAME="${PROJECT}_mamago2_storage"
  fi
fi

echo "Resolving media storage source..."
echo "  SSH host:       ${SSH_HOST}"
echo "  App container:  ${APP_CONTAINER}"
echo "  Volume:         ${VOLUME_NAME}"
echo "  Storage path:   ${STORAGE_PATH}"
echo "  Local dir:      ${LOCAL_DIR}"
echo "  Mode:           $([[ "${DRY_RUN}" -eq 1 ]] && echo dry-run || echo apply)"

if ! remote "docker volume inspect '${VOLUME_NAME}' >/dev/null"; then
  echo "Error: Docker volume '${VOLUME_NAME}' not found on ${SSH_HOST}" >&2
  exit 1
fi

# Confirm the path exists inside the live app container (read-only probe).
if ! remote "docker exec '${APP_CONTAINER}' sh -c 'test -d \"${STORAGE_PATH}\"'" ; then
  echo "Error: storage path '${STORAGE_PATH}' does not exist in ${APP_CONTAINER}" >&2
  exit 1
fi

SOURCE_FILE_COUNT="$(
  remote "docker exec '${APP_CONTAINER}' sh -c 'find \"${STORAGE_PATH}\" -type f | wc -l'" | tr -d '[:space:]'
)"
# Prefer byte-accurate GNU du -sb; fall back to KiB * 1024 (BusyBox-safe).
SOURCE_BYTES="$(
  remote "docker exec '${APP_CONTAINER}' sh -c '
    if du -sb \"${STORAGE_PATH}\" >/tmp/mamago-du-bytes 2>/dev/null; then
      cut -f1 /tmp/mamago-du-bytes
    else
      du -sk \"${STORAGE_PATH}\" | awk \"{print \\\$1 * 1024}\"
    fi
  '" | tr -d '[:space:]'
)"

if [[ -z "${SOURCE_FILE_COUNT}" || ! "${SOURCE_FILE_COUNT}" =~ ^[0-9]+$ ]]; then
  echo "Error: failed to count source files" >&2
  exit 1
fi
if [[ -z "${SOURCE_BYTES}" || ! "${SOURCE_BYTES}" =~ ^[0-9]+$ ]]; then
  echo "Error: failed to measure source bytes" >&2
  exit 1
fi

echo "  Source files:   ${SOURCE_FILE_COUNT}"
echo "  Source bytes:   ${SOURCE_BYTES}"

REQUIRED_FREE="${MIN_FREE_BYTES}"
if [[ -z "${REQUIRED_FREE}" ]]; then
  # Keep at least 2x source size or 2 GiB, whichever is larger.
  DOUBLE=$((SOURCE_BYTES * 2))
  FLOOR=$((2 * 1024 * 1024 * 1024))
  if [[ "${DOUBLE}" -gt "${FLOOR}" ]]; then
    REQUIRED_FREE="${DOUBLE}"
  else
    REQUIRED_FREE="${FLOOR}"
  fi
fi

mkdir -p "${LOCAL_DIR}"
LOCAL_FREE_BYTES="$(df -Pk "${LOCAL_DIR}" | awk 'NR==2 {print $4 * 1024}')"
if [[ -z "${LOCAL_FREE_BYTES}" || ! "${LOCAL_FREE_BYTES}" =~ ^[0-9]+$ ]]; then
  echo "Error: failed to measure local free disk" >&2
  exit 1
fi
echo "  Local free:     ${LOCAL_FREE_BYTES} bytes"
echo "  Required free:  ${REQUIRED_FREE} bytes"

if [[ "${LOCAL_FREE_BYTES}" -lt "${REQUIRED_FREE}" ]]; then
  echo "Error: insufficient local free disk for media backup" >&2
  exit 1
fi

echo "  Planned artifact: ${OUT_FILE}"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "Dry-run complete. No archive written."
  echo "Would stream: docker run --rm -v ${VOLUME_NAME}:/data:ro alpine"
  echo "  tar -czf - -C /data ."
  exit 0
fi

cleanup_partial() {
  rm -f "${OUT_FILE}" "${CHECKSUM_FILE}"
}
trap cleanup_partial ERR

echo "Streaming read-only archive from ${VOLUME_NAME} -> ${OUT_FILE}"
echo "(source mounted :ro; nothing is written on ${SSH_HOST})"

# Archive the volume root. Relative paths are preserved via -C /data .
# STORAGE_PATH inside the app is typically /app/storage, which is the volume root.
remote "docker run --rm -v '${VOLUME_NAME}:/data:ro' alpine tar -czf - -C /data ." \
  > "${OUT_FILE}"

trap - ERR

if [[ ! -s "${OUT_FILE}" ]]; then
  echo "Error: backup file is empty" >&2
  cleanup_partial
  exit 1
fi

echo "Verifying archive integrity..."
gzip -t "${OUT_FILE}"

ARCHIVE_LISTING="$(mktemp)"
trap 'rm -f "${ARCHIVE_LISTING}"; cleanup_partial' ERR
tar -tzf "${OUT_FILE}" > "${ARCHIVE_LISTING}"

# tar -tzf lists every member; count regular files only (exclude trailing / dirs).
ARCHIVE_FILE_COUNT="$(
  awk '
    /\/$/ { next }
    { count++ }
    END { print count + 0 }
  ' "${ARCHIVE_LISTING}"
)"
rm -f "${ARCHIVE_LISTING}"
trap cleanup_partial ERR

ARCHIVE_BYTES="$(wc -c < "${OUT_FILE}" | tr -d '[:space:]')"

echo "  Archive files:  ${ARCHIVE_FILE_COUNT}"
echo "  Archive bytes:  ${ARCHIVE_BYTES}"

if [[ "${ARCHIVE_FILE_COUNT}" -ne "${SOURCE_FILE_COUNT}" ]]; then
  echo "Error: archive file count (${ARCHIVE_FILE_COUNT}) != source file count (${SOURCE_FILE_COUNT})" >&2
  cleanup_partial
  exit 1
fi

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${OUT_FILE}" > "${CHECKSUM_FILE}"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${OUT_FILE}" > "${CHECKSUM_FILE}"
else
  echo "Error: neither shasum nor sha256sum is available" >&2
  cleanup_partial
  exit 1
fi

trap - ERR

echo "Backup complete."
echo "  File:     ${OUT_FILE}"
echo "  Size:     $(ls -lh "${OUT_FILE}" | awk '{print $5}')"
echo "  Checksum: $(cat "${CHECKSUM_FILE}")"
echo ""
echo "To restore (DESTRUCTIVE — replaces the target volume contents):"
echo "  1. Stop app/worker containers that mount the volume."
echo "  2. Stream the archive into an empty volume, e.g.:"
echo "     gunzip -c ${OUT_FILE} | ssh ${SSH_HOST} \\"
echo "       \"docker run --rm -i -v ${VOLUME_NAME}:/data alpine tar -xpf - -C /data\""
echo "  3. Restore the matching DB backup BEFORE bringing traffic back, or"
echo "     immediately after storage restore while the app stays offline,"
echo "     so DB filenames never point at missing storage objects."
