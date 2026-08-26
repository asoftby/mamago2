#!/usr/bin/env sh
set -eu

sync_arg=""
if [ "${1:-}" = "--allow-overlap" ]; then
  sync_arg="--allow-overlap"
elif [ -n "${1:-}" ]; then
  echo "Usage: task-check.sh [--allow-overlap]" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "[task-check] STOP: not inside a Git repository." >&2
  exit 2
fi
cd "$repo_root"

branch="$(git branch --show-current)"
case "$branch" in
  ""|dev|main)
    echo "[task-check] STOP: run from a task branch, not '$branch'." >&2
    exit 2
    ;;
esac

if [ -n "$sync_arg" ]; then
  sh scripts/git/task-sync.sh "$sync_arg"
else
  sh scripts/git/task-sync.sh
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[task-check] STOP: tracked/staged changes remain." >&2
  git status --short
  exit 3
fi

if ! git merge-base --is-ancestor origin/dev HEAD; then
  echo "[task-check] STOP: task is not reconciled with current origin/dev." >&2
  exit 4
fi

ahead="$(git rev-list --count origin/dev..HEAD)"
if [ "$ahead" -eq 0 ]; then
  echo "[task-check] STOP: no task commits exist above origin/dev." >&2
  exit 5
fi

echo "[task-check] task commits ahead of origin/dev: $ahead"
echo "[task-check] task diff files:"
git diff --name-only origin/dev...HEAD | sed 's/^/  - /'

git diff --check origin/dev...HEAD

if ! command -v node >/dev/null 2>&1; then
  echo "[task-check] STOP: node is not installed." >&2
  exit 6
fi
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" != "22" ]; then
  echo "[task-check] STOP: Node 22.x is required; current: $(node -v)." >&2
  echo "[task-check] The mgtask/mgcheck shell shortcuts auto-switch when nvm/fnm is available." >&2
  exit 6
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[task-check] STOP: pnpm is not available." >&2
  exit 6
fi

if [ ! -d node_modules ]; then
  echo "[task-check] node_modules missing; installing from lockfile."
  pnpm install --frozen-lockfile
fi

echo "[task-check] Running pnpm check:push"
pnpm check:push

echo "[task-check] PASS: branch is current with origin/dev and full push checks passed."
