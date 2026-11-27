#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export PATH="$tmp:$PATH" LOG="$tmp/log"
export IMAGE=ghcr.io/asoftby/mamago2 DEV_TAG=dev-123 PROD_TAG=prod-456
export EXPECTED_DIGEST="sha256:$(printf '%064d' 1)"
cat > "$tmp/docker" <<'MOCK'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$LOG"
if [[ "$3" == create ]]; then
  last_arg=""
  for arg in "$@"; do last_arg="$arg"; done
  [[ "$last_arg" == "$IMAGE@$EXPECTED_DIGEST" ]]
  touch "$LOG.created"
elif [[ "$4" == "$IMAGE:$DEV_TAG" || -f "$LOG.created" ]]; then
  printf '"%s"\n' "$EXPECTED_DIGEST"
else
  case "$MODE" in
    same) printf '"%s"\n' "$EXPECTED_DIGEST";;
    different) printf '"sha256:%064d"\n' 2;;
    missing) echo 'ERROR: registry: manifest unknown' >&2; exit 1;;
    missing-ghcr) echo "ERROR: $IMAGE:$PROD_TAG: not found" >&2; exit 1;;
    other-not-found) echo 'ERROR: ghcr.io/another/repo:prod-456: not found' >&2; exit 1;;
    auth-not-found) echo 'ERROR: 401 unauthorized: not found' >&2; exit 1;;
    denied) echo 'ERROR: unauthorized' >&2; exit 1;;
  esac
fi
MOCK
chmod +x "$tmp/docker"
for mode in same different missing missing-ghcr denied other-not-found auth-not-found; do
  export MODE="$mode"
  rm -f "$LOG.created" "$LOG"
  case "$mode" in
    same|missing|missing-ghcr) bash scripts/release/promote-image.sh;;
    *) if bash scripts/release/promote-image.sh; then exit 1; fi;;
  esac
  if [[ "$mode" == missing || "$mode" == missing-ghcr ]]; then
    test -f "$LOG.created"
  else
    test ! -f "$LOG.created"
  fi
done
rm -f "$LOG"
if DEV_TAG='dev-1; invalid' bash scripts/release/promote-image.sh; then exit 1; fi
test ! -e "$LOG"
bash -n scripts/release/ci-dev-host-deploy.sh
echo 'Release promotion regressions passed'
