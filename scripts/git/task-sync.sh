#!/usr/bin/env sh
set -eu

allow_overlap=0
if [ "${1:-}" = "--allow-overlap" ]; then
  allow_overlap=1
elif [ -n "${1:-}" ]; then
  echo "Usage: task-sync.sh [--allow-overlap]" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "[task-sync] STOP: not inside a Git repository." >&2
  exit 2
fi
cd "$repo_root"

branch="$(git branch --show-current)"
case "$branch" in
  ""|dev|main)
    echo "[task-sync] STOP: '$branch' is not a task branch." >&2
    exit 2
    ;;
esac

if [ -n "$(git status --porcelain)" ]; then
  echo "[task-sync] STOP: task worktree is not clean; commit or preserve all tracked/staged/untracked work before syncing." >&2
  git status --short
  exit 3
fi

if ! git fetch --quiet origin dev; then
  echo "[task-sync] STOP: cannot fetch origin/dev; freshness cannot be proven." >&2
  exit 4
fi

if git merge-base --is-ancestor origin/dev HEAD; then
  echo "[task-sync] PASS: task branch already contains current origin/dev ($(git rev-parse --short=12 origin/dev))."
  exit 0
fi

merge_base="$(git merge-base HEAD origin/dev)"
if [ -z "$merge_base" ]; then
  echo "[task-sync] STOP: no merge base with origin/dev." >&2
  exit 5
fi

task_files="$(mktemp -t mamago-task-files.XXXXXX)"
dev_files="$(mktemp -t mamago-dev-files.XXXXXX)"
overlap_files="$(mktemp -t mamago-overlap-files.XXXXXX)"
trap 'rm -f "$task_files" "$dev_files" "$overlap_files"' EXIT HUP INT TERM

git diff --name-only "$merge_base"..HEAD | sort -u > "$task_files"
git diff --name-only "$merge_base"..origin/dev | sort -u > "$dev_files"
comm -12 "$task_files" "$dev_files" > "$overlap_files"

if [ -s "$overlap_files" ] && [ "$allow_overlap" -ne 1 ]; then
  echo "[task-sync] STOP: origin/dev advanced and touches file(s) also changed by this task:" >&2
  sed 's/^/  - /' "$overlap_files" >&2
  echo "[task-sync] Review these overlaps deliberately, then rerun:" >&2
  echo "  sh scripts/git/task-sync.sh --allow-overlap" >&2
  exit 6
fi

if [ -s "$overlap_files" ]; then
  echo "[task-sync] WARN: overlap explicitly allowed after review:"
  sed 's/^/  - /' "$overlap_files"
else
  echo "[task-sync] No overlapping files with new origin/dev commits."
fi

old_head="$(git rev-parse HEAD)"
old_dev="$(git rev-parse origin/dev)"
echo "[task-sync] Merging origin/dev=$old_dev into task HEAD=$old_head"

if ! git merge --no-edit origin/dev; then
  echo "[task-sync] STOP: merge needs manual conflict resolution." >&2
  echo "[task-sync] Do not reset or overwrite files; resolve only the reported conflicts." >&2
  exit 7
fi

if ! git merge-base --is-ancestor origin/dev HEAD; then
  echo "[task-sync] STOP: post-merge verification failed; origin/dev is not an ancestor of HEAD." >&2
  exit 8
fi

echo "[task-sync] PASS: task now contains current origin/dev ($(git rev-parse --short=12 origin/dev))."
