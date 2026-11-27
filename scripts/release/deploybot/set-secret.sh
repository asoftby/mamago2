#!/usr/bin/env bash
# Type a secret straight into the root-only file systemd hands to the bot.
# Never as an argument, in history or in a log. Run as root on the host.
set -euo pipefail
umask 077
case "${1:-}" in bot_token|ghcr_token) ;; *) echo "usage: $0 bot_token|ghcr_token" >&2; exit 2 ;; esac
directory="${SECRETS_DIR:-/etc/mamago-deploy/secrets}"
install -d -m 700 "$directory"
IFS= read -rsp "$1: " value
echo >&2
[[ -n "$value" && "$value" != *[[:space:]]* ]] || { echo "ABORT: empty value or it contains spaces; the old file is unchanged" >&2; exit 1; }
temporary="$(mktemp "$directory/.new.XXXXXX")"
printf %s "$value" > "$temporary"
mv "$temporary" "$directory/$1"
echo "stored $1" >&2
