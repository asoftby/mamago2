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
# This review authorizes only the exact public-safe age/selection code snapshot.
# The closed Family Match experiment is not part of this list. Future edits
# must be reviewed again; a new blob hash fails closed by default.
if [ "$private" != 'true' ]; then
  for path in $changed; do
    expected=""
    case "$path" in
  src/features/city-home/lib/personaRanking.ts) expected="b131f190c774c28527387c70049f16257448c92d" ;;
  src/features/city-home/lib/rankHomeByAudience.ts) expected="95e2d711108541df32ed1dbb38a57c6972561a51" ;;
  src/server/services/recommendations/familyPicks/config.ts) expected="dba613e293949ec6d1504af6837ad9e3ead92cce" ;;
  src/server/services/recommendations/familyPicks/delivery.ts) expected="e9cd0a3dc9187deefe2238d840bbd4e2627eacc0" ;;
  src/server/services/recommendations/familyPicks/home.test.ts) expected="d2d710fdaad2994ef9ca359295d08b91915f9b4d" ;;
  src/server/services/recommendations/familyPicks/home.ts) expected="9c96b5395d8218e2c7dd28ac8b6d424daf873122" ;;
  src/server/services/recommendations/familyPicks/homeDelivery.integration.test.ts) expected="f5b7e227fa8972eaf41633af76e49410dcb2568d" ;;
  src/server/services/recommendations/familyPicks/homeRequest.ts) expected="7b671c00249db5f178ad545c1b62c5e60726e84d" ;;
  src/server/services/recommendations/familyPicks/load.ts) expected="6ee59e3dec1e7253ce2612614bbde9c8ae177713" ;;
  src/server/services/recommendations/familyPicks/personalPolicy.integration.test.ts) expected="507e89632a484d80f07e0c948ab85c5196aadfe4" ;;
  src/server/services/recommendations/familyPicks/personalPolicy.test.ts) expected="d7562a912435ef91dfce2b60fe33408747cec098" ;;
  src/server/services/recommendations/familyPicks/select.ts) expected="d5263960911260c98bc25e8f534012c46136eb25" ;;
      *) echo "[security] Push blocked: unreviewed recommendation path: $path" >&2; exit 1 ;;
    esac
    actual="$(git rev-parse "HEAD:$path" 2>/dev/null)" || exit 1
    if [ "$actual" != "$expected" ]; then
      echo "[security] Push blocked: reviewed recommendation blob changed: $path" >&2
      exit 1
    fi
  done
  if git ls-tree -r --name-only HEAD | grep -E '(^\.private/|familyMatchEvidence|FAMILY_MATCH_V1_CONFIDENTIAL)' >/dev/null; then
    echo '[security] Push blocked: confidential file tracked in HEAD.' >&2
    exit 1
  fi
  echo '[security] Public origin: exact reviewed age/selection snapshot verified; closed Family Match absent.'
  exit 0
fi

echo '[security] GitHub confirms origin is private; proprietary-change visibility gate passed.'
