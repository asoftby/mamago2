"""Regressions from the security review of the first version of this system."""
import json
import multiprocessing
import os
import stat
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
from pathlib import Path
from unittest import mock

from hostfixture import RELEASE, ROOT, Host
from network import Network
from test_control import MultiHostTests

from mamago_deploy import executor
from mamago_deploy.control import Audit
from mamago_deploy.transport import TransportError


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.host = Host(Path(self.tmp.name))

    def tearDown(self):
        self.tmp.cleanup()

    def confirm(self):
        return self.host.fingerprint("preflight", "dev", "rel:rc3-uat")

    def accept(self, confirmed, opid):
        """submit without starting a worker."""
        return executor.dispatch(str(self.host.config_path),
                                 ["submit-deploy", "dev", "rel:rc3-uat", confirmed, opid, "manual"], detach=False)

    def record(self, opid):
        return self.host.state_dir / "dev" / "ops" / f"{opid}.json"

    def worker(self, opid):
        with mock.patch.dict(os.environ, self.host.env_vars()):
            return executor.dispatch(str(self.host.config_path), ["_run", "dev", opid])

    def previous(self):
        path = self.host.state_dir / "dev" / "previous.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path


class OperationRegistrationTests(Base):
    def test_replay_while_running_returns_the_operation(self):
        confirmed, opid = self.confirm(), uuid.uuid4().hex
        self.host.state["migration_slow"] = 3
        self.host.submit("submit-deploy", "dev", "rel:rc3-uat", confirmed, opid, "manual")
        time.sleep(1)
        code, again = self.host.run("submit-deploy", "dev", "rel:rc3-uat", confirmed, opid, "manual", sync=False)
        self.assertEqual((code, again.get("state")), (0, "running"), again)
        self.host.wait("dev", opid)

    def test_second_operation_is_not_accepted_before_the_first_ends(self):
        confirmed = self.confirm()
        self.accept(confirmed, uuid.uuid4().hex)
        second = uuid.uuid4().hex
        with self.assertRaises(executor.Refused):
            self.accept(confirmed, second)
        self.assertFalse(self.record(second).exists())

    def test_an_id_cannot_be_reused_for_another_request(self):
        opid = uuid.uuid4().hex
        self.accept(self.confirm(), opid)
        with self.assertRaises(executor.Refused):
            self.accept("0" * 16, opid)

    def test_worker_that_cannot_start_is_a_definite_failure(self):
        confirmed, opid = self.confirm(), uuid.uuid4().hex
        with mock.patch.object(executor.subprocess, "Popen", side_effect=OSError("fork")):
            answer = executor.dispatch(str(self.host.config_path),
                                       ["submit-deploy", "dev", "rel:rc3-uat", confirmed, opid, "manual"])
        self.assertEqual(answer["state"], "failed", answer)
        self.assertIn("nothing changed", " ".join(answer["report"]))

    def test_record_is_published_whole_or_not_at_all(self):
        confirmed, opid = self.confirm(), uuid.uuid4().hex
        broken = OSError("No space left on device")
        with mock.patch.object(executor.json, "dump", side_effect=broken), \
                mock.patch.object(executor.json, "dumps", side_effect=broken), self.assertRaises(OSError):
            self.accept(confirmed, opid)
        self.assertFalse(self.record(opid).exists())

    def test_late_worker_changes_nothing(self):
        confirmed, opid = self.confirm(), uuid.uuid4().hex
        self.accept(confirmed, opid)
        data = json.loads(self.record(opid).read_text())
        data["queued"] -= 120
        self.record(opid).write_text(json.dumps(data))
        self.assertEqual(self.worker(opid)["state"], "failed")
        self.host.reload()
        self.assertEqual(self.host.mutations(), [])

    def test_only_one_worker_can_claim_an_operation(self):
        confirmed, opid = self.confirm(), uuid.uuid4().hex
        self.accept(confirmed, opid)
        runs, real_save, entered = [], executor.save_op, []

        def save_with_a_competitor(path, data):
            if not entered:
                entered.append(True)
                self.worker(opid)  # a second worker arrives between read and write
            real_save(path, data)

        with mock.patch.object(executor, "save_op", save_with_a_competitor), \
                mock.patch.object(executor, "run_deploy", lambda *a: runs.append(1)):
            self.worker(opid)
        self.assertEqual(len(runs), 1)

    def test_a_migration_left_running_blocks_deploy_and_rollback(self):
        self.previous().write_text(json.dumps({"image_ref": "ghcr.io/asoftby/mamago2:dev-1", "image_id": "sha256:" + "9" * 64,
                                               "build_id": "dev-0", "source_sha": "1" * 40}))
        self.host.state["oneoff"] = {"dev": ["f" * 64]}
        for command in (["preflight", "dev", "rel:rc3-uat"], ["rollback-preflight", "dev"]):
            code, answer = self.host.run(*command)
            self.assertNotEqual(code, 0)
            self.assertIn("one-off container", " ".join(answer["report"]))

    def test_a_timed_out_command_leaves_no_children(self):
        marker = Path(self.tmp.name) / "child"
        done = executor.sh(["sh", "-c", f"sleep 30 & echo $! > {marker}; wait"], timeout=1)
        self.assertEqual(done.returncode, 124)
        time.sleep(0.2)
        self.assertFalse(executor.process_alive(int(marker.read_text())))


