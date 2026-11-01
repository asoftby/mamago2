#!/usr/bin/env python3
"""Opt-in, SHA-guarded patch/verification for the host-managed Telegram deploy.sh.

Tracks the exact safety change tested on the mamaGo DEV host on 2026-10-31.
No deployment or Docker command is executed by this patcher.
"""
import argparse
import hashlib
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile

MARKER = "# Guard shared DEV/PROD deployment against database recreation."
ANCHOR = 'PREVIOUS_VERSION="$(grep "^APP_VERSION=" .env | cut -d "=" -f2- || true)"'
GUARD = r'''
# Guard shared DEV/PROD deployment against database recreation.
if [[ ! "$VERSION" =~ ^${ENV}-[0-9]+$ ]]; then
  echo "ABORT: environment/version mismatch" >&2
  exit 1
fi

DB_CONTAINER="${ENV}-db-1"
DB_ID_BEFORE="$(docker inspect --type container --format '{{.Id}}' "$DB_CONTAINER")"
DB_STARTED_BEFORE="$(docker inspect --type container --format '{{.State.StartedAt}}' "$DB_CONTAINER")"
DB_HEALTH="$(docker inspect --type container --format '{{.State.Health.Status}}' "$DB_CONTAINER")"

if [[ "$DB_HEALTH" != healthy ]]; then
  echo "ABORT: database not healthy" >&2
  exit 1
fi

docker compose config --quiet

db_config() {
  python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["services"]["db"],sort_keys=True))'
}

DB_CONFIG_BEFORE="$(docker compose config --format json | db_config)"
DB_CONFIG_AFTER="$(APP_VERSION="$VERSION" docker compose config --format json | db_config)"

if [[ "$DB_CONFIG_BEFORE" != "$DB_CONFIG_AFTER" ]]; then
  echo "ABORT: target version changes database configuration" >&2
  exit 1
fi

check_db_identity() {
  local id started
  id="$(docker inspect --type container --format '{{.Id}}' "$DB_CONTAINER")" || return 1
  started="$(docker inspect --type container --format '{{.State.StartedAt}}' "$DB_CONTAINER")" || return 1
  if [[ "$id" != "$DB_ID_BEFORE" || "$started" != "$DB_STARTED_BEFORE" ]]; then
    echo "CRITICAL: database container changed" >&2
    return 1
  fi
  return 0
}

trap 'rc=$?; trap - EXIT; if ! check_db_identity; then exit 90; fi; exit "$rc"' EXIT
echo "DB_PREFLIGHT_OK: existing database healthy, configuration unchanged"
'''
REPLACEMENTS = (
    ('echo "🗄️ Запускаем БД..."',
     'echo "🗄️ Проверяем существующую БД без пересоздания..."'),
    ("docker compose up -d db", "check_db_identity"),
    ('APP_VERSION="$VERSION" docker compose run --rm migrate',
     'APP_VERSION="$VERSION" docker compose run --rm --no-deps migrate'),
    ('APP_VERSION="$VERSION" docker compose run --rm app pnpm db:seed:system',
     'APP_VERSION="$VERSION" docker compose run --rm --no-deps app pnpm db:seed:system'),
    ('APP_VERSION="$VERSION" docker compose up -d --force-recreate app worker prisma-studio',
     'APP_VERSION="$VERSION" docker compose up -d --no-deps --force-recreate app worker prisma-studio'),
)
REQUIRED = (
    MARKER,
    'DB_ID_BEFORE="$(docker inspect',
    'DB_STARTED_BEFORE="$(docker inspect',
    'DB_CONFIG_BEFORE="$(docker compose config --format json | db_config)"',
    'DB_CONFIG_AFTER="$(APP_VERSION="$VERSION" docker compose config --format json | db_config)"',
    'trap \'rc=$?; trap - EXIT; if ! check_db_identity; then exit 90; fi; exit "$rc"\' EXIT',
    'echo "DB_PREFLIGHT_OK: existing database healthy, configuration unchanged"',
    'APP_VERSION="$VERSION" docker compose run --rm --no-deps migrate',
    'APP_VERSION="$VERSION" docker compose run --rm --no-deps app pnpm db:seed:system',
    'APP_VERSION="$VERSION" docker compose up -d --no-deps --force-recreate app worker prisma-studio',
)


