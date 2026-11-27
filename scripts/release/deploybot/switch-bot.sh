#!/usr/bin/env bash
# Switch mamago-bot.service to the new bot, or back. Run as root on the host.
#
#   switch-bot.sh switch     pre-check in the bot's sandbox, switch, verify;
#                            any failure restores the unit that was running
#   switch-bot.sh rollback   return to the saved legacy unit
#
# Only the bot's unit changes. Application containers are never touched.
set -euo pipefail
trap '' HUP PIPE   # a dropped SSH session must not leave the switch half done

here="$(cd "$(dirname "$0")" && pwd)"
units="${UNIT_DIR:-/etc/systemd/system}"
service=mamago-bot.service
check_service=mamago-bot-check.service
unit="$units/$service"
legacy="$unit.legacy"
new="$here/systemd/$service"
wait_seconds="${WAIT_SECONDS:-60}"
settle_seconds="${SETTLE_SECONDS:-20}"

say() { echo "$*" 2>/dev/null || true; }
die() { say "ABORT: $*"; exit 1; }
is_new() { grep -q 'mamago_deploy\.bot' "$1"; }
restart() { systemctl daemon-reload && { systemctl reset-failed "$service" >/dev/null 2>&1 || true; } && systemctl restart "$service"; }

stable() {  # still up, and not restarted by systemd, after the settle time
  sleep "$settle_seconds"
  [[ "$(systemctl is-active "$service")" == active && "$(systemctl show -p NRestarts --value "$service")" == 0 ]]
}

new_bot_healthy() {  # $1: epoch of the restart
  local log="" i
  for ((i = 0; i < wait_seconds; i++)); do
    log="$(journalctl -u "$service" --since "@$1" --no-pager 2>/dev/null || true)"
    [[ "$log" == *"Run polling for bot"* ]] && break
    sleep 1
  done
  [[ "$log" == *"Run polling for bot"* ]] || { say "the new bot did not start polling"; return 1; }
  stable || { say "the new bot did not stay up"; return 1; }
  log="$(journalctl -u "$service" --since "@$1" --no-pager 2>/dev/null || true)"
  [[ "$log" != *TelegramConflictError* ]] || { say "another instance is polling with the same token"; return 1; }
  if pgrep -f '[d]eploy_bot\.py' >/dev/null; then say "the legacy bot process is still running"; return 1; fi
}

precheck() {  # the bot's own user, sandbox and credentials; the running bot is not touched
  local transient="$units/$check_service" ok=0 since
  sed -e 's/^\(ExecStart=.*-m \)mamago_deploy\.bot$/\1mamago_deploy.check --require-credentials/' \
      -e 's/^Restart=always$/Type=oneshot/' -e '/^RestartSec=/d' -e '/^\[Install\]/,$d' "$new" > "$transient"
  grep -q 'mamago_deploy\.check' "$transient" || { rm -f "$transient"; die "cannot derive the pre-check unit"; }
  systemctl daemon-reload
  since="$(date +%s)"
  systemctl start "$check_service" && ok=1
  journalctl -u "$check_service" --since "@$since" --no-pager 2>/dev/null || true
  rm -f "$transient"
  systemctl daemon-reload
  [[ $ok -eq 1 ]] || die "pre-check failed; nothing was changed"
  say "pre-check passed"
}

previous="" switched=0
restore() {
  local code=$?
  set +e
  if [[ -n "$previous" && $switched -ne 1 ]]; then
    say "restoring the previous unit"
    cp -p "$previous" "$unit"
    if restart && stable; then say "previous bot is running again"
    else say "CRITICAL: the previous bot did not come back; see: journalctl -u $service"; fi
    code=1
  fi
  [[ -z "$previous" ]] || rm -f "$previous"
  exit "$code"
}

[[ -n "${UNIT_DIR:-}" || $EUID -eq 0 ]] || die "run as root"
[[ $# -eq 1 ]] || die "usage: $0 switch|rollback"
case "$1" in
  switch)
    [[ -f "$unit" && -f "$new" ]] || die "unit files are missing"
    is_new "$unit" || cp -p "$unit" "$legacy"   # never overwritten with the new unit
    precheck
    previous="$(mktemp)"
    cp -p "$unit" "$previous"
    trap restore EXIT
    trap 'exit 1' INT TERM
    since="$(date +%s)"
    install -m 644 "$new" "$unit"
    restart
    new_bot_healthy "$since" || exit 1
    switched=1
    say "SWITCHED. Now check /start in Telegram; to go back: $0 rollback" ;;
  rollback)
    [[ -f "$legacy" ]] || die "no saved legacy unit"
    if is_new "$legacy"; then die "the saved unit is not the legacy one"; fi
    cp -p "$legacy" "$unit"
    restart
    stable || die "the legacy bot did not stay up; see: journalctl -u $service"
    say "ROLLED BACK to the legacy bot" ;;
  *) die "usage: $0 switch|rollback" ;;
esac
