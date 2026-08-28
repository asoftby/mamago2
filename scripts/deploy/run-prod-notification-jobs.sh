#!/usr/bin/env bash
set -euo pipefail

APP_CONTAINER="${MAMAGO_APP_CONTAINER:-}"

if [[ -z "$APP_CONTAINER" ]]; then
  APP_CONTAINER="$(docker ps --filter 'name=prod-app-' --format '{{.Names}}' | head -n 1)"
fi

if [[ -z "$APP_CONTAINER" ]]; then
  echo "[mamago-notifications] no running prod-app-* container found" >&2
  exit 1
fi

run_job() {
  local endpoint="$1"
  local label="$2"

  echo "[mamago-notifications] $(date -u +'%Y-%m-%dT%H:%M:%SZ') start $label container=$APP_CONTAINER"

  docker exec "$APP_CONTAINER" sh -lc '
    set -eu
    if [ -z "${CRON_SECRET:-}" ]; then
      echo "CRON_SECRET is missing" >&2
      exit 2
    fi
    curl -fsS --max-time 240 -o /dev/null \
      -H "Authorization: Bearer $CRON_SECRET" \
      "http://127.0.0.1:3000'"$endpoint"'"
  '

  echo "[mamago-notifications] $(date -u +'%Y-%m-%dT%H:%M:%SZ') finish $label"
}

overall_status=0

if ! run_job "/api/cron/plan-event-reminders" "plan-event-reminders"; then
  echo "[mamago-notifications] plan-event-reminders failed" >&2
  overall_status=1
fi

if ! run_job "/api/cron/plan-tomorrow-digests" "plan-tomorrow-digests"; then
  echo "[mamago-notifications] plan-tomorrow-digests failed" >&2
  overall_status=1
fi

exit "$overall_status"
