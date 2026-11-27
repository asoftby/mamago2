#!/usr/bin/env bash
# Lint and run all unit and scenario tests in a throwaway Linux container.
set -euo pipefail
dir="$(cd "$(dirname "$0")/.." && pwd)"
docker run --rm -v "$dir:/src:ro" python:3.12-slim bash -c '
  set -euo pipefail
  apt-get update -qq >/dev/null && apt-get install -y -qq openssh-client shellcheck util-linux >/dev/null 2>&1
  pip install -q --root-user-action=ignore -r /src/requirements.txt
  cp -r /src /tmp/deploybot && cd /tmp/deploybot
  shellcheck gate deploy-uat-dev.sh make-backup-attestation.sh tests/*.sh && echo shellcheck-ok
  cd tests && python -B -m unittest discover -s . -p "test_*.py" '"$*"'
'
