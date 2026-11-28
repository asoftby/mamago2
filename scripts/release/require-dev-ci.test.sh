#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export PATH="$tmp:$PATH" EXPECTED_SHA="$(printf '%040d' 1)" GITHUB_REPOSITORY=asoftby/mamago2
cat > "$tmp/gh" <<'MOCK'
#!/usr/bin/env bash
set -eu
[[ "$*" == *"head_sha=$EXPECTED_SHA"* ]]
case "$MODE" in
  api_error) exit 1;;
  missing) echo '{"workflow_runs":[]}'; exit 0;;
  wrong_sha) sha=$(printf '%040d' 2);;
  *) sha="$EXPECTED_SHA";;
esac
status=completed
conclusion="$MODE"
if [[ "$MODE" == wrong_sha ]]; then conclusion=success; fi
if [[ "$MODE" == pending ]]; then status=in_progress; conclusion=null; fi
printf '{"workflow_runs":[{"head_sha":"%s","head_branch":"dev","event":"push","created_at":"2026-01-01","status":"%s","conclusion":"%s"}]}\n' "$sha" "$status" "$conclusion"
MOCK
printf '#!/bin/bash\nexit 0\n' > "$tmp/sleep"
chmod +x "$tmp/gh" "$tmp/sleep"
for mode in success failure cancelled skipped api_error missing wrong_sha pending; do
  export MODE="$mode"
  if bash scripts/release/require-dev-ci.sh > "$tmp/output" 2>&1; then
    [[ "$mode" == success ]] || { echo "Unexpected success: $mode"; exit 1; }
  else
    [[ "$mode" != success ]] || { cat "$tmp/output"; exit 1; }
  fi
done
echo 'CI gate regressions passed'
