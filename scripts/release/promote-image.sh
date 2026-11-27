#!/usr/bin/env bash
# Registry-side promotion of one verified DEV digest to an unused prod-N tag.
# Every guard exits explicitly: bash 3.2 (macOS) does not abort on a failing
# bare [[ ]] under `set -e`, so validation must never rely on that.
set -euo pipefail

fail() { echo "$1" >&2; exit 1; }

[[ "${DEV_TAG:-}" =~ ^dev-[0-9]+$ ]] || fail 'Invalid DEV_TAG'
[[ "${PROD_TAG:-}" =~ ^prod-[0-9]+$ ]] || fail 'Invalid PROD_TAG'
[[ "${EXPECTED_DIGEST:-}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 'Invalid EXPECTED_DIGEST'
[[ "${IMAGE:-}" == ghcr.io/asoftby/mamago2 ]] || fail 'Invalid IMAGE'

inspect() {
  docker buildx imagetools inspect "$1" --format '{{json .Manifest.Digest}}' | tr -d '"'
}

# Only an explicit, single-line "tag does not exist" answer permits creation.
# buildx/containerd reports a missing tag as "<ref>: not found"; some registries
# answer "manifest unknown". Auth (401/403), transport, multi-line and any other
# ambiguous output stop the promotion (fail closed).
is_missing_manifest_error() {
  local output="$1" ref="$2"
  case "$output" in
    *$'\n'*) return 1 ;;
  esac
  [[ "$output" == "ERROR: $ref: not found" ]] && return 0
  [[ "$output" =~ ^ERROR:[[:space:]]+.*:[[:space:]]+manifest[[:space:]]unknown$ ]] && return 0
  return 1
}

source_digest=$(inspect "$IMAGE:$DEV_TAG") || fail 'Cannot inspect source tag'
[[ "$source_digest" == "$EXPECTED_DIGEST" ]] || fail 'Source digest mismatch'

if existing=$(inspect "$IMAGE:$PROD_TAG" 2>&1); then
  [[ "$existing" == "$EXPECTED_DIGEST" ]] || fail 'Destination digest mismatch; refusing overwrite'
else
  is_missing_manifest_error "$existing" "$IMAGE:$PROD_TAG" || fail 'Cannot establish destination absence; refusing promotion'
  docker buildx imagetools create --prefer-index=false --tag "$IMAGE:$PROD_TAG" "$IMAGE@$EXPECTED_DIGEST"
fi
final_digest=$(inspect "$IMAGE:$PROD_TAG") || fail 'Cannot verify destination tag'
[[ "$final_digest" == "$EXPECTED_DIGEST" ]] || fail 'Destination digest mismatch after promotion'
printf 'Promotion verified: %s -> %s (%s)\n' "$DEV_TAG" "$PROD_TAG" "$EXPECTED_DIGEST"
