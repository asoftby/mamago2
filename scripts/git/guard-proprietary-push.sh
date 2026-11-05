#!/bin/sh
# Fail closed when unpublished recommendation logic would enter a public origin repository.
# The existing baseline may already be public; this guards *new* disclosures only.
set -eu
remote_name="${1:-origin}"
[ "$remote_name" = "origin" ] || exit 0

base_ref="refs/remotes/origin/dev"
if ! git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
  echo '[security] Push blocked: origin/dev reference is unavailable.' >&2
  exit 1
fi

changed="$(git diff --name-only "$base_ref"...HEAD -- \
  src/server/services/recommendations \
  src/features/city-home/lib/rankHomeByAudience.ts \
  src/features/city-home/lib/personaRanking.ts \
  src/lib/discovery/rankForFamily.ts)"
[ -n "$changed" ] || exit 0

if ! command -v gh >/dev/null 2>&1; then
  echo '[security] Push blocked: GitHub CLI is required to verify repository privacy.' >&2
  exit 1
fi

private="$(gh api repos/asoftby/mamago2 --jq '.private' 2>/dev/null)" || {
  echo '[security] Push blocked: GitHub repository visibility could not be verified.' >&2
  exit 1
}
if [ "$private" != 'true' ]; then
  echo '[security] Push blocked: proprietary recommendation files changed, but origin is PUBLIC.' >&2
  echo '[security] Keep the branch local until the repository is private or a reviewed public-safe patch is prepared.' >&2
  echo "$changed" | sed 's/^/  /' >&2
  exit 1
fi

echo '[security] GitHub confirms origin is private; proprietary-change visibility gate passed.'
