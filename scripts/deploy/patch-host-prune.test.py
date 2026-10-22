import hashlib
from pathlib import Path
import subprocess
import tempfile

tool = Path(__file__).with_name("patch-host-prune.py")
body = """#!/bin/bash
set -euo pipefail
echo "🧹 Запускаем очистку старых неиспользуемых Docker-образов в фоне..."
nohup sh -c 'docker image prune -a -f --filter "until=12h" && docker system df' >/tmp/docker-prune.log 2>&1 &
exit 0
"""
with tempfile.TemporaryDirectory() as temp:
    path = Path(temp) / "deploy.sh"
    path.write_text(body)
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    cmd = ["python3", str(tool), "--target", str(path), "--expected-sha256", sha]
    subprocess.run(cmd, check=True)
    assert path.read_text() == body
    bad = ["python3", str(tool), "--target", str(path), "--expected-sha256", "0"*64, "--apply"]
    assert subprocess.run(bad, capture_output=True).returncode != 0
    subprocess.run(cmd + ["--apply"], check=True)
    assert "docker image prune" not in path.read_text()
    assert path.with_name("deploy.sh.before-disable-prune-" + sha[:12]).read_text() == body
    assert subprocess.run(cmd + ["--apply"], capture_output=True).returncode != 0
print("PASS: dry run, SHA precondition, patch, backup, stale SHA refusal")
