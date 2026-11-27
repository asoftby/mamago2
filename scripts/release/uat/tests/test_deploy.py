"""Scenario tests for deploy-uat-dev.sh with a fake docker and real flock/ssh-keygen. Linux only."""
import datetime as dt
import fcntl
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TESTS = Path(__file__).resolve().parent
UAT = TESTS.parent
CONF = dict(line.split("=", 1) for line in (UAT / "release.conf").read_text().splitlines() if "=" in line and not line.startswith("#"))
MIGRATIONS = (UAT / "migrations.txt").read_text().split()
PENDING = CONF["EXPECTED_PENDING_MIGRATIONS"]
SECRET = "postgresql://dev:super-secret-value@db:5432/dev"


class Host:
    def __init__(self, root: Path):
        self.root = root
        self.dev = root / "dev"
        self.home = root / "uat"
        self.bin = root / "bin"
        for directory in (self.dev, self.home / "attestation", self.bin):
            directory.mkdir(parents=True)
        for name in ("release.conf", "migrations.txt"):
            shutil.copy(UAT / name, self.home / name)
        (self.dev / "docker-compose.yml").write_text("services: {}\n")
        (self.dev / ".env").write_text(f"APP_VERSION=dev-1329\nAPP_PUBLIC_URL=https://dev.example.test\nDATABASE_URL={SECRET}\n")
        for name, source in (("docker", "fake_docker.py"), ("curl", "fake_curl.py")):
            shutil.copy(TESTS / source, self.bin / name)
            (self.bin / name).chmod(0o755)
        env = {"APP_ENV": "dev", "TRUST_PROXY_HEADERS": "true", "DATABASE_URL": SECRET,
               "BOOST_PRICE_1D_BYN": "1", "BOOST_PRICE_3D_BYN": "2", "BOOST_PRICE_7D_BYN": "3"}
        rollback = CONF["ROLLBACK_IMAGE_ID"]
        released = CONF["IMAGE_DIGEST"]
        self.state = {
            "rollback_id": rollback,
            "containers": {
                "dev-db-1": {"Id": "a" * 64, "StartedAt": "t0", "Health": "healthy", "Project": "dev"},
                "dev-app-1": {"Id": "b" * 64, "StartedAt": "t0", "Project": "dev", "Image": rollback, "ImageRef": "repo:dev-1329"},
                "dev-worker-1": {"Id": "c" * 64, "StartedAt": "t0", "Project": "dev", "Image": rollback, "ImageRef": "repo:dev-1329"},
                "prod-app-1": {"Id": "d" * 64, "StartedAt": "p0", "Project": "prod"},
                "prod-db-1": {"Id": "f" * 64, "StartedAt": "p0", "Project": "prod"},
            },
            "images": {"ghcr.io/asoftby/mamago2:dev-1329": rollback},
            "compose": {"db": {"image": "postgres:16-alpine"}, "migrate": {"image": "old"},
                        "app": {"image": "old", "environment": env}, "worker": {"image": "old", "environment": env},
                        "prisma-studio": {"image": "studio"}},
            "registry_digest": released, "registry_config": CONF["IMAGE_CONFIG_DIGEST"],
            "registry_revision": CONF["SOURCE_SHA"], "registry_build_id": CONF["BUILD_ID"],
            "pulled_id": released, "pulled_revision": CONF["SOURCE_SHA"], "pulled_build_id": CONF["BUILD_ID"],
            "applied": sorted(m for m in MIGRATIONS if m != PENDING), "release_migrations": MIGRATIONS,
            "health": {
                released: {"status": "ok", "db": "ok", "gitSha": CONF["SOURCE_SHA"], "buildId": CONF["BUILD_ID"]},
                rollback: {"status": "ok", "db": "ok", "gitSha": CONF["ROLLBACK_SHA"], "buildId": CONF["ROLLBACK_TAG"]},
            },
        }
        self.state_path = root / "state.json"
        self.save()
        self.key = root / "signer"
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(self.key)], check=True)
        (self.home / "allowed_signers").write_text("uat-backup " + Path(str(self.key) + ".pub").read_text())
        self.attest()

    def save(self):
        self.state_path.write_text(json.dumps(self.state))

    def reload(self):
        self.state = json.loads(self.state_path.read_text())
        return self.state

    def attest(self, key=None, **overrides):
        data = {"db_sha256": "1" * 64, "db_bytes": "10", "media_sha256": "2" * 64, "media_bytes": "10",
                "created_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "restore_check": "PASS",
                "dev_db_container_id": "a" * 64, "release_digest": CONF["IMAGE_DIGEST"],
                "rollback_image_id": CONF["ROLLBACK_IMAGE_ID"], **overrides}
        manifest = self.home / "attestation" / "backup.manifest"
        manifest.write_text("".join(f"{k}={v}\n" for k, v in data.items()))
        Path(str(manifest) + ".sig").unlink(missing_ok=True)
        subprocess.run(["ssh-keygen", "-Y", "sign", "-f", str(key or self.key), "-n", "mamago-uat-backup", str(manifest)],
                       check=True, capture_output=True)

    def run(self, *args, **extra):
        env = {"PATH": f"{self.bin}:{Path(sys.executable).parent}:/usr/bin:/bin", "UAT_TEST_MODE": "1", "UAT_DEV_DIR": str(self.dev),
               "UAT_HOME": str(self.home), "UAT_LOCK_FILE": str(self.root / "lock"), "FAKE_STATE": str(self.state_path),
               "UAT_ACTOR": "telegram:42", **extra}
        self.save()
        done = subprocess.run(["bash", str(UAT / "deploy-uat-dev.sh"), *args], env=env, capture_output=True, text=True, timeout=60)
        self.reload()
        return done.returncode, done.stdout + done.stderr

    def calls(self):
        log = Path(str(self.state_path) + ".log")
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    def mutations(self):
        return [c for c in self.calls() if c[0] == "pull" or (c[0] == "compose" and ("up" in c or "run" in c))]

    def confirm(self, command="preflight"):
        code, out = self.run(command)
        assert code == 0, out
        return out.split("PREFLIGHT_FINGERPRINT=")[1].split()[0]

    def deploy(self):
        return self.run("deploy", "--confirm", self.confirm())


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.host = Host(Path(self.tmp.name))

    def tearDown(self):
        # Invariants for every scenario: nothing in PROD or the database is ever acted on.
        for call in self.host.calls():
            if call[0] == "compose":
                self.assertEqual(call[call.index("--project-name") + 1], "dev", call)
                self.assertFalse({"down", "rm", "stop", "restart", "kill"} & set(call), call)
                if "up" in call:
                    self.assertEqual(call[-2:], ["app", "worker"], call)
                    self.assertIn("--no-deps", call)
            self.assertNotIn(call[0], ("rm", "rmi", "stop", "restart", "kill", "system", "volume", "push", "tag"), call)
            if call[0] == "exec":
                self.assertFalse(call[1].startswith("prod") or "prod-db-1" in call, call)
        self.tmp.cleanup()

    def assert_not_ready(self, needle):
        code, out = self.host.run("preflight")
        self.assertNotEqual(code, 0, out)
        self.assertIn(needle, out)
        self.assertNotIn("PREFLIGHT_FINGERPRINT", out)
        self.assertEqual(self.host.mutations(), [])

    def test_preflight_is_read_only_and_leaks_nothing(self):
        code, out = self.host.run("preflight")
        self.assertEqual(code, 0, out)
        self.assertIn("RESULT READY", out)
        self.assertEqual(self.host.mutations(), [])
        self.assertNotIn("super-secret-value", out)
        self.assertFalse((self.host.home / "state" / "compose.uat.yml").exists())

    def test_wrong_tag_digest(self):
        self.host.state["registry_digest"] = "sha256:" + "0" * 64
        self.assert_not_ready("registry tag does not resolve")

    def test_wrong_content_digest(self):
        self.host.state["registry_config"] = "sha256:" + "0" * 64
        self.assert_not_ready("mismatch")

    def test_wrong_sha(self):
        self.host.state["registry_revision"] = "0" * 40
        self.assert_not_ready("mismatch")

    def test_changed_build_id(self):
        self.host.state["registry_build_id"] = "uat-20261127-ffffffffffff"
        self.assert_not_ready("mismatch")

    def test_missing_backup(self):
        (self.host.home / "attestation" / "backup.manifest.sig").unlink()
        self.assert_not_ready("attestation is missing")

    def test_unsigned_edit_of_backup_note(self):
        manifest = self.host.home / "attestation" / "backup.manifest"
        manifest.write_text(manifest.read_text() + "note=trust me\n")
        self.assert_not_ready("signature is invalid")

    def test_backup_signed_by_unknown_key(self):
        other = self.host.root / "other"
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(other)], check=True)
        self.host.attest(key=other)
        self.assert_not_ready("signature is invalid")

    def test_stale_backup(self):
        self.host.attest(created_utc="2020-01-01T00:00:00Z")
        self.assert_not_ready("h old")

    def test_backup_of_another_database(self):
        self.host.attest(dev_db_container_id="9" * 64)
        self.assert_not_ready("another database")

    def test_low_disk(self):
        conf = self.host.home / "release.conf"
        conf.write_text(conf.read_text().replace("MIN_FREE_GB=10", "MIN_FREE_GB=9999"))
        self.assert_not_ready("free disk below")

    def test_unhealthy_db(self):
        self.host.state["containers"]["dev-db-1"]["Health"] = "unhealthy"
        self.assert_not_ready("dev-db-1 not healthy")

    def test_release_flag_enabled(self):
        self.host.state["compose"]["app"]["environment"] = {**self.host.state["compose"]["app"]["environment"], "ENABLE_PUBLIC_BIRTHDAY": "true"}
        self.assert_not_ready("ENABLE_PUBLIC_BIRTHDAY is enabled")

    def test_db_definition_would_change(self):
        self.host.state["override_touches_db"] = True
        self.assert_not_ready("would change more than application images")

    def test_auto_loaded_override_file(self):
        (self.host.dev / "docker-compose.override.yml").write_text("services: {}\n")
        self.assert_not_ready("auto-loaded")

    def test_missing_rollback_image(self):
        self.host.state["images"] = {}
        self.assert_not_ready("rollback image")

    def test_unknown_migration_in_database(self):
        self.host.state["applied"] = self.host.state["applied"] + ["20990101000000_unknown"]
        self.assert_not_ready("unknown to the release")

    def test_unexpected_pending_migration(self):
        self.host.state["applied"] = self.host.state["applied"][1:]
        self.assert_not_ready("unexpected pending migrations")

    def test_failed_migration_recorded(self):
        self.host.state["broken_migrations"] = 1
        self.assert_not_ready("unfinished or failed migration")

    def test_successful_deploy(self):
        code, out = self.host.deploy()
        self.assertEqual(code, 0, out)
        self.assertIn("RESULT DEPLOYED", out)
        self.assertEqual(self.host.state["containers"]["dev-app-1"]["Image"], CONF["IMAGE_DIGEST"])
        self.assertEqual(self.host.state["containers"]["dev-db-1"]["Id"], "a" * 64)
        kinds = [("pull" if c[0] == "pull" else "run" if "run" in c else "up") for c in self.host.mutations()]
        self.assertEqual(kinds, ["pull", "run", "up"])
        self.assertFalse(any("db:seed:system" in " ".join(c) for c in self.host.calls()))
        self.assertIn("APP_VERSION=dev-1329", (self.host.dev / ".env").read_text())
        log = (self.host.home / "log" / "uat.log").read_text()
        self.assertIn("actor=telegram:42 deploy success", log)
        self.assertNotIn("super-secret-value", out + log)

    def test_deploy_requires_matching_confirmation(self):
        code, out = self.host.run("deploy", "--confirm", "0" * 16)
        self.assertNotEqual(code, 0)
        self.assertIn("state changed since confirmation", out)
        self.assertEqual(self.host.mutations(), [])

    def test_state_change_after_confirmation_invalidates_it(self):
        fingerprint = self.host.confirm()
        (self.host.dev / ".env").write_text((self.host.dev / ".env").read_text() + "X=1\n")
        code, out = self.host.run("deploy", "--confirm", fingerprint)
        self.assertNotEqual(code, 0, out)
        self.assertEqual(self.host.mutations(), [])

    def test_confirmation_cannot_be_reused_after_deploy(self):
        fingerprint = self.host.confirm()
        self.assertEqual(self.host.run("deploy", "--confirm", fingerprint)[0], 0)
        before = len(self.host.mutations())
        self.assertNotEqual(self.host.run("deploy", "--confirm", fingerprint)[0], 0)
        self.assertEqual(len(self.host.mutations()), before)

    def test_arguments_are_not_interpreted(self):
        for args in (["deploy", "--confirm", "$(id)"], ["deploy", "prod"], ["preflight", "prod"], ["prod"]):
            code, out = self.host.run(*args)
            self.assertNotEqual(code, 0, out)
        self.assertEqual(self.host.mutations(), [])

    def test_environment_cannot_redirect_to_prod(self):
        code, out = self.host.run("preflight", COMPOSE_PROJECT_NAME="prod", COMPOSE_FILE="/opt/mamago/prod/docker-compose.yml", APP_VERSION="prod-1124")
        self.assertEqual(code, 0, out)

    def test_concurrent_operation_is_refused(self):
        fingerprint = self.host.confirm()
        with open(self.host.root / "lock", "a") as held:
            fcntl.flock(held, fcntl.LOCK_EX)
            for args in (["deploy", "--confirm", fingerprint], ["preflight"], ["rollback", "--confirm", fingerprint]):
                code, out = self.host.run(*args)
                self.assertNotEqual(code, 0)
                self.assertIn("another deploy or rollback is running", out)
        self.assertEqual(self.host.mutations(), [])

    def test_wrong_pulled_image_is_not_started(self):
        self.host.state["pulled_build_id"] = "dev-9"
        code, out = self.host.deploy()
        self.assertNotEqual(code, 0)
        self.assertIn("identity mismatch", out)
        self.assertEqual([c[0] for c in self.host.mutations()], ["pull"])

    def test_migration_error_leaves_application_untouched(self):
        self.host.state["migration_fails"] = True
        code, out = self.host.deploy()
        self.assertNotEqual(code, 0)
        self.assertIn("NOT switched", out)
        self.assertFalse(any("up" in c for c in self.host.mutations()))
        self.assertEqual(self.host.state["containers"]["dev-app-1"]["Image"], CONF["ROLLBACK_IMAGE_ID"])

    def assert_failed_after_switch(self, needle):
        code, out = self.host.deploy()
        self.assertNotEqual(code, 0, out)
        self.assertIn(needle, out)
        self.assertIn("Rollback is recommended", out)
        self.assertIn("deploy failed after switch", (self.host.home / "log" / "uat.log").read_text())

    def test_app_worker_mismatch(self):
        self.host.state["worker_stays_old"] = True
        self.assert_failed_after_switch("image mismatch")

    def test_failed_health(self):
        self.host.state["health"][CONF["IMAGE_DIGEST"]]["db"] = "unavailable"
        self.assert_failed_after_switch("did not confirm")

    def test_failed_public_health(self):
        self.host.state["public_health_fails"] = True
        self.assert_failed_after_switch("public health did not confirm")

    def test_worker_not_started(self):
        self.host.state["worker_log"] = "crash"
        self.assert_failed_after_switch("worker did not report start")

    def test_db_recreation_is_critical(self):
        self.host.state["db_recreated_on_up"] = True
        self.assert_failed_after_switch("CRITICAL dev-db-1")

    def test_prod_change_is_critical(self):
        self.host.state["prod_changed_on_up"] = True
        self.assert_failed_after_switch("CRITICAL PROD")

    def test_rollback_restores_image_without_touching_database(self):
        self.assertEqual(self.host.deploy()[0], 0)
        before = len(self.host.mutations())
        fingerprint = self.host.confirm("rollback-preflight")
        code, out = self.host.run("rollback", "--confirm", fingerprint)
        self.assertEqual(code, 0, out)
        self.assertIn("RESULT ROLLED_BACK dev-1329", out)
        new = self.host.mutations()[before:]
        self.assertEqual(len(new), 1)
        self.assertIn("up", new[0])
        self.assertEqual(self.host.state["containers"]["dev-app-1"]["Image"], CONF["ROLLBACK_IMAGE_ID"])
        self.assertEqual(self.host.state["containers"]["dev-worker-1"]["Image"], CONF["ROLLBACK_IMAGE_ID"])
        self.assertEqual(self.host.state["containers"]["dev-db-1"]["Id"], "a" * 64)
        self.assertIn(PENDING, self.host.state["applied"])
        self.assertFalse((self.host.home / "state" / "compose.uat.yml").exists())

    def test_rollback_after_failed_deploy_works_without_backup(self):
        self.host.state["health"][CONF["IMAGE_DIGEST"]]["status"] = "error"
        self.assertNotEqual(self.host.deploy()[0], 0)
        shutil.rmtree(self.host.home / "attestation")
        code, out = self.host.run("rollback", "--confirm", self.host.confirm("rollback-preflight"))
        self.assertEqual(code, 0, out)

    def test_rollback_without_deployment_is_refused(self):
        code, out = self.host.run("rollback-preflight")
        self.assertNotEqual(code, 0)
        self.assertIn("nothing to roll back", out)

    def test_status_changes_nothing(self):
        code, out = self.host.run("status")
        self.assertEqual(code, 0, out)
        self.assertIn("dev-1329 is running", out)
        self.assertEqual(self.host.mutations(), [])


if __name__ == "__main__":
    unittest.main()
