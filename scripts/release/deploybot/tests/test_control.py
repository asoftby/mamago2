"""Authorization, confirmations, audit, gate, transport and multi-host behaviour."""
import asyncio
import json
import re
import tempfile
import unittest
from pathlib import Path

from hostfixture import OLD_ID, RELEASE, ROOT
from network import Network, orchestrator, write_registry
from mamago_deploy import gate
from mamago_deploy.common import Refused, redact
from mamago_deploy.config import Registry
from mamago_deploy.control import Access, Audit, Busy, Confirmations, Pending
from mamago_deploy.transport import Transport, TransportError, command_for


class AccessAndConfirmationTests(unittest.TestCase):
    def setUp(self):
        self.now = 0.0
        self.store = Confirmations(clock=lambda: self.now)

    def issue(self, strict=False, env="dev", user=1):
        return self.store.issue(action="deploy", env=env, host_id="legacy", ref="rel:x", fingerprint="a" * 16,
                                user_id=user, chat_id=user, summary=env, strict=strict)

    def test_only_allowlisted_private_chat(self):
        access = Access(frozenset({10}))
        self.assertTrue(access.allows(10, 10, "private"))
        for case in ((11, 11, "private"), (10, -100, "supergroup"), (10, 10, "group"), (10, 11, "private"), (None, None, None)):
            self.assertFalse(access.allows(*case), case)

    def test_access_file_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "access.json"
            self.assertFalse(Access.load(path).owner_ids)
            for bad in ("{", "[]", '{"owner_ids": ["10"]}', '{"owner_ids": 10}', '{"owner_ids": [0]}'):
                path.write_text(bad)
                self.assertFalse(Access.load(path).owner_ids, bad)

    def test_single_use_bound_and_expiring(self):
        nonce = self.issue()
        self.assertIsNone(self.store.press(nonce, 2, 1))
        self.assertIsNone(self.store.press(nonce, 1, 2))
        self.assertEqual(self.store.press(nonce, 1, 1).env, "dev")
        self.assertIsNone(self.store.press(nonce, 1, 1))
        nonce = self.issue()
        self.now = 301
        self.assertIsNone(self.store.press(nonce, 1, 1))

    def test_new_request_voids_the_previous_button(self):
        old = self.issue(env="dev")
        self.issue(env="prod")
        self.assertIsNone(self.store.press(old, 1, 1))

    def test_typed_second_step_is_single_attempt(self):
        pending = self.store.press(self.issue(strict=True, env="prod"), 1, 1)
        code = self.store.require_typed(pending)
        self.assertRegex(code, r"^PROD [0-9A-F]{6}$")
        self.assertIsNone(self.store.typed("PROD 000000x", 1, 1))
        self.assertIsNone(self.store.typed(code, 1, 1), "a wrong attempt voids the confirmation")
        code = self.store.require_typed(pending)
        self.assertEqual(self.store.typed(code, 1, 1).env, "prod")
        self.assertIsNone(self.store.typed(code, 1, 1))

    def test_strict_confirmation_expires_quickly(self):
        pending = self.store.press(self.issue(strict=True), 1, 1)
        code = self.store.require_typed(pending)
        self.now = 121
        self.assertIsNone(self.store.typed(code, 1, 1))


