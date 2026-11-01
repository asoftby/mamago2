#!/usr/bin/env python3
"""Regression tests for the version-controlled Telegram host deploy DB guard."""
import hashlib
from pathlib import Path
import subprocess
import tempfile

TOOL = Path(__file__).with_name("patch-host-db-guard.py")

LEGACY = '''#!/bin/bash
set -euo pipefail
ENV="${1:-}"
VERSION="${2:-}"
DIR="/opt/mamago/$ENV"
cd "$DIR"
PREVIOUS_VERSION="$(grep "^APP_VERSION=" .env | cut -d "=" -f2- || true)"
echo "🗄️ Запускаем БД..."
docker compose up -d db
if APP_VERSION="$VERSION" docker compose run --rm migrate; then
  echo "migrations applied"
fi
APP_VERSION="$VERSION" docker compose run --rm app pnpm db:seed:system
APP_VERSION="$VERSION" docker compose up -d --force-recreate app worker prisma-studio
'''

def invoke(path, sha, *flags):
    return subprocess.run(
        ["python3", str(TOOL), "--target", str(path),
         "--expected-sha256", sha, *flags],
        capture_output=True, text=True,
    )

with tempfile.TemporaryDirectory() as temp:
    target = Path(temp) / "deploy.sh"
    target.write_text(LEGACY, encoding="utf-8")
    original_bytes = target.read_bytes()
    old_sha = hashlib.sha256(original_bytes).hexdigest()

    wrong = invoke(target, "0" * 64, "--apply")
    assert wrong.returncode != 0
    assert target.read_bytes() == original_bytes

    unsafe = invoke(target, old_sha, "--verify")
    assert unsafe.returncode != 0

    dry = invoke(target, old_sha)
    assert dry.returncode == 0, dry.stderr
    assert "DRY_RUN_PASS" in dry.stdout
    assert target.read_bytes() == original_bytes

    patch = invoke(target, old_sha, "--apply")
    assert patch.returncode == 0, patch.stderr
    assert "HOST_DB_GUARD_PATCHED" in patch.stdout
    expected_backup = target.with_name("deploy.sh.before-db-guard-" + old_sha[:12])
    assert expected_backup.read_bytes() == original_bytes

    patched = target.read_bytes()
    patched_sha = hashlib.sha256(patched).hexdigest()
    verify = invoke(target, patched_sha, "--verify")
    assert verify.returncode == 0, verify.stderr
    assert "HOST_DB_GUARD_VERIFIED" in verify.stdout
    assert "docker compose up -d db" not in target.read_text()
    assert patched.count(b"--no-deps") == 3

    again = invoke(target, patched_sha, "--apply")
    assert again.returncode != 0
    assert target.read_bytes() == patched

    broken_text = target.read_text().replace(
        "docker compose run --rm --no-deps migrate",
        "docker compose run --rm migrate",
    )
    target.write_text(broken_text)
    broken_sha = hashlib.sha256(target.read_bytes()).hexdigest()
    assert invoke(target, broken_sha, "--verify").returncode != 0

    # A guarded-looking file must not pass if the actual rejection path is missing.
    target.write_bytes(patched)
    complete = target.read_text()
    guard_start = complete.index('if [[ "$DB_CONFIG_BEFORE" != "$DB_CONFIG_AFTER" ]]; then')
    guard_end = complete.index("\\nfi", guard_start) + len("\\nfi")
    missing_config_rejection = complete[:guard_start] + complete[guard_end:]
    target.write_text(missing_config_rejection)
    missing_sha = hashlib.sha256(target.read_bytes()).hexdigest()
    assert invoke(target, missing_sha, "--verify").returncode != 0

    # Removing the health abort or the EXIT identity check must also fail.
    for fragment in (
        'if [[ "$DB_HEALTH" != healthy ]]; then',
        'trap \\'rc=$?; trap - EXIT; if ! check_db_identity; then exit 90; fi; exit "$rc"\\' EXIT',
    ):
        target.write_text(complete.replace(fragment, "# removed guard", 1))
        bad_sha = hashlib.sha256(target.read_bytes()).hexdigest()
        assert invoke(target, bad_sha, "--verify").returncode != 0

    target.write_text(LEGACY.replace("docker compose up -d db", "docker compose up -d db worker"))
    changed_sha = hashlib.sha256(target.read_bytes()).hexdigest()
    assert invoke(target, changed_sha, "--apply").returncode != 0

print("PASS: SHA pin, dry-run, atomic backup, apply, verify, partial-guard refusal")
