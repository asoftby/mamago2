"""Several fake hosts reached through the real gate, with injectable network faults."""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

from hostfixture import ROOT, Host
from mamago_deploy.config import Registry
from mamago_deploy.control import Audit, Orchestrator
from mamago_deploy.transport import Transport, TransportError, command_for

GATE = "import sys; from mamago_deploy import gate; sys.exit(gate.main(sys.argv[2:], sys.argv[1]))"


class Network(Transport):
    def __init__(self, root: Path):
        self.root = root
        self.hosts = {}
        self.down = set()
        self.drop_submit_before = False
        self.drop_submit_after = False
        self.flaky_results = 0
        self.sent = []

    def add(self, host_id, environments):
        self.hosts[host_id] = Host(self.root / host_id, host_id=host_id, environments=environments)
        return self.hosts[host_id]

    async def call(self, host, env, words, timeout=0):
        argv = command_for(host, env, words)
        host_id = host["gate"].split("/")[2]
        self.sent.append((host_id, env, words[0]))
        if host_id in self.down:
            raise TransportError("host unreachable (VPN down)")
        submit = words[0].startswith("submit-")
        if submit and self.drop_submit_before:
            raise TransportError("connection lost before delivery")
        if words[0] == "result" and self.flaky_results:
            self.flaky_results -= 1
            raise TransportError("connection reset")
        target = self.hosts[host_id]
        done = await asyncio.to_thread(
            subprocess.run, [sys.executable, "-B", "-c", GATE, str(target.config_path), *argv[1:]],
            cwd=str(ROOT), env=target.env_vars(), capture_output=True, text=True, timeout=60)
        if submit and self.drop_submit_after:
            raise TransportError("connection lost after delivery")
        return json.loads(done.stdout.splitlines()[-1])

    def count(self, verb):
        return sum(1 for _, _, sent in self.sent if sent == verb)


def write_registry(path: Path, mapping: dict, hosts=("legacy", "hoster")):
    path.write_text(json.dumps({
        "hosts": {h: {"type": "local", "gate": f"/hosts/{h}/gate"} for h in hosts},
        "environments": {
            "dev": {"host": mapping["dev"], "operations": ["status", "logs", "deploy", "rollback"], "strict": False, "latest_tag_prefix": "dev"},
            "prod": {"host": mapping["prod"], "operations": ["status", "logs", "deploy", "rollback"], "strict": True}},
        "uat": {"environment": "dev", "release": "rc3-uat"}}))
    path.chmod(0o600)


def orchestrator(root: Path, network: Network, mapping=None, **options):
    registry = root / "registry.json"
    write_registry(registry, mapping or {"dev": "legacy", "prod": "legacy"})
    options.setdefault("poll_seconds", 0.05)
    options.setdefault("deadline_seconds", 20)
    return Orchestrator(lambda: Registry.load(registry), network, Audit(root / "audit.jsonl"), **options), registry
