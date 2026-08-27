#!/usr/bin/env sh
set -eu

sync_arg=""
if [ "${1:-}" = "--allow-overlap" ]; then
  sync_arg="--allow-overlap"
elif [ -n "${1:-}" ]; then
  echo "Usage: task-finish.sh [--allow-overlap]" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "[task-finish] STOP: not inside a Git repository." >&2
  exit 2
fi
cd "$repo_root"

branch="$(git branch --show-current)"
case "$branch" in
  ""|dev|main)
    echo "[task-finish] STOP: run from a task branch, not '$branch'." >&2
    exit 2
    ;;
esac

if [ -n "$sync_arg" ]; then
  sh scripts/git/task-sync.sh "$sync_arg"
else
  sh scripts/git/task-sync.sh
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "[task-finish] STOP: task worktree is not clean; commit or preserve tracked/staged/untracked work first." >&2
  git status --short
  exit 3
fi

git diff --check origin/dev...HEAD

ahead="$(git rev-list --count origin/dev..HEAD)"
if [ "$ahead" -eq 0 ]; then
  echo "[task-finish] STOP: nothing to push; branch has no commits above origin/dev." >&2
  exit 4
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[task-finish] STOP: Node 22.x is required but node is not installed." >&2
  exit 5
fi
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" != "22" ]; then
  echo "[task-finish] STOP: Node 22.x is required; current: $(node -v)." >&2
  echo "[task-finish] The mgfinish shell shortcut auto-switches when nvm/fnm is available." >&2
  exit 5
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[task-finish] STOP: pnpm is not available." >&2
  exit 5
fi

echo "[task-finish] Final task-only diff against origin/dev:"
git diff --name-only origin/dev...HEAD | sed 's/^/  - /'

echo "[task-finish] Pushing $branch. The repository pre-push hook will run pnpm check:push."
git push -u origin "$branch"

if command -v gh >/dev/null 2>&1; then
  existing_url="$(gh pr list --head "$branch" --base dev --state open --json url --jq '.[0].url // empty' 2>/dev/null || true)"
  if [ -n "$existing_url" ]; then
    echo "[task-finish] PR already open: $existing_url"
  else
    echo "[task-finish] Opening PR -> dev with GitHub CLI."
    gh pr create --base dev --head "$branch" --fill
  fi
else
  remote_url="$(git remote get-url origin)"
  echo "[task-finish] Push complete. GitHub CLI is not installed, so PR creation was skipped."
  echo "[task-finish] Remote: $remote_url"
  echo "[task-finish] Open a PR from '$branch' into 'dev'."
fi