class GateAndTransportTests(unittest.TestCase):
    def test_gate_environment_comes_from_the_key_not_the_request(self):
        self.assertEqual(gate.parse(["--env", "dev"], "status"), ["status", "dev"])
        self.assertEqual(gate.parse(["--env", "dev"], "-- preflight rel:rc3-uat"), ["preflight", "dev", "rel:rc3-uat"])
        self.assertEqual(gate.parse(["--env", "prod", "--", "logs", "app"], None), ["logs", "prod", "app"])

    def test_gate_refuses_injection_and_unknown_requests(self):
        for request in ("status prod", "preflight rel:x;id", "preflight $(id)", "preflight rel:x | sh", "logs ../../etc",
                        "preflight -oProxyCommand=id", "_run abc", "bash", "status\nid", "preflight  rel:x", "", "docker ps",
                        "submit-deploy rel:x a b c d"):
            with self.assertRaises(ValueError, msg=request):
                gate.parse(["--env", "dev"], request)
        for argv in ([], ["--env"], ["--env", "staging"], ["status"], ["--env", "dev", "extra"]):
            with self.assertRaises(ValueError, msg=argv):
                gate.parse(argv, "status")

    def test_ssh_command_is_strict_and_per_environment(self):
        host = {"type": "ssh", "address": "10.0.0.5", "port": 22, "user": "mamago-exec",
                "identity_files": {"dev": "/k/dev", "prod": "/k/prod"}, "known_hosts": "/k/known"}
        argv = command_for(host, "dev", ["preflight", "rel:rc3-uat"])
        text = " ".join(argv)
        for needle in ("StrictHostKeyChecking=yes", "BatchMode=yes", "UserKnownHostsFile=/k/known", "-i /k/dev", "-F /dev/null"):
            self.assertIn(needle, text)
        self.assertNotIn("/k/prod", text)
        self.assertNotIn("StrictHostKeyChecking=no", text)
        for words in (["preflight", "x y"], ["preflight", "$(id)"], ["rm", "-rf"], ["status", "extra"]):
            with self.assertRaises(Refused):
                command_for(host, "dev", words)

    def test_registry_rejects_unsafe_definitions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            write_registry(path, {"dev": "legacy", "prod": "legacy"})
            good = json.loads(path.read_text())
            for mutate in (lambda d: d["environments"]["prod"].update(strict=False),
                           lambda d: d["environments"]["prod"].update(latest_tag_prefix="dev"),
                           lambda d: d["environments"]["dev"].update(host="elsewhere"),
                           lambda d: d["hosts"].update(x={"type": "ssh", "address": "-oProxyCommand=id", "port": 22, "user": "u",
                                                          "identity_files": {}, "known_hosts": "/k"}),
                           lambda d: d.update(extra=1)):
                data = json.loads(json.dumps(good))
                mutate(data)
                path.write_text(json.dumps(data))
                with self.assertRaises(Refused):
                    Registry.load(path)
            path.write_text(json.dumps(good))
            path.chmod(0o664)
            with self.assertRaises(Refused):
                Registry.load(path)

    def test_examples_are_valid(self):
        import shutil
        for name in ("registry.json", "registry.after-dev-migration.json"):
            with tempfile.TemporaryDirectory() as directory:
                copy = Path(directory) / "registry.json"
                shutil.copy(ROOT / "examples" / name, copy)
                copy.chmod(0o600)
                Registry.load(copy)

    def test_no_secret_in_the_new_sources(self):
        pattern = re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40}")
        for path in ROOT.rglob("*"):
            if path.is_file() and "tests" not in path.parts:
                self.assertIsNone(pattern.search(path.read_text(errors="ignore")), path)

    def test_redaction(self):
        text = redact("123456789:" + "A" * 35 + " ghp_" + "b" * 36 + " Authorization: Bearer abc DATABASE_URL=postgresql://u:p@h/d")
        for leak in ("AAAAAAAA", "ghp_b", "Bearer abc", "u:p@h"):
            self.assertNotIn(leak, text)


class MultiHostTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.network = Network(self.root)
        self.legacy = self.network.add("legacy", ("dev", "prod"))
        self.hoster = self.network.add("hoster", ("dev",))

    def setup_control(self, mapping=None, **options):
        self.control, self.registry_path = orchestrator(self.root, self.network, mapping, **options)

    async def pending(self, env="dev", action="deploy", ref="rel:rc3-uat"):
        words = ["preflight", ref] if action == "deploy" else ["rollback-preflight"]
        answer = await self.control.ask(env, action, words)
        self.assertTrue(answer["ok"], answer["report"])
        host = self.control.registry().environment(env)["host"]
        return Pending(action, env, host, ref, answer["fingerprint"], 42, 42, 10**12, env)

    def audit_lines(self):
        return [json.loads(line) for line in (self.root / "audit.jsonl").read_text().splitlines()]

    async def test_deploy_through_the_gate_and_audit(self):
        self.setup_control()
        outcome = await self.control.execute(await self.pending())
        self.assertEqual(outcome.state, "succeeded", outcome.report)
        events = self.audit_lines()
        self.assertEqual([e["event"] for e in events], ["start", "end"])
        self.assertEqual((events[1]["outcome"], events[1]["user"], events[1]["host"]), ("succeeded", 42, "legacy"))
        self.assertTrue(self.control.audit.verify())
        self.assertNotIn("super-secret-value", (self.root / "audit.jsonl").read_text())

    async def test_audit_tampering_is_detected(self):
        audit = Audit(self.root / "a.jsonl")
        audit.write(event="one")
        audit.write(event="two")
        self.assertTrue(audit.verify())
        audit.path.write_text(audit.path.read_text().replace('"one"', '"xxx"'))
        self.assertFalse(audit.verify())

    async def test_reassigning_dev_moves_all_work_to_the_new_host(self):
        self.setup_control()
        write_registry(self.registry_path, {"dev": "hoster", "prod": "legacy"})
        outcome = await self.control.execute(await self.pending())
        self.assertEqual(outcome.state, "succeeded", outcome.report)
        self.hoster.reload()
        self.legacy.reload()
        self.assertEqual(self.hoster.image("dev-app-1"), RELEASE["image_digest"])
        self.assertEqual(self.legacy.image("dev-app-1"), OLD_ID)
        self.assertEqual(self.legacy.mutations(), [])

    async def test_environment_moved_after_confirmation_is_refused(self):
        self.setup_control()
        pending = await self.pending()
        write_registry(self.registry_path, {"dev": "hoster", "prod": "legacy"})
        with self.assertRaises(Refused):
            await self.control.execute(pending)
        self.assertEqual(self.network.count("submit-deploy"), 0)

    async def test_host_claiming_another_identity_is_refused(self):
        self.setup_control()
        self.legacy.host_id = "hoster"
        self.legacy.write_config()
        with self.assertRaisesRegex(Refused, "expected legacy/dev"):
            await self.control.ask("dev", "status", ["status"])

    async def test_one_host_down_does_not_affect_the_other(self):
        self.setup_control({"dev": "hoster", "prod": "legacy"})
        self.network.down.add("hoster")
        with self.assertRaises(TransportError):
            await self.control.ask("dev", "status", ["status"])
        self.assertTrue((await self.control.ask("prod", "status", ["status"]))["ok"])

    async def test_connection_lost_before_delivery_starts_nothing_and_is_not_retried(self):
        self.setup_control()
        pending = await self.pending()
        self.network.drop_submit_before = True
        outcome = await self.control.execute(pending)
        self.assertEqual(outcome.state, "not_started", outcome.report)
        self.assertEqual(self.network.count("submit-deploy"), 1)
        self.legacy.reload()
        self.assertEqual(self.legacy.mutations(), [])

    async def test_connection_lost_after_delivery_is_followed_not_repeated(self):
        self.setup_control()
        pending = await self.pending()
        self.network.drop_submit_after = True
        self.network.flaky_results = 3
        outcome = await self.control.execute(pending)
        self.assertEqual(outcome.state, "succeeded", outcome.report)
        self.assertEqual(self.network.count("submit-deploy"), 1)

    async def test_permanently_lost_host_is_unknown_never_success(self):
        self.setup_control(deadline_seconds=0.3)
        pending = await self.pending()
        self.network.drop_submit_after = True
        self.network.flaky_results = 10**6
        outcome = await self.control.execute(pending)
        self.assertEqual(outcome.state, "unknown")
        self.assertIn("do not repeat", outcome.report[0])
        self.assertEqual(self.audit_lines()[-1]["outcome"], "unknown")

    async def test_second_operation_on_the_same_environment_is_refused(self):
        self.setup_control()
        pending = await self.pending()
        first = asyncio.create_task(self.control.execute(pending))
        await asyncio.sleep(0.05)
        with self.assertRaises(Busy):
            await self.control.execute(pending)
        self.assertEqual((await first).state, "succeeded")
        self.assertEqual(self.network.count("submit-deploy"), 1)

    async def test_disallowed_operation_never_reaches_a_host(self):
        self.setup_control()
        data = json.loads(self.registry_path.read_text())
        data["environments"]["prod"]["operations"] = ["status"]
        self.registry_path.write_text(json.dumps(data))
        with self.assertRaises(Refused):
            await self.control.ask("prod", "deploy", ["preflight", "rel:x"])
        self.assertEqual(self.network.sent, [])

    async def test_unreachable_ssh_and_broken_host_key_are_transport_errors(self):
        script = self.root / "fake-ssh"
        script.write_text('#!/bin/sh\necho "Host key verification failed." >&2\nexit 255\n')
        script.chmod(0o755)
        import mamago_deploy.transport as module
        original = module.command_for
        module.command_for = lambda *a: [str(script)]
        try:
            with self.assertRaisesRegex(TransportError, "host key verification failed"):
                await Transport().call({}, "dev", ["status"])
            script.write_text('#!/bin/sh\necho "user@h: Permission denied (publickey)." >&2\nexit 255\n')
            with self.assertRaisesRegex(TransportError, "authentication failed"):
                await Transport().call({}, "dev", ["status"])
        finally:
            module.command_for = original


if __name__ == "__main__":
    unittest.main()
