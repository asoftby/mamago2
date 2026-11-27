"""Drives the real control plane over real SSH. Run only by integration.sh."""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from mamago_deploy.config import Registry  # noqa: E402
from mamago_deploy.control import Audit, Orchestrator, Pending  # noqa: E402
from mamago_deploy.transport import Transport, TransportError, command_for  # noqa: E402

root, keys, user, pending_migration = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], sys.argv[4]


def sh(*argv):
    return subprocess.run(argv, capture_output=True, text=True, check=True).stdout.strip()


def identity():
    return sh("docker", "inspect", "--format", "{{.Id}} {{.State.StartedAt}}", "dev-db-1", "prod-app-1")


def app_ref():
    return sh("docker", "inspect", "--format", "{{.Config.Image}}", "dev-app-1")


def reset_migration():
    sh("docker", "exec", "dev-db-1", "psql", "-q", "-U", "dev", "-d", "dev", "-c",
       f"delete from \"_prisma_migrations\" where migration_name='{pending_migration}'")


HOST = {"type": "ssh", "address": "127.0.0.1", "port": 2222, "user": user,
        "identity_files": {"dev": str(keys / "dev"), "prod": str(keys / "prod")}, "known_hosts": str(keys / "known_hosts")}
registry = root / "registry.json"
registry.write_text(json.dumps({"hosts": {"ci-host": HOST}, "environments": {
    "dev": {"host": "ci-host", "operations": ["status", "logs", "deploy", "rollback"], "strict": False}}}))
registry.chmod(0o600)


class CutAfterSubmit(Transport):
    """Kills the real SSH client right after the host accepted: a dropped VPN."""

    async def call(self, host, env, words, timeout=120):
        if not words[0].startswith("submit-"):
            return await super().call(host, env, words, timeout)
        process = await asyncio.create_subprocess_exec(*command_for(host, env, words), stdout=asyncio.subprocess.PIPE)
        await process.stdout.readline()
        if process.returncode is None:
            process.kill()
        await process.wait()
        raise TransportError("connection cut by the test")


async def main():
    transport = Transport()
    control = Orchestrator(lambda: Registry.load(registry), transport, Audit(root / "audit.jsonl"), poll_seconds=1, deadline_seconds=180)

    async def pending(action, ref):
        words = ["preflight", ref] if action == "deploy" else ["rollback-preflight"]
        answer = await control.ask("dev", action, words)
        assert answer["ok"], answer["report"]
        return Pending(action, "dev", "ci-host", ref, answer["fingerprint"], 42, 42, 10**12, "dev")

    print("=== gate over SSH: forced command only")
    for request in ("id", "status prod", "bash -c id", "preflight rel:good;id"):
        done = subprocess.run(command_for(HOST, "dev", ["status"])[:-1] + [request], capture_output=True, text=True, timeout=60)
        assert done.returncode != 0 and "refused" in done.stdout, (request, done.stdout)
        assert "uid=" not in done.stdout
    print("=== broken host key and wrong identity")
    bad_hosts = keys / "bad_known_hosts"
    other = keys / "other"
    sh("ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(other))
    bad_hosts.write_text("[127.0.0.1]:2222 " + " ".join((keys / "other.pub").read_text().split()[:2]) + "\n")
    for host, needle in (({**HOST, "known_hosts": str(bad_hosts)}, "host key"),
                         ({**HOST, "identity_files": {"dev": str(other)}}, "authentication failed")):
        try:
            await transport.call(host, "dev", ["status"])
            raise AssertionError("must not connect")
        except TransportError as error:
            assert needle in str(error), error

    before = identity()
    print("=== deploy with the connection cut after acceptance")
    cut = Orchestrator(lambda: Registry.load(registry), CutAfterSubmit(), control.audit, poll_seconds=1, deadline_seconds=180)
    request = await pending("deploy", "rel:good")
    outcome = await cut.execute(request)
    print("\n".join(outcome.report))
    assert outcome.state == "succeeded", outcome.state
    assert "@sha256:" in app_ref() and identity() == before

    print("=== replayed confirmation")
    again = await control.execute(request)
    assert again.state == "failed", again.state

    print("=== rollback")
    outcome = await control.execute(await pending("rollback", "previous"))
    print("\n".join(outcome.report))
    assert outcome.state == "succeeded" and app_ref().endswith(":dev-1") and identity() == before

    print("=== migration failure leaves the application untouched")
    reset_migration()
    outcome = await control.execute(await pending("deploy", "rel:badmigration"))
    assert outcome.state == "failed" and "NOT switched" in "\n".join(outcome.report), outcome.report
    assert app_ref().endswith(":dev-1") and identity() == before

    print("=== unhealthy release, then rollback")
    outcome = await control.execute(await pending("deploy", "rel:unhealthy"))
    assert outcome.state == "failed", outcome.report
    outcome = await control.execute(await pending("rollback", "previous"))
    assert outcome.state == "succeeded" and app_ref().endswith(":dev-1") and identity() == before, outcome.report

    assert control.audit.verify()
    assert "synthetic_only" not in (root / "audit.jsonl").read_text()
    print("\nINTEGRATION PASS: real SSH gate, cut connection, replay, rollback, failures; db and prod untouched")


asyncio.run(main())
