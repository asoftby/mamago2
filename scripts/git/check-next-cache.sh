#!/bin/sh
# Pre-push: warn early when the Next.js build cache (.next) is so large that `next build`
# (heap capped at 6 GB in package.json) will likely die with a silent out-of-memory abort.
#
#   NEXT_CACHE_MAX_GB=<n>       threshold in GB (default 6)
#   SKIP_NEXT_CACHE_CHECK=1     skip the check
#
# The script never deletes anything: removing .next under a running `next dev` breaks it.

[ "${SKIP_NEXT_CACHE_CHECK:-}" = "1" ] && exit 0

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cache="$root/.next"
[ -d "$cache" ] || exit 0

max_gb="${NEXT_CACHE_MAX_GB:-6}"
size_kb="$(du -sk "$cache" 2>/dev/null | awk '{print $1}')"
[ -n "$size_kb" ] || exit 0

max_kb=$((max_gb * 1024 * 1024))
[ "$size_kb" -le "$max_kb" ] && exit 0

size_gb=$(awk -v kb="$size_kb" 'BEGIN { printf "%.1f", kb / 1048576 }')

echo "Push blocked: .next is ${size_gb} GB (limit ${max_gb} GB)."
echo "A cache this large makes 'next build' run out of memory and abort with no clear error (exit code 134)."

if pgrep -f "next dev" >/dev/null 2>&1; then
  echo ""
  echo "A 'next dev' process is running. Do NOT delete .next under it."
  echo "Stop the dev server first, then run:  rm -rf .next"
else
  echo ""
  echo "Clear the cache and push again:  rm -rf .next"
fi

echo "To skip this check once:  SKIP_NEXT_CACHE_CHECK=1 git push"
exit 1
