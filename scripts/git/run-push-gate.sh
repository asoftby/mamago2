#!/bin/sh
# Pre-push gate wrapper: runs `pnpm check:push` with the production build isolated in its own
# directory, so it never touches (or inherits the bloat of) the `.next` cache of a running `next dev`.
#
# Why: `next build` shares `.next` with `next dev`; a multi-GB dev cache plus a concurrent dev
# server made the build die with a silent out-of-memory abort (exit 134) and tempted people to
# delete `.next` under a live dev server (which breaks it).
#
#   NEXT_DIST_DIR=<dir>         build dir for the gate (default node_modules/.cache/next-gate)
#   NEXT_CACHE_MAX_GB=<n>       the gate dir is recreated when it grows above this (default 6)
#   SKIP_NEXT_CACHE_CHECK=1     skip the .next size warning
#
# Nothing under `.next` is ever deleted here.

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root" || exit 1

# Hard guard: node_modules must belong to this worktree and the Prisma Client must match
# this worktree's schema, otherwise typecheck/build results are meaningless.
if [ -f scripts/git/worktree-deps.sh ]; then
  sh scripts/git/worktree-deps.sh check || exit 1
fi

gate_dir="${NEXT_DIST_DIR:-node_modules/.cache/next-gate}"
max_gb="${NEXT_CACHE_MAX_GB:-6}"
max_kb=$((max_gb * 1024 * 1024))

dir_kb() { du -sk "$1" 2>/dev/null | awk '{print $1}'; }

# Is a `next dev` running from THIS worktree? Other task worktrees may legitimately run their own
# dev servers; only a server whose working directory is this checkout uses this `.next`.
dev_running_here() {
  for pid in $(pgrep -f "next dev" 2>/dev/null); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
    [ "$cwd" = "$root" ] && return 0
  done
  return 1
}

# The gate directory is ours: drop it when oversized so every build stays within the heap limit.
if [ -d "$gate_dir" ]; then
  gate_kb="$(dir_kb "$gate_dir")"
  if [ -n "$gate_kb" ] && [ "$gate_kb" -gt "$max_kb" ]; then
    echo "[pre-push] $gate_dir is larger than ${max_gb} GB — recreating it."
    rm -rf "$gate_dir"
  fi
fi

# Informational only: a huge dev cache is not a problem for the gate any more, but it slows dev.
if [ "${SKIP_NEXT_CACHE_CHECK:-}" != "1" ] && [ -d .next ]; then
  dev_kb="$(dir_kb .next)"
  if [ -n "$dev_kb" ] && [ "$dev_kb" -gt "$max_kb" ]; then
    dev_gb=$(awk -v kb="$dev_kb" 'BEGIN { printf "%.1f", kb / 1048576 }')
    echo "[pre-push] note: .next is ${dev_gb} GB. The gate builds in $gate_dir, so this push is unaffected."
    if dev_running_here; then
      echo "[pre-push] A 'next dev' is running in this worktree — do NOT delete .next under it; stop that dev server first."
    else
      echo "[pre-push] To reclaim space later: rm -rf .next"
    fi
  fi
fi

# Next rewrites these tracked files for a custom distDir; put them back afterwards.
backup="$(mktemp -d)"
for f in tsconfig.json next-env.d.ts; do
  [ -f "$f" ] && cp "$f" "$backup/$f"
done

NEXT_DIST_DIR="$gate_dir" pnpm check:push
status=$?

for f in tsconfig.json next-env.d.ts; do
  [ -f "$backup/$f" ] && cp "$backup/$f" "$f"
done
rm -rf "$backup"

exit "$status"
