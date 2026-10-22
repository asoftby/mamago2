#!/usr/bin/env python3
"""Opt-in, SHA-guarded modification of the out-of-repo deploy script."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

OLD = ('echo "🧹 Запускаем очистку старых неиспользуемых Docker-образов в фоне..."\n'
       "nohup sh -c 'docker image prune -a -f --filter \"until=12h\" && docker system df' >/tmp/docker-prune.log 2>&1 &")
NEW = ('echo "ℹ️ Автоматическая глобальная очистка Docker-образов отключена."\n'
       'echo "ℹ️ Очистка общего DEV/PROD хоста требует отдельной проверенной операции."')

def patch(target, expected_sha, do_apply):
    if not target.is_file() or target.is_symlink():
        raise ValueError("Target must be a regular non-symlink file")
    original = target.read_bytes()
    digest = hashlib.sha256(original).hexdigest()
    if digest != expected_sha.lower():
        raise ValueError(f"SHA changed (found {digest}). STOP.")
    text = original.decode("utf-8")
    if text.count(OLD) != 1:
        raise ValueError("Expected unsafe block missing or repeated. STOP.")
    new = text.replace(OLD, NEW, 1).encode("utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        sample = Path(tmp) / "deploy.sh"
        sample.write_bytes(new)
        subprocess.run(["bash", "-n", str(sample)], check=True)
    if not do_apply:
        print("DRY_RUN_PASS: hash verified, unique match, valid bash; no writes")
        return
    backup = target.with_name(target.name + ".before-disable-prune-" + digest[:12])
    if backup.exists():
        raise ValueError("Backup already exists; STOP.")
    shutil.copy2(target, backup)
    fd, name = tempfile.mkstemp(prefix=".deploy-prune-", dir=target.parent)
    staged = Path(name)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(new)
            f.flush()
            os.fsync(f.fileno())
        shutil.copymode(target, staged)
        subprocess.run(["bash", "-n", str(staged)], check=True)
        os.replace(staged, target)
    finally:
        if staged.exists():
            staged.unlink()
    print("PATCHED with backup: " + str(backup))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--target", type=Path, required=True)
    p.add_argument("--expected-sha256", required=True)
    p.add_argument("--apply", action="store_true")
    a = p.parse_args()
    if len(a.expected_sha256) != 64:
        p.error("SHA-256 must be 64 hex characters")
    patch(a.target, a.expected_sha256, a.apply)