class RollbackTargetTests(Base):
    SENTINEL = {"image_ref": "ghcr.io/asoftby/mamago2:dev-0", "image_id": "sha256:" + "9" * 64,
                "build_id": "dev-0", "source_sha": "1" * 40, "rollback_compatible": True}

    def failed_deploy_keeps_target(self, flag):
        self.previous().write_text(json.dumps(self.SENTINEL))
        self.host.state[flag] = True
        self.assertEqual(self.host.deploy()["state"], "failed")
        self.assertEqual(json.loads(self.previous().read_text())["build_id"], "dev-0")

    def test_failed_dump_keeps_the_earlier_rollback_target(self):
        self.failed_deploy_keeps_target("dump_fails")

    def test_failed_migration_keeps_the_earlier_rollback_target(self):
        self.failed_deploy_keeps_target("migration_fails")

    def test_switch_that_changed_nothing_keeps_the_earlier_rollback_target(self):
        self.failed_deploy_keeps_target("up_fails")


class DumpTests(Base):
    def backups(self):
        return sorted(p.name for p in (self.host.state_dir / "dev" / "backups").glob("*"))

    def test_failed_dump_leaves_no_file_behind(self):
        self.host.state["dump_fails"] = True
        self.assertEqual(self.host.deploy()["state"], "failed")
        self.assertEqual(self.backups(), [])

    def test_hung_dump_is_stopped_and_removed(self):
        self.host.write_config(dump_timeout=2)
        self.host.state["dump_hangs"] = 40
        started = time.monotonic()
        answer = self.host.deploy()
        self.assertEqual(answer["state"], "failed", answer)
        self.assertLess(time.monotonic() - started, 20)
        self.assertEqual(self.backups(), [])
        self.assertFalse(any("run" in c for c in self.host.mutations()))

    def test_good_dump_is_private_and_verified(self):
        self.assertEqual(self.host.deploy()["state"], "succeeded")
        (name,) = self.backups()
        path = self.host.state_dir / "dev" / "backups" / name
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertTrue(executor.verify_dump(path))
        path.write_bytes(path.read_bytes()[:-6])
        self.assertFalse(executor.verify_dump(path))


