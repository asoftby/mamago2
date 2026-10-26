#!/bin/sh
# Runs a command with the environment the push gate needs, so nobody has to set flags by hand:
#   - NODE_OPTIONS gets --max-old-space-size=8192 (tsc/next build abort with exit 134 otherwise);
#     a heap size already present in NODE_OPTIONS is respected.
#   - DATABASE_URL points to a throwaway local Postgres (fresh initdb, `prisma migrate deploy`),
#     removed on exit. A DATABASE_URL from the caller's environment is deliberately NOT used, so the
#     gate can never run against a real database. Override with GATE_DATABASE_URL (e.g. in CI).
#
#   GATE_PG_BIN=<dir>     directory with initdb/pg_ctl (default: PATH, then Homebrew locations)
#
# Usage: sh scripts/git/gate-env.sh <command...>

[ "$#" -gt 0 ] || { echo "Usage: $0 <command...>" >&2; exit 2; }

case "${NODE_OPTIONS:-}" in
  *max-old-space-size*) ;;
  *) NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=8192"; export NODE_OPTIONS ;;
esac

if [ -n "${GATE_DATABASE_URL:-}" ]; then
  DATABASE_URL="$GATE_DATABASE_URL"; export DATABASE_URL
  exec "$@"
fi

find_pg_bin() {
  if [ -n "${GATE_PG_BIN:-}" ] && [ -x "$GATE_PG_BIN/initdb" ]; then echo "$GATE_PG_BIN"; return 0; fi
  if command -v initdb >/dev/null 2>&1; then dirname "$(command -v initdb)"; return 0; fi
  for d in /opt/homebrew/bin /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin \
           /usr/lib/postgresql/16/bin /usr/lib/postgresql/15/bin; do
    [ -x "$d/initdb" ] && { echo "$d"; return 0; }
  done
  return 1
}

pg_bin="$(find_pg_bin)" || {
  echo "[gate-env] STOP: no local Postgres binaries (initdb/pg_ctl) found; the gate needs a throwaway database." >&2
  echo "[gate-env] Install Postgres 16 or set GATE_PG_BIN / GATE_DATABASE_URL." >&2
  exit 2
}

work="$(mktemp -d /tmp/mg-gate.XXXXXX)"
data="$work/data"
sock="$work/sock"
mkdir -p "$sock"
started=0

cleanup() {
  if [ "$started" = 1 ]; then "$pg_bin/pg_ctl" -D "$data" -m immediate stop >/dev/null 2>&1; fi
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

port="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"

LC_ALL=en_US.UTF-8 "$pg_bin/initdb" -D "$data" -U postgres -A trust -E UTF8 >/dev/null || exit 1
LC_ALL=en_US.UTF-8 "$pg_bin/pg_ctl" -D "$data" -o "-p $port -k $sock -c listen_addresses=127.0.0.1 -c fsync=off" \
  -l "$work/pg.log" -w start >/dev/null || { cat "$work/pg.log" >&2; exit 1; }
started=1
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U postgres gate >/dev/null || exit 1

DATABASE_URL="postgresql://postgres@127.0.0.1:$port/gate"; export DATABASE_URL
echo "[gate-env] throwaway Postgres on port $port; applying migrations"
pnpm exec prisma migrate deploy >/dev/null || { echo "[gate-env] STOP: migrate deploy failed" >&2; exit 1; }

"$@"
