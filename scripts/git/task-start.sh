#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: task-start.sh <slug> [prefix]

Examples:
  sh scripts/git/task-start.sh stories-display-rules
  sh scripts/git/task-start.sh password-reset fix

prefix defaults to feat. Allowed: feat, fix, refactor, chore, docs, test.
USAGE
}

slug_input="${1:-}"
prefix="${2:-feat}"

if [ "$slug_input" = "-h" ] || [ "$slug_input" = "--help" ]; then
  usage
  exit 0
fi
if [ -z "$slug_input" ]; then
  usage >&2
  exit 2
fi

case "$prefix" in
  feat|fix|refactor|chore|docs|test) ;;
  *)
    echo "[task-start] STOP: unsupported prefix '$prefix'." >&2
    echo "[task-start] Allowed: feat fix refactor chore docs test" >&2
    exit 2
    ;;
esac

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "[task-start] STOP: not inside a Git repository." >&2
  exit 2
fi
cd "$repo_root"

if [ ! -f "scripts/git/session-start-gate.sh" ]; then
  echo "[task-start] STOP: scripts/git/session-start-gate.sh not found in $repo_root." >&2
  exit 2
fi

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "dev" ]; then
  echo "[task-start] STOP: run this from the canonical dev checkout." >&2
  echo "[task-start] Current branch: $current_branch" >&2
  exit 2
fi

run_gate() {
  sh scripts/git/session-start-gate.sh origin dev
}

if run_gate; then
  :
else
  gate_status=$?
  if [ "$gate_status" -eq 4 ]; then
    echo "[task-start] Local dev is stale; applying only the gate-approved fast-forward."
    git merge --ff-only origin/dev
    run_gate
  else
    exit "$gate_status"
  fi
fi

base_head="$(git rev-parse HEAD)"
slug="$(printf '%s' "$slug_input" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -e 's/[^a-z0-9._-]/-/g' -e 's/-\{2,\}/-/g' -e 's/^-//' -e 's/-$//')"

if [ -z "$slug" ]; then
  echo "[task-start] STOP: slug '$slug_input' becomes empty after normalization." >&2
  exit 2
fi

date_suffix="$(date +%Y%m%d)"
branch_base="$prefix/$slug-$date_suffix"
branch="$branch_base"
index=2
remote_branch_exists() {
  git ls-remote --exit-code --heads origin "$1" >/dev/null 2>&1
}
while git show-ref --verify --quiet "refs/heads/$branch" || remote_branch_exists "$branch"; do
  branch="$branch_base-$index"
  index=$((index + 1))
done

worktrees_root="${MAMAGO_WORKTREES_DIR:-$(dirname "$repo_root")/mamago2-worktrees}"
mkdir -p "$worktrees_root"
worktree_name="$(printf '%s' "$branch" | tr '/' '-')"
worktree_path="$worktrees_root/$worktree_name"
path_index=2
while [ -e "$worktree_path" ]; do
  worktree_path="$worktrees_root/$worktree_name-$path_index"
  path_index=$((path_index + 1))
done

printf '[task-start] BASE_HEAD=%s\n' "$base_head"
printf '[task-start] branch=%s\n' "$branch"
printf '[task-start] worktree=%s\n' "$worktree_path"

git worktree add -b "$branch" "$worktree_path" "$base_head"

created_head="$(git -C "$worktree_path" rev-parse HEAD)"
if [ "$created_head" != "$base_head" ]; then
  echo "[task-start] STOP: created worktree HEAD does not match BASE_HEAD." >&2
  echo "[task-start] expected=$base_head actual=$created_head" >&2
  exit 7
fi

task_git_dir="$(git -C "$worktree_path" rev-parse --absolute-git-dir)"
cat > "$task_git_dir/mamago-task.env" <<META
BASE_HEAD=$base_head
TASK_BRANCH=$branch
TASK_WORKTREE=$worktree_path
META

common_git_dir="$(git rev-parse --git-common-dir)"
case "$common_git_dir" in
  /*) ;;
  *) common_git_dir="$repo_root/$common_git_dir" ;;
esac
printf '%s\n' "$worktree_path" > "$common_git_dir/mamago-last-worktree"

cat <<READY

TASK READY
base:     $base_head
branch:   $branch
worktree: $worktree_path

Next: cd "$worktree_path"
READY
