#!/usr/bin/env bash
# Run shellcheck and the unit/scenario tests in a throwaway Linux container.
set -euo pipefail
dir="$(cd "$(dirname "$0")/.." && pwd)"
docker run --rm -v "$dir:/src:ro" python:3.12-slim bash -c '
  set -euo pipefail
  apt-get update -qq >/dev/null && apt-get install -y -qq openssh-client shellcheck util-linux >/dev/null 2>&1
  pip install -q --root-user-action=ignore aiogram==3.28.2
  cp -r /src /tmp/uat && cd /tmp/uat
  shellcheck deploy-uat-dev.sh make-backup-attestation.sh tests/run-local.sh tests/integration.sh && echo shellcheck-ok
  python -B -m unittest discover -s tests -p "test_*.py"
'
