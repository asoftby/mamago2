"""Execution plane scenarios with a fake docker, real flock and real ssh-keygen. Linux only."""
import fcntl
import json
import os
import signal
import subprocess
import tempfile
import time
import unittest
import uuid
from pathlib import Path

from hostfixture import MIGRATIONS, OLD_ID, PENDING, RELEASE, SECRET, Host


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.host = Host(Path(self.tmp.name))

    def tearDown(self):
        # Invariants for every scenario: nothing destructive, DB never a target.
        for call in self.host.calls():
            if call[0] == "compose":
                self.assertFalse({"down", "rm", "stop", "restart", "kill"} & set(call), call)
                if "up" in call:
                    self.assertEqual(call[-2:], ["app", "worker"], call)
                    self.assertIn("--no-deps", call)
            self.assertNotIn(call[0], ("rm", "rmi", "stop", "restart", "kill", "system", "volume", "push", "tag"), call)
        self.tmp.cleanup()

    def projects_acted_on(self):
        return {c[c.index("--project-name") + 1] for c in self.host.mutations() if c[0] == "compose"}


class PreflightTests(Base):
    def not_ready(self, needle, environment="dev", ref="rel:rc3-uat"):
        code, answer = self.host.run("preflight", environment, ref)
        self.assertNotEqual(code, 0, answer)
        self.assertIn(needle, "\n".join(answer["report"]))
        self.assertIsNone(answer.get("fingerprint"))
        self.assertEqual(self.host.mutations(), [])

    def test_ready_read_only_and_leaks_nothing(self):
        code, answer = self.host.run("preflight", "dev", "rel:rc3-uat")
        self.assertEqual(code, 0, answer["report"])
        self.assertEqual(answer["facts"]["host"], "legacy")
        self.assertEqual(answer["facts"]["digest"], RELEASE["image_digest"])
        self.assertEqual(self.host.mutations(), [])
        self.assertNotIn("super-secret-value", json.dumps(answer))

    def test_wrong_tag_digest(self):
        self.host.state["registry_digest"] = "sha256:" + "0" * 64
        self.not_ready("registry tag does not resolve")

    def test_wrong_content_digest(self):
        self.host.state["registry_config"] = "sha256:" + "0" * 64
        self.not_ready("mismatch")

    def test_wrong_sha(self):
        self.host.state["registry_revision"] = "0" * 40
        self.not_ready("mismatch")

    def test_changed_build_id(self):
        self.host.state["registry_build_id"] = "uat-20261127-ffffffffffff"
        self.not_ready("mismatch")

    def test_registry_or_credentials_failure(self):
        self.host.state["registry_down"] = True
        self.not_ready("registry tag does not resolve")

    def test_missing_backup(self):
        (self.host.root / "dev-attestation" / "backup.manifest.sig").unlink()
        self.not_ready("attestation is missing")

    def test_edited_backup_note(self):
        manifest = self.host.root / "dev-attestation" / "backup.manifest"
        manifest.write_text(manifest.read_text() + "note=trust me\n")
        self.not_ready("signature is invalid")

    def test_backup_signed_by_unknown_key(self):
        other = self.host.root / "other"
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(other)], check=True)
        self.host.attest("dev", key=other)
        self.not_ready("signature is invalid")

    def test_stale_backup(self):
        self.host.attest("dev", created_utc="2020-01-01T00:00:00Z")
        self.not_ready("h old")

    def test_backup_of_another_database_environment_or_host(self):
        for override, needle in (({"db_container_id": "9" * 64}, "another database"),
                                 ({"environment": "prod"}, "another environment or host"),
                                 ({"host_id": "hoster"}, "another environment or host")):
            self.host.attest("dev", **override)
            self.not_ready(needle)

    def test_low_disk(self):
        self.host.environments["dev"]["min_free_gb"] = 10**6
        self.host.write_config()
        self.not_ready("free disk below")

    def test_unhealthy_db(self):
        self.host.state["containers"]["dev-db-1"]["Health"] = "unhealthy"
        self.not_ready("dev-db-1 not healthy")

    def test_release_flag_enabled(self):
        env = self.host.state["compose"]["app"]["environment"]
        self.host.state["compose"]["app"]["environment"] = {**env, "ENABLE_PUBLIC_BIRTHDAY": "true"}
        self.not_ready("ENABLE_PUBLIC_BIRTHDAY is enabled")

    def test_db_definition_would_change(self):
        self.host.state["override_touches_db"] = True
        self.not_ready("would change more than application images")

    def test_auto_loaded_override_file(self):
        (self.host.root / "dev" / "docker-compose.override.yml").write_text("services: {}\n")
        self.not_ready("auto-loaded")

    def test_missing_rollback_image(self):
        self.host.state["images"] = {}
        self.not_ready("not available locally for rollback")

    def test_app_worker_differ(self):
        self.host.state["containers"]["dev-worker-1"]["Image"] = "sha256:" + "d" * 64
        self.not_ready("missing or differ")

    def test_unknown_migration(self):
        self.host.state["applied"] += ["20990101000000_unknown"]
        self.not_ready("unknown to the release")

    def test_unexpected_pending_migration(self):
        self.host.state["applied"] = self.host.state["applied"][1:]
        self.not_ready("unexpected pending migrations")

    def test_failed_migration_recorded(self):
        self.host.state["broken_migrations"] = 1
        self.not_ready("unfinished or failed migration")

    def test_db_query_failure(self):
        self.host.state["db_query_fails"] = True
        self.not_ready("cannot read migration history")

    def test_release_not_approved_for_prod(self):
        code, answer = self.host.run("preflight", "prod", "rel:rc3-uat")
        self.assertEqual(code, 2)
        self.assertIn("not approved for prod", answer["error"])

    def test_prod_refuses_tags(self):
        for ref in ("tag:prod-1124", "tag:dev-1329"):
            code, answer = self.host.run("preflight", "prod", ref)
            self.assertEqual(code, 2)
            self.assertIn("only approved release manifests", answer["error"])

    def test_unknown_environment_release_and_path_traversal(self):
        for command in (("preflight", "staging", "rel:rc3-uat"), ("preflight", "dev", "rel:../host"),
                        ("preflight", "dev", "rel:/etc/passwd"), ("preflight", "dev", "tag:prod-1"),
                        ("preflight", "dev", "latest"), ("logs", "dev", "../../etc"), ("logs", "dev", "db"),
                        ("result", "dev", "../../host"), ("deploy", "dev"), ("preflight", "dev", "rel:rc3-uat", "extra")):
            code, answer = self.host.run(*command)
            self.assertEqual(code, 2, (command, answer))
        self.assertEqual(self.host.mutations(), [])

    def test_environment_not_hosted_here(self):
        host = Host(Path(self.tmp.name) / "second", host_id="hoster", environments=("dev",))
        code, answer = host.run("preflight", "prod", "rel:rc3-uat")
        self.assertIn("not hosted on hoster", answer["error"])

    def test_unprotected_or_unknown_configuration_is_refused(self):
        self.host.config_path.chmod(0o666)
        self.assertEqual(self.host.run("status", "dev")[0], 2)
        self.host.write_config(surprise=True)
        self.assertEqual(self.host.run("status", "dev")[0], 2)
        self.host.write_config()
        self.host.write_release({**RELEASE, "image_tag": "latest"})
        self.assertEqual(self.host.run("preflight", "dev", "rel:rc3-uat")[0], 2)

    def test_caller_environment_cannot_redirect_compose(self):
        code, answer = self.host.run("preflight", "dev", "rel:rc3-uat", COMPOSE_PROJECT_NAME="prod",
                                     COMPOSE_FILE="/opt/mamago/prod/docker-compose.yml", APP_VERSION="prod-1124")
        self.assertEqual(code, 0, answer)


