#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

ROOT_DIR="/Users/shapovalovalexey/dev/mamago2"
cd "${ROOT_DIR}"

exec /opt/homebrew/bin/pnpm db:backup
