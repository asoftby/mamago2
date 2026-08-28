#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/deploy/install-prod-notification-cron.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_SOURCE="$SCRIPT_DIR/run-prod-notification-jobs.sh"
RUNNER_TARGET="/usr/local/sbin/mamago-notification-jobs"
CRON_FILE="/etc/cron.d/mamago-notifications"
LOG_FILE="/var/log/mamago-notification-jobs.log"
LOGROTATE_FILE="/etc/logrotate.d/mamago-notification-jobs"

if [[ ! -f "$RUNNER_SOURCE" ]]; then
  echo "Runner not found: $RUNNER_SOURCE" >&2
  exit 1
fi

install -m 0755 "$RUNNER_SOURCE" "$RUNNER_TARGET"
touch "$LOG_FILE"
chmod 0644 "$LOG_FILE"

cat > "$CRON_FILE" <<'EOF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

*/5 * * * * root flock -n /run/mamago-notification-jobs.lock /usr/local/sbin/mamago-notification-jobs >> /var/log/mamago-notification-jobs.log 2>&1
EOF
chmod 0644 "$CRON_FILE"

cat > "$LOGROTATE_FILE" <<'EOF'
/var/log/mamago-notification-jobs.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
chmod 0644 "$LOGROTATE_FILE"

if command -v systemctl >/dev/null 2>&1; then
  systemctl reload cron 2>/dev/null || systemctl restart cron 2>/dev/null || true
fi

echo "Installed mamaGo notification scheduler:"
echo "  runner: $RUNNER_TARGET"
echo "  cron:   $CRON_FILE"
echo "  log:    $LOG_FILE"
echo
echo "Verify with:"
echo "  cat $CRON_FILE"
echo "  $RUNNER_TARGET"
echo "  tail -100 $LOG_FILE"