def check_syntax(source: str) -> None:
    with tempfile.TemporaryDirectory(prefix="mamago-host-db-guard-check-") as directory:
        path = Path(directory) / "deploy.sh"
        path.write_text(source, encoding="utf-8")
        result = subprocess.run(["bash", "-n", str(path)], capture_output=True, text=True)
        if result.returncode:
            raise ValueError("bash -n failed: " + result.stderr.strip())


def verify_safe(source: str) -> None:
    # Reject removal or alteration of any critical guard condition or failure path.
    if source.count(GUARD.strip()) != 1:
        raise ValueError('Complete database guard block missing or modified')
    for item in REQUIRED:
        if source.count(item) != 1:
            raise ValueError("Safety contract missing/duplicated: " + item[:85])
    if "docker compose up -d db" in source:
        raise ValueError("Unsafe DB compose up remains")
    for original, replacement in REPLACEMENTS[2:]:
        if original in source or source.count(replacement) != 1:
            raise ValueError("Unprotected or duplicated Compose call: " + original)
    for line in source.splitlines():
        if re.search(r"\bdocker compose\b", line) and re.search(r"\b(?:run|up)\b", line):
            if "--no-deps" not in line:
                raise ValueError("Unprotected Compose run/up: " + line.strip()[:100])
    check_syntax(source)


def harden_legacy(source: str) -> str:
    if MARKER in source:
        raise ValueError("Host guard already present; use --verify")
    if source.count(ANCHOR) != 1:
        raise ValueError("Unexpected deploy.sh version: missing/duplicated anchor")
    updated = source.replace(ANCHOR, GUARD + "\n" + ANCHOR, 1)
    for original, replacement in REPLACEMENTS:
        if original == "docker compose up -d db":
            pattern = r"(?m)^(?P<indent>[ \\t]*)docker compose up -d db[ \\t]*$"
            matches = list(re.finditer(pattern, updated))
            if len(matches) != 1:
                raise ValueError("Unexpected DB start command: expected exactly one standalone line")
            updated = re.sub(pattern, lambda match: match.group("indent") + replacement, updated, count=1)
            continue
        if updated.count(original) != 1:
            raise ValueError("Unexpected deploy.sh version: " + original[:100])
        updated = updated.replace(original, replacement, 1)
    verify_safe(updated)
    return updated


def run(target: Path, expected_sha256: str, apply: bool, verify: bool) -> None:
    if target.is_symlink() or not target.is_file():
        raise ValueError("Target must be a regular non-symlink file")
    original = target.read_bytes()
    actual = hashlib.sha256(original).hexdigest()
    if actual != expected_sha256.lower():
        raise ValueError("SHA mismatch; STOP. Actual: " + actual)
    source = original.decode("utf-8")
    if verify:
        verify_safe(source)
        print("HOST_DB_GUARD_VERIFIED")
        return
    hardened = harden_legacy(source).encode("utf-8")
    if not apply:
        print("DRY_RUN_PASS: SHA, patterns, syntax; no changes")
        return
    backup = target.with_name(target.name + ".before-db-guard-" + actual[:12])
    if backup.exists():
        raise ValueError("Backup already exists; STOP")
    st = target.stat()
    shutil.copy2(target, backup)
    descriptor, filename = tempfile.mkstemp(prefix=".deploy-db-guard-", dir=target.parent)
    stage = Path(filename)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(hardened)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(stage, stat.S_IMODE(st.st_mode))
        os.chown(stage, st.st_uid, st.st_gid)
        os.replace(stage, target)
    finally:
        if stage.exists():
            stage.unlink()
    print("HOST_DB_GUARD_PATCHED; backup=" + str(backup))
    print("No Docker containers restarted")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--expected-sha256", required=True)
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument("--apply", action="store_true")
    actions.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-fA-F]{64}", args.expected_sha256):
        parser.error("--expected-sha256 must be 64 hex digits")
    try:
        run(args.target, args.expected_sha256, args.apply, args.verify)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        parser.exit(1, "ABORT: " + str(exc) + "\n")
