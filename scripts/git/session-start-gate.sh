#!/usr/bin/env sh
set -eu

remote="${1:-origin}"
branch="${2:-dev}"
current_branch="$(git branch --show-current)"

if [ "$current_branch" != "$branch" ]; then
  echo "[git-sync] STOP: current branch is '$current_branch', expected '$branch'."
  echo "[git-sync] Switch intentionally before starting repository work."
  exit 2
fi

if ! git remote get-url "$remote" >/dev/null 2>&1; then
  echo "[git-sync] STOP: remote '$remote' is not configured."
  exit 2
fi

# Refresh the remote-tracking ref before making any freshness decision.
# This changes only refs/remotes/*; it never touches working-tree files.
if ! git fetch --quiet "$remote" "$branch"; then
  echo "[git-sync] STOP: could not fetch $remote/$branch."
  echo "[git-sync] Freshness cannot be proven, so repository work must not start."
  exit 2
fi

remote_ref="$remote/$branch"
if ! git rev-parse --verify "$remote_ref" >/dev/null 2>&1; then
  echo "[git-sync] STOP: $remote_ref does not exist after fetch."
  exit 2
fi

# Tracked/staged changes are a hard stop. We must never sync over active WIP.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[git-sync] STOP: tracked or staged local changes already exist."
  git status --short
  echo "[git-sync] Preserve/finish that work first. Do NOT reset, checkout, or pull over it."
  exit 3
fi

# Untracked files do not make the commit graph stale, but surface them so an
# agent cannot silently treat them as disposable foreign work.
untracked="$(git ls-files --others --exclude-standard | head -n 20 || true)"
if [ -n "$untracked" ]; then
  echo "[git-sync] WARN: untracked files exist (showing up to 20):"
  printf '%s\n' "$untracked"
fi

# For HEAD...origin/dev: left=count local-only (ahead), right=remote-only (behind).
set -- $(git rev-list --left-right --count "HEAD...$remote_ref")
ahead="$1"
behind="$2"

local_sha="$(git rev-parse --short=12 HEAD)"
remote_sha="$(git rev-parse --short=12 "$remote_ref")"
echo "[git-sync] local=$local_sha remote=$remote_sha ahead=$ahead behind=$behind"

if [ "$ahead" -eq 0 ] && [ "$behind" -eq 0 ]; then
  echo "[git-sync] PASS: local HEAD exactly matches $remote_ref."
  exit 0
fi

if [ "$ahead" -eq 0 ] && [ "$behind" -gt 0 ]; then
  echo "[git-sync] STOP: local is stale by $behind commit(s)."
  echo "[git-sync] With a clean tree, safe update is: git merge --ff-only $remote_ref"
  echo "[git-sync] Run the gate again afterwards."
  exit 4
fi

if [ "$ahead" -gt 0 ] && [ "$behind" -eq 0 ]; then
  echo "[git-sync] STOP: local has $ahead unpushed commit(s)."
  echo "[git-sync] Review/push them before starting another task; do not build new work on an unshared base."
  exit 5
fi

echo "[git-sync] STOP: local and $remote_ref have diverged (ahead=$ahead, behind=$behind)."
echo "[git-sync] No automatic reset/rebase/pull is allowed. Inspect first:"
echo "  git log --oneline --decorate --graph --left-right HEAD...$remote_ref"
exit 6
