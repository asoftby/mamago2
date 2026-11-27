#!/usr/bin/env bash
set -euo pipefail
[[ "${DEV_TAG:-}" =~ ^dev-[0-9]+$ && "${PROD_TAG:-}" =~ ^prod-[0-9]+$ && "${EXPECTED_DIGEST:-}" =~ ^sha256:[0-9a-f]{64}$ ]]
[[ "${IMAGE:-}" == ghcr.io/asoftby/mamago2 ]]
inspect() {
  docker buildx imagetools inspect "$1" --format '{{json .Manifest.Digest}}' | tr -d '"'
}
source_digest=$(inspect "$IMAGE:$DEV_TAG")
[[ "$source_digest" == "$EXPECTED_DIGEST" ]] || { echo 'Source digest mismatch' >&2; exit 1; }
# Only an explicit registry MANIFEST_UNKNOWN response permits creation.
# All transport, authorization and ambiguous failures stop the promotion.
if existing=$(inspect "$IMAGE:$PROD_TAG" 2>&1); then
  [[ "$existing" == "$EXPECTED_DIGEST" ]] || { echo 'Destination digest mismatch; refusing overwrite' >&2; exit 1; }
else
  if ! [[ "$existing" =~ ^ERROR:[[:space:]]+.*:[[:space:]]+manifest[[:space:]]unknown$ ]]; then
    echo 'Cannot establish destination absence; refusing promotion' >&2
    exit 1
  fi
  docker buildx imagetools create --prefer-index=false --tag "$IMAGE:$PROD_TAG" "$IMAGE@$EXPECTED_DIGEST"
fi
[[ "$(inspect "$IMAGE:$PROD_TAG")" == "$EXPECTED_DIGEST" ]]
printf 'Promotion verified: %s -> %s (%s)\n' "$DEV_TAG" "$PROD_TAG" "$EXPECTED_DIGEST"
