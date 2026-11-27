"""A disposable fake host: config, releases, compose directories and fake docker."""
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path

TESTS = Path(__file__).resolve().parent
ROOT = TESTS.parent
sys.path.insert(0, str(ROOT))

RELEASE = json.loads((ROOT / "releases" / "rc3-uat.json").read_text())
MIGRATIONS = (ROOT / "releases" / "rc3-uat.migrations").read_text().split()
PENDING = RELEASE["expected_pending"][0]
SECRET = "postgresql://dev:super-secret-value@db:5432/dev"
OLD_ID = "sha256:" + "c" * 64
OLD_SHA = "4" * 40


class Host:
    def __init__(self, root: Path, host_id="legacy", environments=("dev", "prod")):
        self.root, self.host_id = root, host_id
        self.releases, self.state_dir, self.bin = root / "releases", root / "state", root / "bin"
        for directory in (self.releases, self.state_dir, self.bin):
            directory.mkdir(parents=True)
        shutil.copy(ROOT / "releases" / "rc3-uat.migrations", self.releases)
        self.write_release(RELEASE)
        for name, source in (("docker", "fake_docker.py"), ("curl", "fake_curl.py")):
            shutil.copy(TESTS / source, self.bin / name)
            (self.bin / name).chmod(0o755)
        self.signer = root / "signer"
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(self.signer)], check=True)
        (root / "allowed_signers").write_text("uat-backup " + Path(str(self.signer) + ".pub").read_text())
        self.environments = {}
        for name in environments:
            compose = root / name
            compose.mkdir()
            (compose / "docker-compose.yml").write_text("services: {}\n")
            (compose / ".env").write_text(f"APP_VERSION={name}-1\nDATABASE_URL={SECRET}\n")
            self.environments[name] = {
                "compose_dir": str(compose), "project": name, "db_container": f"{name}-db-1",
                "image_repo": "ghcr.io/asoftby/mamago2", "tag_deploy": name == "dev",
                "log_services": ["app", "worker"], "public_health_url": f"https://{name}.example.test/api/health",
                "required_env": {"APP_ENV": "dev"} if name == "dev" else {},
                "min_free_gb": 1, "require_attestation": name == "prod", "local_dump": True, "backup_max_age_hours": 24,
                "attestation_dir": str(root / f"{name}-attestation"), "allowed_signers": str(root / "allowed_signers")}
        self.config_path = root / "host.json"
        self.write_config()
        env = {"APP_ENV": "dev", "DATABASE_URL": SECRET, "BOOST_PRICE_1D_BYN": "1", "BOOST_PRICE_3D_BYN": "2", "BOOST_PRICE_7D_BYN": "3"}
        released = RELEASE["image_digest"]
        containers = {}
        for index, name in enumerate(("dev", "prod")):
            for service in ("app", "worker", "db"):
                containers[f"{name}-{service}-1"] = {"Id": f"{index}{service[0]}".ljust(64, "0"), "StartedAt": "t0", "Project": name,
                                                      "Health": "healthy", "Image": OLD_ID, "ImageRef": f"ghcr.io/asoftby/mamago2:{name}-1"}
        self.state = {
            "rollback_id": OLD_ID, "containers": containers,
            "images": {"ghcr.io/asoftby/mamago2:dev-1": OLD_ID, "ghcr.io/asoftby/mamago2:prod-1": OLD_ID},
            "compose": {"db": {"image": "postgres:16-alpine"}, "migrate": {"image": "old"},
                        "app": {"image": "old", "environment": env}, "worker": {"image": "old", "environment": env}},
            "registry_digest": released, "registry_config": RELEASE["config_digest"], "registry_revision": RELEASE["source_sha"],
            "registry_build_id": RELEASE["build_id"], "pulled_id": released, "pulled_revision": RELEASE["source_sha"],
            "pulled_build_id": RELEASE["build_id"], "applied": sorted(m for m in MIGRATIONS if m != PENDING),
            "release_migrations": MIGRATIONS,
            "health": {released: {"status": "ok", "db": "ok", "gitSha": RELEASE["source_sha"], "buildId": RELEASE["build_id"]},
                       OLD_ID: {"status": "ok", "db": "ok", "gitSha": OLD_SHA, "buildId": "dev-1"}},
        }
        self.state_path = root / "state.json"
        self.save()
        self.attest("dev")

    def write_config(self, **overrides):
        self.config_path.write_text(json.dumps({
            "host_id": self.host_id, "state_dir": str(self.state_dir), "releases_dir": str(self.releases),
            "lock_file": str(self.root / "lock"), "health_attempts": 2, "health_delay": 0, "settle_seconds": 0,
            "environments": self.environments, **overrides}))
        self.config_path.chmod(0o600)

    def write_release(self, release):
        path = self.releases / f"{release['id']}.json"
        path.write_text(json.dumps(release))
        path.chmod(0o600)

    def save(self):
        self.state_path.write_text(json.dumps(self.state))

    def submit(self, *command):
        """Starts a detached operation; the state is reloaded by wait()."""
        self.save()
        return self.run(*command, sync=False)

    def reload(self):
        self.state = json.loads(self.state_path.read_text())

    def attest(self, env_name, key=None, release=RELEASE, **overrides):
        environment = env_name
        directory = self.root / f"{environment}-attestation"
        directory.mkdir(exist_ok=True)
        data = {"db_sha256": "1" * 64, "db_bytes": "10", "media_sha256": "2" * 64, "media_bytes": "10",
                "created_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "restore_check": "PASS",
                "environment": environment, "host_id": self.host_id,
                "db_container_id": f"{0 if environment == 'dev' else 1}d".ljust(64, "0"),
                "release_digest": release["image_digest"], **overrides}
        manifest = directory / "backup.manifest"
        manifest.write_text("".join(f"{k}={v}\n" for k, v in data.items()))
        Path(str(manifest) + ".sig").unlink(missing_ok=True)
        subprocess.run(["ssh-keygen", "-Y", "sign", "-f", str(key or self.signer), "-n", "mamago-uat-backup", str(manifest)],
                       check=True, capture_output=True)

    def env_vars(self, **extra):
        return {"PATH": f"{self.bin}:{Path(sys.executable).parent}:/usr/bin:/bin", "FAKE_STATE": str(self.state_path), **extra}

    def run(self, *command, sync=True, **extra):
        """sync=False while a detached worker owns the fake state: do not overwrite it."""
        if sync:
            self.save()
        done = subprocess.run([sys.executable, "-B", "-m", "mamago_deploy.executor", "--config", str(self.config_path), *command],
                              cwd=str(ROOT), env=self.env_vars(**extra), capture_output=True, text=True, timeout=60)
        if sync:
            self.reload()
        return done.returncode, json.loads(done.stdout.splitlines()[-1])

    def wait(self, environment, opid):
        for _ in range(600):
            code, answer = self.run("result", environment, opid, sync=False)
            if answer["state"] != "running":
                self.reload()
                return answer
            time.sleep(0.05)
        raise AssertionError("operation did not finish")

    def fingerprint(self, *command):
        code, answer = self.run(*command)
        assert code == 0, answer["report"]
        return answer["fingerprint"]

    def deploy(self, ref="rel:rc3-uat", environment="dev", confirm=None, opid=None):
        confirm = confirm or self.fingerprint("preflight", environment, ref)
        opid = opid or uuid.uuid4().hex
        code, answer = self.submit("submit-deploy", environment, ref, confirm, opid, "telegram:42")
        if code == 2:
            return answer
        return self.wait(environment, opid)

    def rollback(self, environment="dev", confirm=None):
        confirm = confirm or self.fingerprint("rollback-preflight", environment)
        opid = uuid.uuid4().hex
        self.submit("submit-rollback", environment, confirm, opid, "telegram:42")
        return self.wait(environment, opid)

    def calls(self):
        log = Path(str(self.state_path) + ".log")
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    def mutations(self):
        return [c for c in self.calls() if c[0] == "pull" or (c[0] == "compose" and ("up" in c or "run" in c))]

    def image(self, name):
        return self.state["containers"][name]["Image"]
