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
  [[ "${*: -1}" == "$IMAGE@$EXPECTED_DIGEST" ]] || exit 1
  touch "$LOG.created"
elif [[ "$4" == "$IMAGE:$DEV_TAG" || -f "$LOG.created" ]]; then
  printf '"%s"\n' "$EXPECTED_DIGEST"
else
  case "$MODE" in
    same) printf '"%s"\n' "$EXPECTED_DIGEST";;
    different) printf '"sha256:%064d"\n' 2;;
    missing) echo 'ERROR: registry: manifest unknown' >&2; exit 1;;
    notfound) echo "ERROR: $IMAGE:$PROD_TAG: not found" >&2; exit 1;;
    otherref) echo "ERROR: $IMAGE:prod-999: not found" >&2; exit 1;;
    forbidden) printf 'ERROR: unexpected status from HEAD request to https://ghcr.io/v2/x/manifests/%s: 403 Forbidden\ndenied: not found\n' "$PROD_TAG" >&2; exit 1;;
    denied) echo 'ERROR: unauthorized' >&2; exit 1;;
  esac
fi
MOCK
chmod +x "$tmp/docker"
for mode in same different missing notfound otherref forbidden denied; do
  export MODE="$mode"
  rm -f "$LOG.created" "$LOG"
  case "$mode" in
    same|missing|notfound) bash scripts/release/promote-image.sh;;
    *) if bash scripts/release/promote-image.sh; then exit 1; fi;;
  esac
  if [[ "$mode" == missing || "$mode" == notfound ]]; then
    test -f "$LOG.created"
  else
    test ! -f "$LOG.created"
  fi
done
rm -f "$LOG"
for bad in "DEV_TAG=dev-1; invalid" "PROD_TAG=prod-1 x" "EXPECTED_DIGEST=sha256:abc" "IMAGE=ghcr.io/other/image"; do
  if env "$bad" bash scripts/release/promote-image.sh 2>/dev/null; then exit 1; fi
  test ! -e "$LOG"
done
bash -n scripts/release/ci-dev-host-deploy.sh
echo 'Release promotion regressions passed'
