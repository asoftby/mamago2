#!/usr/bin/env bash
set -euo pipefail
for attempt in $(seq 1 60); do
  runs="$(gh api --method GET "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs" -f head_sha="$EXPECTED_SHA" -f branch=dev -f event=push -f per_page=100)"
  state="$(jq -r --arg sha "$EXPECTED_SHA" '[.workflow_runs[] | select(.head_sha == $sha and .head_branch == "dev" and .event == "push")] | sort_by(.created_at) | last | if . == null then "missing" elif .status != "completed" then "pending" else .conclusion end' <<< "$runs")"
  case "$state" in
    success) exit 0 ;;
    missing|pending) sleep 15 ;;
    *) echo "::error::CI did not succeed: $state"; exit 1 ;;
  esac
done
echo "::error::Timed out waiting for exact SHA CI"
exit 1
