"""Authorization, confirmations, runner and installer. No aiogram needed."""
import asyncio
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

UAT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(UAT))
from uat_core import Access, Busy, Confirmations, Runner, scrub  # noqa: E402

spec = importlib.util.spec_from_file_location("installer", UAT / "install-uat-bot.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class AccessTests(unittest.TestCase):
    def test_only_allowlisted_private_chat(self):
        access = Access(frozenset({10}))
        self.assertTrue(access.allows(10, 10, "private"))
        self.assertFalse(access.allows(11, 11, "private"))
        self.assertFalse(access.allows(10, -100, "supergroup"))
        self.assertFalse(access.allows(10, 10, "group"))
        self.assertFalse(access.allows(10, 11, "private"))
        self.assertFalse(access.allows(None, None, None))

    def test_missing_or_malformed_config_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "access.json"
            self.assertFalse(Access.load(path).allows(10, 10, "private"))
            for bad in ("{", "[]", json.dumps({"user_ids": ["10"]}), json.dumps({"user_ids": 10})):
                path.write_text(bad)
                self.assertFalse(Access.load(path).allows(10, 10, "private"), bad)
            path.write_text(json.dumps({"user_ids": [10]}))
            self.assertTrue(Access.load(path).allows(10, 10, "private"))


class ConfirmationTests(unittest.TestCase):
    def setUp(self):
        self.now = 0.0
        self.store = Confirmations(clock=lambda: self.now, ttl=300)

    def test_single_use_blocks_replay_and_double_tap(self):
        nonce = self.store.issue("deploy", 1, 1, "a" * 16)
        self.assertIsNotNone(self.store.consume(nonce, 1, 1))
        self.assertIsNone(self.store.consume(nonce, 1, 1))

    def test_expiry(self):
        nonce = self.store.issue("deploy", 1, 1, "a" * 16)
        self.now = 301
        self.assertIsNone(self.store.consume(nonce, 1, 1))

    def test_bound_to_user_and_chat(self):
        nonce = self.store.issue("rollback", 1, 1, "a" * 16)
        self.assertIsNone(self.store.consume(nonce, 2, 1))
        self.assertIsNone(self.store.consume(nonce, 1, 2))
        self.assertEqual(self.store.consume(nonce, 1, 1).action, "rollback")

    def test_new_request_supersedes_old_button(self):
        old = self.store.issue("deploy", 1, 1, "a" * 16)
        self.store.issue("rollback", 1, 1, "b" * 16)
        self.assertIsNone(self.store.consume(old, 1, 1))

    def test_restart_forgets_and_unknown_action_rejected(self):
        nonce = self.store.issue("deploy", 1, 1, "a" * 16)
        self.assertIsNone(Confirmations().consume(nonce, 1, 1))
        with self.assertRaises(ValueError):
            self.store.issue("prod", 1, 1, "a" * 16)


class RunnerTests(unittest.IsolatedAsyncioTestCase):
    def script(self, body):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "script.sh"
        path.write_text("#!/bin/sh\n" + body + "\n")
        path.chmod(0o755)
        return Runner(path)

    async def test_fixed_argv_minimal_environment_and_scrubbed_output(self):
        runner = self.script('echo "args=$*"; echo "actor=$UAT_ACTOR app=${APP_VERSION:-unset}"; echo "DATABASE_URL=postgresql://u:p@h/db"')
        result = await runner.run("deploy", 42, "a" * 16)
        self.assertIn("args=deploy --confirm " + "a" * 16, result.output)
        self.assertIn("actor=telegram:42 app=unset", result.output)
        self.assertNotIn("u:p@h", result.output)

    async def test_rejects_anything_but_known_subcommands_and_fingerprints(self):
        runner = self.script("echo run")
        for args in (("prod", 1), ("deploy prod", 1), ("deploy", 1, None), ("deploy", 1, "$(id)"), ("rollback", 1, "short")):
            with self.assertRaises(ValueError):
                await runner.run(*args)

    async def test_concurrent_commands(self):
        runner = self.script("sleep 1; echo done")
        first = asyncio.create_task(runner.run("preflight", 1))
        await asyncio.sleep(0.2)
        with self.assertRaises(Busy):
            await runner.run("deploy", 1, "a" * 16)
        self.assertEqual((await first).code, 0)

    async def test_fingerprint_only_from_successful_preflight(self):
        ok = await self.script("echo PREFLIGHT_FINGERPRINT=0123456789abcdef").run("preflight", 1)
        bad = await self.script("echo PREFLIGHT_FINGERPRINT=0123456789abcdef; exit 1").run("preflight", 1)
        self.assertEqual(ok.fingerprint, "0123456789abcdef")
        self.assertIsNone(bad.fingerprint)

    def test_scrub(self):
        text = scrub("123456789:AAHfakefakefakefakefakefakefakefake ghp_abcdefghijklmnopqrstuvwx BOT_TOKEN=abc")
        self.assertNotIn("AAHfake", text)
        self.assertNotIn("ghp_abc", text)
        self.assertNotIn("=abc", text)


class InstallerTests(unittest.TestCase):
    SOURCE = ('import logging\nlogger = logging.getLogger(__name__)\nclass Dispatcher:\n    pass\ndp = Dispatcher()\n\n\n'
              'async def main():\n    pass\n')

    def test_apply_is_reversible_and_leaves_existing_code(self):
        result = installer.patched(self.SOURCE)
        self.assertEqual(installer.removed(result), self.SOURCE)
        self.assertIn("try:", result)
        self.assertIn("except Exception:", result)
        compile(result, "bot", "exec")

    def test_refuses_unexpected_or_already_patched_source(self):
        with self.assertRaises(ValueError):
            installer.patched("print(1)\n")
        with self.assertRaises(ValueError):
            installer.patched(installer.patched(self.SOURCE))


if __name__ == "__main__":
    unittest.main()