class TrustedFileTests(Base):
    def refused(self, needle):
        code, answer = self.host.run("preflight", "dev", "rel:rc3-uat")
        self.assertNotEqual(code, 0, answer)
        self.assertIn(needle, " ".join(answer["report"]))

    def test_world_writable_compose_directory_file_or_env(self):
        directory = self.host.root / "dev"
        for target, mode in ((directory, 0o777), (directory / "docker-compose.yml", 0o666), (directory / ".env", 0o666)):
            before = stat.S_IMODE(target.stat().st_mode)
            target.chmod(mode)
            self.refused("writable by every user")
            target.chmod(before)

    def test_writable_migration_list(self):
        (self.host.releases / "rc3-uat.migrations").chmod(0o666)
        self.refused("writable by group or others")


def _append(path, worker):
    audit = Audit(Path(path))
    for index in range(40):
        audit.write(event="start", user=worker, ref="x" * 2000, opid=str(index))


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "state" / "audit.jsonl"
        self.audit = Audit(self.path)

    def tearDown(self):
        self.tmp.cleanup()

    def test_concurrent_writers_keep_one_chain(self):
        context = multiprocessing.get_context("fork")
        workers = [context.Process(target=_append, args=(str(self.path), n)) for n in range(4)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join()
        self.assertEqual(len(self.path.read_text().splitlines()), 160)
        self.assertTrue(self.audit.verify())

    def test_damage_is_reported_and_stays_visible(self):
        self.audit.write(event="start")
        with self.path.open("a") as stream:
            stream.write('{"half a rec')
        self.assertFalse(self.audit.verify())
        self.audit.write(event="end")
        last = json.loads(self.path.read_text().splitlines()[-1])
        self.assertNotEqual(last["prev"], "0" * 64)
        self.assertTrue(last["damaged_previous"])
        self.assertFalse(self.audit.verify())

    def test_private_file_and_no_symlink(self):
        old = os.umask(0o022)
        try:
            self.audit.write(event="start")
        finally:
            os.umask(old)
        self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), 0o600)
        victim = Path(self.tmp.name) / "victim"
        victim.write_text("keep\n")
        link = Path(self.tmp.name) / "link.jsonl"
        link.symlink_to(victim)
        with self.assertRaises(OSError):
            Audit(link).write(event="start")
        self.assertEqual(victim.read_text(), "keep\n")


class ControlPlaneTests(MultiHostTests):
    """Reuses the multi-host fixture; its own tests are not repeated."""

    async def test_host_internal_error_after_acceptance_is_followed(self):
        self.setup_control()
        request = await self.pending()
        real = self.network.call

        async def failing(host, env, words, timeout=0):
            answer = await real(host, env, words, timeout)
            if words[0] == "submit-deploy":
                return {"ok": False, "error": "internal error OSError", "report": []}
            return answer

        self.network.call = failing
        self.assertEqual((await self.control.execute(request)).state, "succeeded")

    async def test_absent_once_is_not_taken_as_never_started(self):
        self.setup_control()
        request = await self.pending()
        real, seen = self.network.call, []

        async def late(host, env, words, timeout=0):
            if words[0] == "submit-deploy":
                await real(host, env, words, timeout)
                raise TransportError("connection cut")
            if words[0] == "result" and not seen:
                seen.append(True)
                return {"ok": True, "state": "absent", "report": []}
            return await real(host, env, words, timeout)

        self.network.call = late
        self.assertEqual((await self.control.execute(request)).state, "succeeded")

    async def test_unwritable_audit_at_the_end_does_not_lose_the_verdict(self):
        self.setup_control()
        request = await self.pending()
        real = self.control.audit.write

        def write(**event):
            if event["event"] == "end":
                raise OSError("disk full")
            real(**event)

        self.control.audit.write = write
        outcome = await self.control.execute(request)
        self.assertEqual(outcome.state, "succeeded")
        self.assertIn("audit", " ".join(outcome.report))


for _name in [n for n in dir(MultiHostTests) if n.startswith("test_")]:
    if _name in MultiHostTests.__dict__:
        setattr(ControlPlaneTests, _name, None)
del MultiHostTests

if __name__ == "__main__":
    unittest.main()