class DeployTests(Base):
    def test_successful_uat_deploy(self):
        result = self.host.deploy()
        self.assertEqual(result["state"], "succeeded", result["report"])
        self.assertEqual(self.host.image("dev-app-1"), RELEASE["image_digest"])
        self.assertEqual(self.host.image("prod-app-1"), OLD_ID)
        self.assertEqual(self.projects_acted_on(), {"dev"})
        kinds = [("pull" if c[0] == "pull" else "run" if "run" in c else "up") for c in self.host.mutations()]
        self.assertEqual(kinds, ["pull", "run", "up"])
        self.assertFalse(any("db:seed:system" in c for c in self.host.calls()))
        self.assertIn("APP_VERSION=dev-1\n", (self.host.root / "dev" / ".env").read_text())
        dumps = list((self.host.state_dir / "dev" / "backups").glob("*.sql.gz"))
        self.assertEqual(len(dumps), 1)
        self.assertEqual(dumps[0].stat().st_mode & 0o777, 0o600)
        log = (self.host.state_dir / "dev" / "executor.log").read_text()
        self.assertIn("actor=telegram:42 deploy succeeded", log)
        self.assertNotIn("super-secret-value", log + json.dumps(result))

    def test_tag_deploy_pins_digest_and_records_version(self):
        digest = "sha256:" + "7" * 64
        self.host.state.update(tags={"dev-9": digest}, registry_build_id="dev-9", pulled_build_id="dev-9", pulled_id=digest)
        self.host.state["health"][digest] = {"status": "ok", "db": "ok", "gitSha": RELEASE["source_sha"], "buildId": "dev-9"}
        result = self.host.deploy("tag:dev-9")
        self.assertEqual(result["state"], "succeeded", result["report"])
        self.assertIn(["pull", f"ghcr.io/asoftby/mamago2@{digest}"], self.host.calls())
        self.assertIn("APP_VERSION=dev-9\n", (self.host.root / "dev" / ".env").read_text())

    def test_tag_moved_after_confirmation(self):
        digest = "sha256:" + "7" * 64
        self.host.state.update(tags={"dev-9": digest}, registry_build_id="dev-9", pulled_build_id="dev-9")
        confirmed = self.host.fingerprint("preflight", "dev", "tag:dev-9")
        self.host.state["tags"]["dev-9"] = "sha256:" + "8" * 64
        result = self.host.deploy("tag:dev-9", confirm=confirmed)
        self.assertEqual(result["state"], "failed")
        self.assertEqual(self.host.mutations(), [])

    def test_prod_deploys_only_with_manifest_and_attestation(self):
        release = {**RELEASE, "id": "prod-7", "environments": ["prod"], "mode": "standard", "image_tag": "prod-7",
                   "forbidden_true_env": [], "required_nonempty_env": []}
        self.host.write_release(release)
        code, answer = self.host.run("preflight", "prod", "rel:prod-7")
        self.assertIn("attestation is missing", "\n".join(answer["report"]))
        self.host.attest("prod", release=release)
        result = self.host.deploy("rel:prod-7", environment="prod")
        self.assertEqual(result["state"], "succeeded", result["report"])
        self.assertEqual(self.projects_acted_on(), {"prod"})
        self.assertEqual(self.host.image("dev-app-1"), OLD_ID)

    def test_wrong_confirmation(self):
        result = self.host.deploy(confirm="0" * 16)
        self.assertIn("state changed since confirmation", "\n".join(result["report"]))
        self.assertEqual(self.host.mutations(), [])

    def test_state_change_after_confirmation(self):
        confirmed = self.host.fingerprint("preflight", "dev", "rel:rc3-uat")
        with (self.host.root / "dev" / ".env").open("a") as stream:
            stream.write("X=1\n")
        self.assertEqual(self.host.deploy(confirm=confirmed)["state"], "failed")
        self.assertEqual(self.host.mutations(), [])

    def test_same_operation_id_never_runs_twice(self):
        confirmed, opid = self.host.fingerprint("preflight", "dev", "rel:rc3-uat"), uuid.uuid4().hex
        self.assertEqual(self.host.deploy(confirm=confirmed, opid=opid)["state"], "succeeded")
        before = len(self.host.mutations())
        code, again = self.host.run("submit-deploy", "dev", "rel:rc3-uat", confirmed, opid, "telegram:42")
        self.assertEqual(again["state"], "succeeded")
        self.assertEqual(len(self.host.mutations()), before)

    def test_confirmation_cannot_be_reused_with_a_new_id(self):
        confirmed = self.host.fingerprint("preflight", "dev", "rel:rc3-uat")
        self.assertEqual(self.host.deploy(confirm=confirmed)["state"], "succeeded")
        before = len(self.host.mutations())
        self.assertEqual(self.host.deploy(confirm=confirmed)["state"], "failed")
        self.assertEqual(len(self.host.mutations()), before)

    def test_host_lock_blocks_every_environment(self):
        confirmed = self.host.fingerprint("preflight", "dev", "rel:rc3-uat")
        with open(self.host.root / "lock", "a") as held:
            fcntl.flock(held, fcntl.LOCK_EX)
            for command in (("preflight", "dev", "rel:rc3-uat"), ("rollback-preflight", "prod"),
                            ("submit-deploy", "dev", "rel:rc3-uat", confirmed, uuid.uuid4().hex, "manual")):
                code, answer = self.host.run(*command)
                self.assertEqual(code, 2, answer)
                self.assertIn("another deploy or rollback", answer["error"])
        self.assertEqual(self.host.mutations(), [])

    def test_killed_worker_is_unknown_never_success(self):
        confirmed, opid = self.host.fingerprint("preflight", "dev", "rel:rc3-uat"), uuid.uuid4().hex
        self.host.state["migration_slow"] = 3
        self.host.submit("submit-deploy", "dev", "rel:rc3-uat", confirmed, opid, "manual")
        record_path = self.host.state_dir / "dev" / "ops" / f"{opid}.json"
        for _ in range(100):
            record = json.loads(record_path.read_text())
            if record.get("pid") and any("run" in c for c in self.host.mutations()):
                break
            time.sleep(0.05)
        os.kill(record["pid"], signal.SIGKILL)
        time.sleep(0.3)
        self.assertEqual(self.host.run("result", "dev", opid, sync=False)[1]["state"], "unknown")

    def test_wrong_pulled_image(self):
        self.host.state["pulled_build_id"] = "dev-9"
        result = self.host.deploy()
        self.assertIn("identity mismatch", "\n".join(result["report"]))
        self.assertEqual([c[0] for c in self.host.mutations()], ["pull"])

    def test_failed_local_dump_stops_before_migration(self):
        self.host.state["dump_fails"] = True
        result = self.host.deploy()
        self.assertIn("database dump failed", "\n".join(result["report"]))
        self.assertEqual([c[0] for c in self.host.mutations()], ["pull"])

    def test_migration_error_leaves_application_untouched(self):
        self.host.state["migration_fails"] = True
        result = self.host.deploy()
        self.assertIn("NOT switched", "\n".join(result["report"]))
        self.assertFalse(any("up" in c for c in self.host.mutations()))
        self.assertEqual(self.host.image("dev-app-1"), OLD_ID)

    def failed_after_switch(self, needle):
        result = self.host.deploy()
        self.assertEqual(result["state"], "failed", result["report"])
        self.assertIn(needle, "\n".join(result["report"]))

    def test_app_worker_mismatch(self):
        self.host.state["worker_stays_old"] = True
        self.failed_after_switch("image mismatch")

    def test_failed_health(self):
        self.host.state["health"][RELEASE["image_digest"]]["db"] = "unavailable"
        self.failed_after_switch("did not confirm")

    def test_failed_public_health(self):
        self.host.state["public_health_fails"] = True
        self.failed_after_switch("public health did not confirm")

    def test_worker_not_started(self):
        self.host.state["worker_log"] = "crash"
        self.failed_after_switch("worker did not report start")

    def test_db_recreation_is_critical(self):
        self.host.state["db_recreated_on_up"] = True
        self.failed_after_switch("CRITICAL dev-db-1")

    def test_other_environment_change_is_critical(self):
        self.host.state["other_env_changed_on_up"] = True
        self.failed_after_switch("CRITICAL another environment")

    def test_seed_only_when_the_release_declares_it(self):
        self.host.write_release({**RELEASE, "seed": True})
        self.assertEqual(self.host.deploy()["state"], "succeeded")
        self.assertTrue(any("db:seed:system" in c for c in self.host.calls()))


