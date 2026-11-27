"""switch-bot.sh and set-secret.sh with fake systemctl, journalctl and pgrep."""
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

from hostfixture import ROOT

LEGACY = "[Service]\nExecStart=/opt/mamago/scripts/bot_env/bin/python /opt/mamago/scripts/deploy_bot.py\n"
FAKE = {
    "systemctl": r'''#!/bin/sh
echo "$*" >> "$FAKE/calls"
case "$1" in
  start) [ ! -e "$FAKE/precheck_fails" ] || exit 1 ;;
  restart) if grep -q mamago_deploy.bot "$UNIT_DIR/mamago-bot.service"; then [ ! -e "$FAKE/restart_fails" ] || exit 1; fi ;;
  is-active) echo active ;;
  show) if [ -e "$FAKE/crash_loop" ] && grep -q mamago_deploy.bot "$UNIT_DIR/mamago-bot.service"; then echo 3; else echo 0; fi ;;
esac
''',
    "journalctl": '#!/bin/sh\ncat "$FAKE/journal" 2>/dev/null\n',
    "pgrep": '#!/bin/sh\n[ -e "$FAKE/legacy_process" ]\n',
}


class SwitchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.fake, self.units = root / "fake", root / "units"
        self.fake.mkdir()
        self.units.mkdir()
        for name, body in FAKE.items():
            (self.fake / name).write_text(body)
            (self.fake / name).chmod(0o755)
        self.unit = self.units / "mamago-bot.service"
        self.unit.write_text(LEGACY)
        self.journal("INFO Run polling for bot @x id=1")

    def tearDown(self):
        self.tmp.cleanup()

    def journal(self, text):
        (self.fake / "journal").write_text(text + "\n")

    def flag(self, name):
        (self.fake / name).touch()

    def run_script(self, *args):
        env = {"PATH": f"{self.fake}:/usr/bin:/bin", "FAKE": str(self.fake), "UNIT_DIR": str(self.units),
               "WAIT_SECONDS": "2", "SETTLE_SECONDS": "0"}
        return subprocess.run(["bash", str(ROOT / "switch-bot.sh"), *args], env=env, capture_output=True, text=True, timeout=60)

    def restored(self, done):
        self.assertNotEqual(done.returncode, 0, done.stdout)
        self.assertIn("restoring the previous unit", done.stdout)
        self.assertEqual(self.unit.read_text(), LEGACY)

    def test_switch_then_rollback(self):
        done = self.run_script("switch")
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn("mamago_deploy.bot", self.unit.read_text())
        self.assertEqual((self.units / "mamago-bot.service.legacy").read_text(), LEGACY)
        self.assertFalse((self.units / "mamago-bot-check.service").exists())
        # a second switch must not replace the saved legacy unit with the new one
        self.assertEqual(self.run_script("switch").returncode, 0)
        self.assertEqual((self.units / "mamago-bot.service.legacy").read_text(), LEGACY)
        self.assertEqual(self.run_script("rollback").returncode, 0)
        self.assertEqual(self.unit.read_text(), LEGACY)

    def test_failed_precheck_never_restarts_the_running_bot(self):
        self.flag("precheck_fails")
        done = self.run_script("switch")
        self.assertNotEqual(done.returncode, 0)
        self.assertEqual(self.unit.read_text(), LEGACY)
        self.assertNotIn("restart mamago-bot.service", (self.fake / "calls").read_text())

    def test_restart_failure(self):
        self.flag("restart_fails")
        self.restored(self.run_script("switch"))

    def test_never_starts_polling(self):
        self.journal("Traceback")
        self.restored(self.run_script("switch"))

    def test_crash_loop_that_looks_active(self):
        self.flag("crash_loop")
        self.restored(self.run_script("switch"))

    def test_second_poller(self):
        self.journal("Run polling for bot @x\nTelegramConflictError: terminated by other getUpdates")
        self.restored(self.run_script("switch"))

    def test_legacy_process_left_behind(self):
        self.flag("legacy_process")
        self.restored(self.run_script("switch"))

    def test_rollback_without_a_saved_unit_changes_nothing(self):
        self.assertNotEqual(self.run_script("rollback").returncode, 0)
        self.assertEqual(self.unit.read_text(), LEGACY)


class SecretTests(unittest.TestCase):
    def test_stored_privately_and_never_emptied(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = {"PATH": "/usr/bin:/bin", "SECRETS_DIR": f"{tmp}/secrets"}

            def store(value, name="bot_token"):
                return subprocess.run(["bash", str(ROOT / "set-secret.sh"), name], input=value, env=env,
                                      capture_output=True, text=True)

            done = store("synthetic-value\n")
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertNotIn("synthetic-value", done.stdout + done.stderr)
            path = Path(tmp) / "secrets" / "bot_token"
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o700)
            for bad in ("\n", "two words\n"):
                self.assertNotEqual(store(bad).returncode, 0)
                self.assertEqual(path.read_text(), "synthetic-value")
            self.assertNotEqual(store("x\n", "../x").returncode, 0)


if __name__ == "__main__":
    unittest.main()
