#!/usr/bin/env bash
# Break-glass DEV UAT from a shell on the host, without Telegram. Same engine,
# same checks and locks as the bot.
#
#   deploy-uat-dev.sh status | preflight | rollback-preflight
#   deploy-uat-dev.sh deploy --confirm <fingerprint>
#   deploy-uat-dev.sh rollback --confirm <fingerprint>
#   deploy-uat-dev.sh result <operation id>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
config="${MAMAGO_HOST_CONFIG:-/etc/mamago-deploy/host.json}"
release="rel:${MAMAGO_UAT_RELEASE:-rc3-uat}"

run() { (cd "$here" && python3 -E -s -B -m mamago_deploy.executor --config "$config" "$@"); }
usage() { echo "usage: $0 status|preflight|rollback-preflight|deploy --confirm <fp>|rollback --confirm <fp>|result <opid>" >&2; exit 2; }
new_id() { python3 -c 'import secrets; print(secrets.token_hex(16))'; }

case "${1:-}" in
  status|rollback-preflight) [[ $# -eq 1 ]] || usage; run "$1" dev ;;
  preflight) [[ $# -eq 1 ]] || usage; run preflight dev "$release" ;;
  result) [[ $# -eq 2 ]] || usage; run result dev "$2" ;;
  deploy|rollback)
    [[ $# -eq 3 && "$2" == --confirm ]] || usage
    id="$(new_id)"
    echo "operation $id" >&2
    if [[ "$1" == deploy ]]; then run submit-deploy dev "$release" "$3" "$id" manual
    else run submit-rollback dev "$3" "$id" manual; fi
    echo "follow with: $0 result $id" >&2 ;;
  *) usage ;;
esac