class RollbackTests(Base):
    def test_rollback_restores_previous_image_without_touching_database(self):
        self.assertEqual(self.host.deploy()["state"], "succeeded")
        before = len(self.host.mutations())
        result = self.host.rollback()
        self.assertEqual(result["state"], "succeeded", result["report"])
        new = self.host.mutations()[before:]
        self.assertEqual(len(new), 1)
        self.assertIn("up", new[0])
        self.assertEqual((self.host.image("dev-app-1"), self.host.image("dev-worker-1")), (OLD_ID, OLD_ID))
        self.assertIn(PENDING, self.host.state["applied"])

    def test_rollback_after_failed_deploy_needs_no_backup(self):
        self.host.state["health"][RELEASE["image_digest"]]["status"] = "error"
        self.assertEqual(self.host.deploy()["state"], "failed")
        (self.host.root / "dev-attestation" / "backup.manifest").unlink()
        self.assertEqual(self.host.rollback()["state"], "succeeded")

    def test_nothing_to_roll_back(self):
        code, answer = self.host.run("rollback-preflight", "dev")
        self.assertNotEqual(code, 0)
        self.assertIn("nothing to roll back", "\n".join(answer["report"]))

    def test_incompatible_release_refuses_application_rollback(self):
        self.host.write_release({**RELEASE, "rollback_compatible": False})
        self.assertEqual(self.host.deploy()["state"], "succeeded")
        code, answer = self.host.run("rollback-preflight", "dev")
        self.assertNotEqual(code, 0)
        self.assertIn("not rollback compatible", "\n".join(answer["report"]))

    def test_rollback_failure_is_reported(self):
        self.assertEqual(self.host.deploy()["state"], "succeeded")
        confirmed = self.host.fingerprint("rollback-preflight", "dev")
        self.host.state["up_fails"] = True
        result = self.host.rollback(confirm=confirmed)
        self.assertEqual(result["state"], "failed")
        self.assertIn("container switch failed", "\n".join(result["report"]))


class ViewTests(Base):
    def test_status_changes_nothing(self):
        code, answer = self.host.run("status", "dev")
        self.assertEqual(code, 0, answer)
        self.assertIn("build=dev-1", "\n".join(answer["report"]))
        self.assertEqual(self.host.mutations(), [])

    def test_logs_are_limited_to_allowed_services_and_redacted(self):
        code, answer = self.host.run("logs", "dev", "app")
        self.assertEqual(code, 0, answer)
        text = "\n".join(answer["report"])
        for leak in ("topsecret", "a.person@example.by", "123-45-67"):
            self.assertNotIn(leak, text)

    def test_releases_lists_only_this_environment(self):
        self.assertEqual([r["id"] for r in self.host.run("releases", "dev")[1]["releases"]], ["rc3-uat"])
        self.assertEqual(self.host.run("releases", "prod")[1]["releases"], [])


if __name__ == "__main__":
    unittest.main()
