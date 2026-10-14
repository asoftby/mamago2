#!/usr/bin/env sh
# Keeps a task worktree self-contained: its own node_modules and a Prisma Client
# generated from THIS worktree's prisma/*.prisma. A node_modules symlink into another
# checkout shares one generated client between all worktrees, so whichever schema was
# generated last silently decides which worktree typechecks.
#
#   worktree-deps.sh install   pnpm install --frozen-lockfile + prisma generate
#   worktree-deps.sh generate  prisma generate only
#   worktree-deps.sh ensure    install if node_modules is missing, regenerate if the client is stale
#   worktree-deps.sh check     guard only (no changes); non-zero + message when unsafe
#   worktree-deps.sh list-symlinks   report worktrees whose node_modules is a symlink (read-only)
set -eu

mode="${1:-}"
tag="[worktree-deps]"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "$tag STOP: not inside a Git repository." >&2
  exit 2
fi
cd "$repo_root"

resolve_dir() { (cd "$1" 2>/dev/null && pwd -P) || printf '%s' "$1"; }

node_modules_symlink_problem() {
  [ -L node_modules ] || return 1
  target="$(resolve_dir node_modules)"
  here="$(pwd -P)"
  case "$target" in
    "$here"/*) return 1 ;;
  esac
  printf '%s' "$target"
  return 0
}

print_symlink_fix() {
  echo "$tag STOP: node_modules is a symlink to '$1' (outside this worktree)." >&2
  echo "$tag A shared node_modules shares one generated Prisma Client between worktrees." >&2
  echo "$tag Fix (removes only the symlink, not its target):" >&2
  echo "  rm node_modules && sh scripts/git/worktree-deps.sh install" >&2
}

client_file() {
  [ -d node_modules/@prisma/client ] || return 1
  node -e "
    try {
      const c = require.resolve('@prisma/client', { paths: [process.cwd()] });
      process.stdout.write(require.resolve('.prisma/client/index.js', { paths: [c] }));
    } catch { process.exit(1); }
  " 2>/dev/null
}

generate() {
  echo "$tag Generating Prisma Client from $repo_root/prisma"
  pnpm exec prisma generate
}

install() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "$tag STOP: pnpm is not available." >&2
    exit 6
  fi
  if bad="$(node_modules_symlink_problem)"; then
    print_symlink_fix "$bad"
    exit 10
  fi
  echo "$tag pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
  # postinstall already runs prisma generate; repeat explicitly so a skipped lifecycle
  # script can never leave a missing/stale client.
  generate
}

# Returns 0 when the generated client is missing or older than any prisma/*.prisma file.
client_stale() {
  cf="$(client_file)" || return 0
  [ -n "$(find prisma -maxdepth 1 -name '*.prisma' -newer "$cf" 2>/dev/null | head -1)" ]
}

check() {
  if bad="$(node_modules_symlink_problem)"; then
    print_symlink_fix "$bad"
    exit 10
  fi
  if [ ! -d node_modules ]; then
    echo "$tag STOP: node_modules is missing. Run: sh scripts/git/worktree-deps.sh install" >&2
    exit 11
  fi
  if client_stale; then
    echo "$tag STOP: generated Prisma Client is missing or older than prisma/*.prisma." >&2
    echo "$tag Run: sh scripts/git/worktree-deps.sh generate" >&2
    exit 12
  fi
  echo "$tag OK: own node_modules, Prisma Client is current with prisma/*.prisma."
}

case "$mode" in
  install) install ;;
  generate)
    if bad="$(node_modules_symlink_problem)"; then print_symlink_fix "$bad"; exit 10; fi
    generate
    ;;
  ensure)
    if bad="$(node_modules_symlink_problem)"; then print_symlink_fix "$bad"; exit 10; fi
    if [ ! -d node_modules ]; then
      install
    elif client_stale; then
      generate
    fi
    check
    ;;
  check) check ;;
  list-symlinks)
    git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r wt; do
      if [ -L "$wt/node_modules" ]; then
        printf '%s -> %s\n' "$wt" "$(readlink "$wt/node_modules")"
      fi
    done
    ;;
  *)
    echo "Usage: worktree-deps.sh install|generate|ensure|check|list-symlinks" >&2
    exit 2
    ;;
esac
