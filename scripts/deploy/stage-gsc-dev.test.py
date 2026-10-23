import copy
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest

TOOL = Path(__file__).with_name("stage-gsc-dev.py")
spec = importlib.util.spec_from_file_location("stage_gsc_dev", TOOL)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StagingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Synthetic key only; no real credential, .env, SSH or Google access.
        key = subprocess.check_output(["openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048"], stderr=subprocess.DEVNULL).decode()
        cls.payload = {"enabled": False, "credentials": {
            "type": "service_account", "project_id": "mamago-2-0",
            "client_email": module.EMAIL, "token_uri": "https://oauth2.googleapis.com/token",
            "private_key": key,
        }}

    def test_atomic_pair_permissions_and_rotation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            os.chmod(root, 0o700)
            self.assertIsNone(module.stage(self.payload, root))
            first = os.readlink(root / "current")
            web = (root / "current/web.env").read_text()
            worker = (root / "current/worker.env").read_text()
            self.assertNotIn("PRIVATE_KEY", web)
            self.assertNotIn(self.payload["credentials"]["private_key"], web)
            self.assertIn("GOOGLE_SEARCH_CONSOLE_ENABLED=false\n", web)
            self.assertIn("sc-domain:mamago.by", worker)
            encoded_key = worker.split("GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY=", 1)[1].strip()
            self.assertEqual(json.loads(encoded_key), self.payload["credentials"]["private_key"])
            for file in ("web.env", "worker.env"):
                self.assertEqual(stat.S_IMODE((root / "current" / file).stat().st_mode), 0o600)
            enabled = copy.deepcopy(self.payload)
            enabled["enabled"] = True
            self.assertEqual(module.stage(enabled, root), first)
            self.assertNotEqual(os.readlink(root / "current"), first)
            self.assertIn("ENABLED=true", (root / "current/web.env").read_text())
            self.assertTrue((root / first / "worker.env").exists())

    def test_invalid_input_does_not_replace_current(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            module.stage(self.payload, root)
            first = os.readlink(root / "current")
            for field, value in (("client_email", "wrong@example.com"), ("token_uri", "https://evil.invalid"), ("project_id", "prod"), ("private_key", "private-do-not-log")):
                bad = copy.deepcopy(self.payload)
                bad["credentials"][field] = value
                with self.assertRaises(ValueError):
                    module.stage(bad, root)
                self.assertEqual(os.readlink(root / "current"), first)
            bad = copy.deepcopy(self.payload)
            bad["credentials"]["private_key"] += "\nEVIL=${SECRET}\n"
            with self.assertRaises(ValueError):
                module.stage(bad, root)
            bad["enabled"] = "true"
            with self.assertRaises(ValueError):
                module.stage(bad, root)

    def test_write_failure_keeps_previous_pair(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            module.stage(self.payload, root)
            first = os.readlink(root / "current")
            with patch.object(module.os, "replace", side_effect=OSError("simulated")):
                with self.assertRaises(OSError):
                    module.stage(self.payload, root)
            self.assertEqual(os.readlink(root / "current"), first)
            self.assertEqual(len(list(root.glob("generation-*"))), 1)

    def test_unsafe_directory_or_pointer_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            (root / "current").symlink_to("../../prod")
            with self.assertRaises(ValueError):
                module.stage(self.payload, root)
            (root / "current").unlink()
            os.chmod(root, 0o755)
            with self.assertRaises(ValueError):
                module.stage(self.payload, root)

    def test_cli_redacts_and_requires_forced_command(self):
        result = subprocess.run(["python3", str(TOOL), "--client"], env={"PATH": os.environ["PATH"], "GSC_SERVICE_ACCOUNT_JSON_DEV": "private-do-not-log"}, capture_output=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, b"")
        self.assertNotIn(b"private-do-not-log", result.stderr)
        result = subprocess.run(["python3", str(TOOL), "--receive"], input=b"private-do-not-log", env={"PATH": os.environ["PATH"], "SSH_ORIGINAL_COMMAND": "cat /etc/passwd"}, capture_output=True)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(b"private-do-not-log", result.stderr)
        result = subprocess.run(["python3", str(TOOL), "--client"], env={"PATH": os.environ["PATH"], "GSC_SERVICE_ACCOUNT_JSON_DEV": json.dumps(self.payload["credentials"]), "GSC_ENABLED": "false"}, capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, b"")
        self.assertEqual(json.loads(result.stdout), self.payload)

    def test_workflow_is_manual_dev_only_and_does_not_execute_deploy(self):
        workflow = Path(".github/workflows/gsc-dev-config.yml").read_text()
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("github.ref == 'refs/heads/dev'", workflow)
        self.assertIn("github.actor == 'asoftby'", workflow)
        self.assertIn("user@134.17.17.134 stage-gsc-dev", workflow)
        self.assertIn("StrictHostKeyChecking=yes", workflow)
        self.assertIn("persist-credentials: false", workflow)
        for forbidden in ("pull_request:", "push:", "schedule:", "upload-artifact", "set -x", "docker compose", "migrate deploy", "StrictHostKeyChecking=no"):
            self.assertNotIn(forbidden, workflow)
        import ast
        literals = {n.value for n in ast.walk(ast.parse(TOOL.read_text())) if isinstance(n, ast.Constant) and isinstance(n.value, str)}
        self.assertNotIn(".env", literals)
        self.assertNotIn("/opt/mamago/prod", TOOL.read_text())


if __name__ == "__main__":
    unittest.main()
