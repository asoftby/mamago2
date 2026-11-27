"""Execution plane: runs on the target host, trusts nothing from the caller.

It checks for itself that the environment is hosted here, that the release is
allowed, and that the state still matches what the owner confirmed. Every
Compose call is pinned to the environment's project; the database container is
never recreated, nothing is pruned, and a database is never restored.
"""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import gzip
import hashlib
import json
import os
import signal
import stat
import subprocess
import sys
import tempfile
import threading
import time
import zlib
from pathlib import Path

from .common import ACTOR, BUILD_TAG, COMMIT, DIGEST, FINGERPRINT, OPID, RELEASE_ID, SERVICE, Refused, redact
from .config import HostConfig, load_release

DEFAULT_CONFIG = "/etc/mamago-deploy/host.json"
LOG_TAIL = 200
DUMP_TIMEOUT = 1800
# A worker that has not claimed its operation by then must never run it; the
# longer limit is when readers start calling such an operation unknown.
CLAIM_DEADLINE = 20
CLAIM_GRACE = 30
DUMP_MARKER = b"PostgreSQL database dump complete"
AUTO_LOADED = ("docker-compose.override.yml", "compose.override.yaml", "compose.override.yml", "compose.yaml", "compose.yml")
STRIPPED_ENV = ("APP_VERSION", "COMPOSE_FILE", "COMPOSE_PROJECT_NAME", "COMPOSE_PROFILES", "COMPOSE_ENV_FILES", "DOCKER_HOST", "DOCKER_CONTEXT")


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def kill_group(process: subprocess.Popen):
    """The command and everything it started (docker compose runs plugins)."""
    with contextlib.suppress(ProcessLookupError, PermissionError):
        os.killpg(process.pid, signal.SIGKILL)


def sh(argv: list[str], timeout: int = 900, env: dict | None = None, **kwargs) -> subprocess.CompletedProcess:
    base = {k: v for k, v in os.environ.items() if k not in STRIPPED_ENV}
    try:
        process = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, errors="replace", env={**base, **(env or {})}, start_new_session=True, **kwargs)
    except OSError as error:
        return subprocess.CompletedProcess(argv, 127, "", type(error).__name__)
    try:
        out, err = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        kill_group(process)
        with contextlib.suppress(subprocess.TimeoutExpired):
            process.communicate(timeout=10)
        return subprocess.CompletedProcess(argv, 124, "", "timeout")
    return subprocess.CompletedProcess(argv, process.returncode, out, err)


class Report:
    def __init__(self):
        self.lines: list[str] = []
        self.failures = 0

    def ok(self, text: str):
        self.lines.append(f"PASS {text}")

    def fail(self, text: str):
        self.lines.append(f"FAIL {text}")
        self.failures += 1

    def note(self, text: str):
        self.lines.append(text)

    def check(self, condition: bool, good: str, bad: str) -> bool:
        self.ok(good) if condition else self.fail(bad)
        return condition


class Environment:
    def __init__(self, host: HostConfig, name: str):
        self.host, self.name = host, name
        self.cfg = host.environment(name)
        self.dir = Path(self.cfg["compose_dir"])
        self.project = self.cfg["project"]
        self.repo = self.cfg["image_repo"]
        self.state = Path(host.data["state_dir"]) / name
        self.releases = Path(host.data["releases_dir"])
        self.base_file = self.dir / "docker-compose.yml"

    # --- docker -------------------------------------------------------------
    def container(self, service: str) -> str:
        return f"{self.project}-{service}-1"

    def inspect(self, name: str, fmt: str) -> str:
        done = sh(["docker", "inspect", "--type", "container", "--format", fmt, name], timeout=60)
        return done.stdout.strip() if done.returncode == 0 else ""

    def compose(self, *args: str, override: Path | None = None, env: dict | None = None, timeout: int = 900):
        argv = ["docker", "compose", "--project-name", self.project, "--project-directory", str(self.dir), "-f", str(self.base_file)]
        if override:
            argv += ["-f", str(override)]
        return sh(argv + list(args), env=env, timeout=timeout, cwd=str(self.dir))

    def image_id(self, ref: str) -> str:
        done = sh(["docker", "image", "inspect", "--format", "{{.Id}}", ref], timeout=60)
        return done.stdout.strip() if done.returncode == 0 else ""

    def db_identity(self) -> str:
        return self.inspect(self.cfg["db_container"], "{{.Id}} {{.State.StartedAt}}")

    def neighbours(self) -> str:
        """Identity of every other configured environment's containers on this host."""
        others = sorted(e["project"] for n, e in self.host.data["environments"].items() if n != self.name)
        found = []
        for project in others:
            listed = sh(["docker", "ps", "-q", "--no-trunc", "--filter", f"label=com.docker.compose.project={project}"], timeout=60)
            for cid in sorted(listed.stdout.split()):
                found.append(self.inspect(cid, "{{.Id}} {{.State.StartedAt}}"))
        return "\n".join(found)

    def current(self) -> tuple[str, str]:
        return self.inspect(self.container("app"), "{{.Image}}"), self.inspect(self.container("worker"), "{{.Image}}")

    def write_override(self, target: Path, image: str):
        target.parent.mkdir(parents=True, exist_ok=True)
        body = "services:\n" + "".join(f'  {s}:\n    image: "{image}"\n' for s in ("migrate", "app", "worker"))
        temporary = target.with_suffix(".tmp")
        temporary.write_text(body, encoding="utf-8")
        os.replace(temporary, target)

    # --- health -------------------------------------------------------------
    def internal_health(self) -> str:
        script = ('fetch("http://127.0.0.1:3000/api/health",{cache:"no-store"}).then(async r=>{if(!r.ok)process.exit(2);'
                  'process.stdout.write(await r.text())}).catch(()=>process.exit(3))')
        return sh(["docker", "exec", self.container("app"), "node", "-e", script], timeout=20).stdout

    def public_health(self) -> str:
        url = self.cfg["public_health_url"]
        argv = ["curl", "-fsS", "--connect-timeout", "2", "--max-time", "5", "-H", "Cache-Control: no-cache"]
        if self.cfg.get("resolve_public_to"):
            argv += ["--resolve", f"{url.split('/')[2]}:443:{self.cfg['resolve_public_to']}"]
        return sh(argv + [url], timeout=20).stdout

    @staticmethod
    def parse_health(body: str) -> dict:
        try:
            data = json.loads(body)
            return data if isinstance(data, dict) else {}
        except ValueError:
            return {}

    def wait_health(self, report: Report, label: str, probe, sha: str, build: str):
        for _ in range(self.host.data.get("health_attempts", 60)):
            data = self.parse_health(probe())
            if (data.get("status"), data.get("db"), data.get("gitSha"), data.get("buildId")) == ("ok", "ok", sha, build):
                report.ok(f"{label}: ok, db ok, SHA {sha[:12]}, Build ID {build}")
                return
            time.sleep(self.host.data.get("health_delay", 2))
        report.fail(f"{label} did not confirm SHA {sha[:12]} / Build ID {build}")

    def verify_fleet(self, report: Report, accepted: set[str], sha: str, build: str):
        time.sleep(self.host.data.get("settle_seconds", 20))
        app, worker = self.current()
        report.check(bool(app) and app == worker and app in accepted,
                     f"app and worker run the same expected image ({app[:19]})",
                     f"app/worker image mismatch (app={app[:19]} worker={worker[:19]})")
        for service in ("app", "worker"):
            status = self.inspect(self.container(service), "{{.State.Status}}")
            restarts = self.inspect(self.container(service), "{{.RestartCount}}")
            report.check(status == "running" and restarts == "0", f"{service} running, no restarts",
                         f"{service} is {status or 'missing'}, restarts={restarts or '?'}")
        logs = sh(["docker", "logs", self.container("worker")], timeout=60)
        report.check("[worker] started" in logs.stdout + logs.stderr, "worker reported start", "worker did not report start")
        self.wait_health(report, "internal health", self.internal_health, sha, build)
        self.wait_health(report, "public health", self.public_health, sha, build)


# --- target resolution -------------------------------------------------------
def resolve_target(env: Environment, ref: str) -> dict:
    """ref is 'rel:<id>' (allowlisted manifest) or 'tag:<dev-N>' where permitted."""
    kind, _, value = ref.partition(":")
    if kind == "rel":
        release = load_release(env.releases, value)
        if env.name not in release["environments"]:
            raise Refused(f"release {value} is not approved for {env.name}")
        release["ref_tag"] = release["image_tag"]
        return release
    if kind == "tag":
        if not env.cfg["tag_deploy"] or env.name == "prod":
            raise Refused(f"{env.name} deploys only approved release manifests")
        if not BUILD_TAG.fullmatch(value) or not value.startswith(env.name + "-"):
            raise Refused("tag does not belong to this environment")
        done = sh(["docker", "buildx", "imagetools", "inspect", f"{env.repo}:{value}", "--format", "{{json .Manifest.Digest}}"], timeout=90)
        digest = done.stdout.strip().strip('"')
        if done.returncode or not DIGEST.fullmatch(digest):
            raise Refused("cannot resolve the tag to a digest")
        meta = image_metadata(env, digest)
        sha = meta.get("revision", "")
        if not COMMIT.fullmatch(sha) or meta.get("BUILD_ID") != value:
            raise Refused("image does not carry the SHA and Build ID of this tag")
        return {"id": value, "mode": "standard", "image_digest": digest, "ref_tag": value, "source_sha": sha,
                "build_id": value, "migrations": None, "expected_pending": None, "seed": False,
                "rollback_compatible": None, "raw": digest.encode()}
    raise Refused("unknown target reference")


def image_metadata(env: Environment, digest: str) -> dict:
    done = sh(["docker", "buildx", "imagetools", "inspect", f"{env.repo}@{digest}", "--format", "{{json .Image}}"], timeout=90)
    try:
        image = json.loads(done.stdout)
        config = image.get("config") or {}
        values = dict(item.split("=", 1) for item in config.get("Env", []))
        return {"revision": (config.get("Labels") or {}).get("org.opencontainers.image.revision", ""),
                "BUILD_ID": values.get("BUILD_ID"), "GIT_COMMIT_SHA": values.get("GIT_COMMIT_SHA"),
                "platform": f"{image.get('os')}/{image.get('architecture')}"}
    except (ValueError, AttributeError):
        return {}


def accepted_ids(target: dict) -> set[str]:
    # containerd image store reports the manifest digest, the classic store the config digest.
    return {i for i in (target.get("image_digest"), target.get("config_digest")) if i}


# --- checks ------------------------------------------------------------------
def compose_config(env: Environment, override: Path | None = None) -> dict | None:
    done = env.compose("config", "--format", "json", override=override, timeout=90)
    try:
        return json.loads(done.stdout) if done.returncode == 0 else None
    except ValueError:
        return None


def check_trusted_paths(env: Environment, report: Report):
    """Whoever can write these files decides what the Docker daemon runs."""
    open_paths = []
    for path in (env.dir, env.base_file, env.dir / ".env"):
        with contextlib.suppress(FileNotFoundError):
            if path.stat().st_mode & stat.S_IWOTH:
                open_paths.append(path.name)
    report.check(not open_paths, "Compose directory and files are not writable by every user",
                 f"writable by every user: {', '.join(open_paths)}")


def check_no_leftovers(env: Environment, report: Report):
    """A migration or seed container outlives a killed or timed-out command."""
    listed = sh(["docker", "ps", "-q", "--filter", f"label=com.docker.compose.project={env.project}",
                 "--filter", "label=com.docker.compose.oneoff=True"], timeout=60)
    report.check(listed.returncode == 0 and not listed.stdout.split(), "no one-off container (migration or seed) is running",
                 "a one-off container (migration or seed) is still running, or Docker cannot tell")


def check_layout_and_compose(env: Environment, report: Report, image: str) -> dict | None:
    check_trusted_paths(env, report)
    report.check(env.base_file.is_file() and not any((env.dir / n).exists() for n in AUTO_LOADED),
                 "Compose layout as expected", "Compose file missing or an unexpected auto-loaded file exists")
    base = compose_config(env)
    with tempfile.TemporaryDirectory() as scratch:
        override = Path(scratch) / "override.yml"
        env.write_override(override, image)
        changed = compose_config(env, override)
    if base is None or changed is None:
        report.fail("Compose configuration does not render")
        return None
    same = (base.get("name") == env.project and changed.get("name") == env.project
            and set(base["services"]) == set(changed["services"])
            and {"db", "app", "worker", "migrate"} <= set(base["services"])
            and base.get("volumes") == changed.get("volumes") and base.get("networks") == changed.get("networks"))
    for name, service in (base["services"].items() if same else ()):
        other = changed["services"][name]
        if name in ("app", "worker", "migrate"):
            same &= other.get("image") == image and {k: v for k, v in service.items() if k != "image"} == {k: v for k, v in other.items() if k != "image"}
        else:
            same &= service == other
    report.check(same, "override changes only app, worker and migrate images; db definition unchanged",
                 "override would change more than application images")
    return base


def check_env_values(env: Environment, report: Report, config: dict | None, target: dict):
    """Values are compared, never printed."""
    if config is None:
        report.fail("environment not checked")
        return
    problems = []
    for service in ("app", "worker"):
        values = config["services"].get(service, {}).get("environment") or {}
        for key, want in env.cfg["required_env"].items():
            if values.get(key) != want:
                problems.append(f"{service}: {key} is not the required value")
        for flag in target.get("forbidden_true_env", []):
            if str(values.get(flag) or "").strip().lower() == "true":
                problems.append(f"{service}: {flag} is enabled")
    app = config["services"].get("app", {}).get("environment") or {}
    problems += [f"app: {k} is not set" for k in target.get("required_nonempty_env", []) if not str(app.get(k) or "").strip()]
    for line in problems:
        report.note("  " + line)
    report.check(not problems, "environment values meet the requirements", "environment does not meet the requirements")


def check_db(env: Environment, report: Report):
    health = env.inspect(env.cfg["db_container"], "{{if .State.Health}}{{.State.Health.Status}}{{end}}")
    project = env.inspect(env.cfg["db_container"], '{{index .Config.Labels "com.docker.compose.project"}}')
    report.check(health == "healthy" and project == env.project, f"{env.cfg['db_container']} healthy",
                 f"{env.cfg['db_container']} not healthy (health={health or 'missing'})")


def check_disk(env: Environment, report: Report):
    root = sh(["docker", "info", "--format", "{{.DockerRootDir}}"], timeout=60).stdout.strip()
    stats = os.statvfs(root if os.path.isdir(root) else "/")
    free = stats.f_bavail * stats.f_frsize // 1024**3
    need = env.cfg["min_free_gb"]
    report.check(free >= need, f"free disk {free} GB (minimum {need})", f"free disk below {need} GB ({free} GB)")


def check_registry(env: Environment, report: Report, target: dict):
    digest = target["image_digest"]
    done = sh(["docker", "buildx", "imagetools", "inspect", f"{env.repo}:{target['ref_tag']}", "--format", "{{json .Manifest.Digest}}"], timeout=90)
    report.check(done.stdout.strip().strip('"') == digest, "registry tag resolves to the approved digest",
                 "registry tag does not resolve to the approved digest")
    config_ok = True
    if target.get("config_digest"):
        raw = sh(["docker", "buildx", "imagetools", "inspect", "--raw", f"{env.repo}@{digest}"], timeout=90).stdout
        try:
            config_ok = json.loads(raw)["config"]["digest"] == target["config_digest"]
        except (ValueError, KeyError, TypeError):
            config_ok = False
    meta = image_metadata(env, digest)
    report.check(config_ok and meta.get("platform") == "linux/amd64" and meta.get("revision") == target["source_sha"]
                 and meta.get("GIT_COMMIT_SHA") == target["source_sha"] and meta.get("BUILD_ID") == target["build_id"],
                 f"image is linux/amd64, SHA {target['source_sha'][:12]}, Build ID {target['build_id']}",
                 "image architecture, SHA, Build ID or content digest mismatch")


def db_query(env: Environment, sql: str) -> str | None:
    done = sh(["docker", "exec", "-e", "PGOPTIONS=-c default_transaction_read_only=on", env.cfg["db_container"],
               "sh", "-c", 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"', "sh", sql], timeout=90)
    return done.stdout if done.returncode == 0 else None


def check_migrations(env: Environment, report: Report, target: dict, complete: bool = False):
    applied = db_query(env, 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
    broken = db_query(env, 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL')
    if applied is None or broken is None:
        report.fail("cannot read migration history")
        return
    if broken.strip() != "0":
        report.fail("database has an unfinished or failed migration")
        return
    if target["migrations"] is None:
        report.note("RISK migrations of a tag deploy are unknown until the image is pulled")
        return
    have, want = set(applied.split()), set(target["migrations"])
    extra, pending = sorted(have - want), sorted(want - have)
    if extra:
        report.fail(f"database has migrations unknown to the release: {', '.join(extra)}")
    elif complete:
        report.check(not pending, "all release migrations applied", f"migrations still pending: {', '.join(pending)}")
    else:
        report.check(not pending or pending == sorted(target["expected_pending"]),
                     f"pending migrations as expected: {', '.join(pending) or 'none'}",
                     f"unexpected pending migrations: {', '.join(pending)}")


def check_attestation(env: Environment, report: Report, target: dict):
    if not (env.cfg["require_attestation"] or target.get("require_attestation")):
        return
    directory, signers = Path(env.cfg.get("attestation_dir", "/nonexistent")), env.cfg.get("allowed_signers", "/nonexistent")
    manifest = directory / "backup.manifest"
    signature = directory / "backup.manifest.sig"
    if not (manifest.is_file() and signature.is_file() and os.path.isfile(signers)):
        report.fail("signed backup attestation is missing")
        return
    body = manifest.read_bytes()[:65536]  # verify exactly the bytes that are parsed
    verified = subprocess.run(["ssh-keygen", "-Y", "verify", "-f", signers, "-I", "uat-backup", "-n", "mamago-uat-backup",
                               "-s", str(signature)], input=body, capture_output=True, timeout=30)
    if verified.returncode:
        report.fail("backup attestation signature is invalid")
        return
    data = dict(line.split("=", 1) for line in body.decode("utf-8", "replace").splitlines() if "=" in line)
    problems = []
    for key in ("db_sha256", "media_sha256"):
        if len(data.get(key, "")) != 64:
            problems.append(f"{key} missing")
    for key in ("db_bytes", "media_bytes"):
        if not data.get(key, "").isdigit() or int(data[key]) == 0:
            problems.append(f"{key} missing")
    if data.get("restore_check") != "PASS":
        problems.append("restore check not attested")
    if data.get("environment") != env.name or data.get("host_id") != env.host.host_id:
        problems.append("attestation is for another environment or host")
    if data.get("db_container_id") != env.inspect(env.cfg["db_container"], "{{.Id}}"):
        problems.append("backup belongs to another database container")
    if data.get("release_digest") != target["image_digest"]:
        problems.append("attestation is for another release")
    try:
        created = dt.datetime.strptime(data["created_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
        age = (dt.datetime.now(dt.timezone.utc) - created).total_seconds() / 3600
        if not -0.1 <= age <= env.cfg["backup_max_age_hours"]:
            problems.append(f"backup is {age:.1f} h old (limit {env.cfg['backup_max_age_hours']} h)")
    except (KeyError, ValueError):
        problems.append("created_utc missing")
    for line in problems:
        report.note("  " + line)
    report.check(not problems, "off-host backups attested by signature", "backup attestation rejected")


def fingerprint(env: Environment, action: str, target: dict | None) -> str:
    digest = hashlib.sha256()
    parts = [action, env.host.host_id, env.name, *env.current(), env.db_identity(),
             (target or {}).get("image_digest", "")]
    for part in parts:
        digest.update(part.encode() + b"\0")
    previous = env.state / "previous.json"
    attestation = Path(env.cfg.get("attestation_dir", "/nonexistent")) / "backup.manifest"
    for path in (env.host.path, env.base_file, env.dir / ".env", previous, attestation):
        with contextlib.suppress(OSError):
            digest.update(path.read_bytes())
        digest.update(b"\0")
    if target:
        digest.update(target["raw"])
        digest.update("\n".join(target.get("migrations") or []).encode())
    return digest.hexdigest()[:16]


def preflight(env: Environment, ref: str) -> tuple[Report, dict, dict]:
    report = Report()
    target = resolve_target(env, ref)
    app, worker = env.current()
    check_db(env, report)
    check_no_leftovers(env, report)
    report.check(bool(app) and app == worker, "app and worker run the same image", "app and worker are missing or differ")
    report.check(app not in accepted_ids(target), "target differs from the running image", "this release is already running")
    config = check_layout_and_compose(env, report, f"{env.repo}@{target['image_digest']}")
    check_env_values(env, report, config, target)
    rollback = sh(["docker", "image", "inspect", "--format", "{{.Id}}", app], timeout=60)
    report.check(bool(app) and rollback.returncode == 0, f"current image kept locally for rollback ({app[:19]})",
                 "current image is not available locally for rollback")
    check_disk(env, report)
    check_registry(env, report, target)
    check_migrations(env, report, target)
    check_attestation(env, report, target)
    health = env.parse_health(env.internal_health())
    report.check(health.get("status") == "ok", f"current application healthy ({health.get('buildId')})", "current application is not healthy")
    facts = {"host": env.host.host_id, "environment": env.name, "mode": target["mode"],
             "current": f"{health.get('buildId')} {str(health.get('gitSha'))[:12]}",
             "target": target["build_id"], "sha": target["source_sha"], "digest": target["image_digest"],
             "rollback": f"{health.get('buildId')} ({app[:19]})",
             "migrations": "unknown until pulled" if target["migrations"] is None else ", ".join(target["expected_pending"]) or "none expected",
             "rollback_compatible": {True: "yes", False: "NO", None: "unknown"}[target["rollback_compatible"]],
             "backup": "local dump before migrations" if env.cfg["local_dump"] else "attestation only"}
    return report, target, facts


def rollback_preflight(env: Environment) -> tuple[Report, dict, dict]:
    report = Report()
    try:
        previous = json.loads((env.state / "previous.json").read_text())
    except (OSError, ValueError):
        report.fail("no deployment recorded by this system; nothing to roll back")
        return report, {}, {}
    check_db(env, report)
    check_no_leftovers(env, report)
    app, worker = env.current()
    report.check(not (app == worker == previous["image_id"]), "running image differs from the rollback image",
                 "nothing to roll back: the previous image is already running")
    report.check(env.image_id(previous["image_ref"]) == previous["image_id"],
                 f"rollback image present locally ({previous['image_id'][:19]})", "rollback image is missing or changed")
    report.check(previous.get("rollback_compatible") is not False,
                 "release declares the schema compatible with the previous application",
                 "release is not rollback compatible; database recovery needs a separate decision")
    check_layout_and_compose(env, report, previous["image_ref"])
    health = env.parse_health(env.internal_health())
    facts = {"host": env.host.host_id, "environment": env.name, "current": f"{health.get('buildId')}",
             "target": previous["build_id"], "sha": previous["source_sha"], "digest": previous["image_id"],
             "rollback": previous["build_id"], "migrations": "none; the database is not restored",
             "rollback_compatible": {True: "yes", None: "unknown"}.get(previous.get("rollback_compatible"), "NO")}
    return report, previous, facts


# --- operations --------------------------------------------------------------
def verify_dump(path: Path) -> bool:
    """Reads the archive back: gzip CRC and length, and pg_dump's closing marker."""
    tail = b""
    try:
        with gzip.open(path, "rb") as stream:
            for chunk in iter(lambda: stream.read(1 << 20), b""):
                tail = (tail + chunk)[-400:]
    except (OSError, EOFError, zlib.error):
        return False
    return DUMP_MARKER in tail


def local_dump(env: Environment, report: Report, opid: str) -> bool:
    """One deadline for the whole stream. Only a verified dump gets a .sql.gz name."""
    target = env.state / "backups" / f"{now().replace(':', '')}-{opid[:8]}.sql.gz"
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".partial")
    limit = env.host.data.get("dump_timeout", DUMP_TIMEOUT)
    # `timeout` runs inside the container: killing the docker client would leave pg_dump there.
    script = f'exec timeout {limit} pg_dump --lock-wait-timeout=60000 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    ok, expired = False, threading.Event()
    process = timer = None
    try:
        handle = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(handle, "wb") as raw:
            process = subprocess.Popen(["docker", "exec", env.cfg["db_container"], "sh", "-c", script],
                                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
                                       start_new_session=True)
            timer = threading.Timer(limit, lambda: (expired.set(), kill_group(process)))
            timer.start()
            with gzip.GzipFile(fileobj=raw, mode="wb") as stream:
                for chunk in iter(lambda: process.stdout.read(1 << 20), b""):
                    stream.write(chunk)
            raw.flush()
            os.fsync(raw.fileno())
        ok = process.wait(timeout=60) == 0 and not expired.is_set() and verify_dump(partial)
        if ok:
            os.replace(partial, target)
    except (OSError, subprocess.TimeoutExpired):
        ok = False
    finally:
        if timer:
            timer.cancel()
        if process:
            if process.poll() is None:
                kill_group(process)
                process.wait()
            process.stdout.close()
        partial.unlink(missing_ok=True)
    reason = f"database dump exceeded {limit} s" if expired.is_set() else "database dump failed"
    return report.check(ok, f"database dump written and verified ({target.name}, same host)", f"{reason}; nothing switched")


def set_app_version(env: Environment, tag: str) -> bool:
    """Rewritten in place so owner and mode stay as they are for deploy.sh."""
    path = env.dir / ".env"
    try:
        original = path.read_text()
        lines = original.splitlines(keepends=True)
        if sum(line.startswith("APP_VERSION=") for line in lines) != 1:
            return False
        env.state.mkdir(parents=True, exist_ok=True)
        (env.state / "env.before").write_text(original)
        with path.open("r+") as stream:
            stream.write("".join(f"APP_VERSION={tag}\n" if line.startswith("APP_VERSION=") else line for line in lines))
            stream.truncate()
    except OSError:
        return False
    return True


def run_deploy(env: Environment, ref: str, confirmed: str, opid: str, report: Report) -> None:
    checks, target, _ = preflight(env, ref)
    report.lines += checks.lines
    if checks.failures:
        report.fail("preflight failed; nothing changed")
        return
    if fingerprint(env, "deploy", target) != confirmed:
        report.fail("state changed since confirmation; nothing changed")
        return
    pinned = f"{env.repo}@{target['image_digest']}"
    db_before, others_before = env.db_identity(), env.neighbours()
    app_before = env.current()[0]
    health_before = env.parse_health(env.internal_health())
    ref_before = env.inspect(env.container("app"), "{{.Config.Image}}")

    if sh(["docker", "pull", pinned], timeout=1500).returncode:
        report.fail("image pull failed; nothing switched")
        return
    allowed = accepted_ids(target)
    if env.image_id(pinned) not in allowed:
        report.fail("pulled image ID does not match the release; nothing switched")
        return
    identity = sh(["docker", "image", "inspect", "--format",
                   '{{.Os}}/{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}} {{range .Config.Env}}{{println .}}{{end}}', pinned], timeout=60).stdout
    if not identity.startswith(f"linux/amd64 {target['source_sha']} ") or f"BUILD_ID={target['build_id']}" not in identity.split():
        report.fail("pulled image identity mismatch; nothing switched")
        return
    report.ok(f"pulled and verified {pinned}")

    env.state.mkdir(parents=True, exist_ok=True)
    if env.image_id(ref_before) != app_before:
        ref_before = app_before
    recorded = env.state / "previous.json"
    earlier = recorded.read_bytes() if recorded.exists() else None
    if env.cfg["local_dump"] and not local_dump(env, report, opid):
        return
    override = env.state / "override.yml"
    env.write_override(override, pinned)

    report.note("Running migrations...")
    # Until the switch, `previous.json` still describes the earlier deploy. If this
    # release is not rollback compatible, its migrations must not allow that older rollback.
    if earlier and target["rollback_compatible"] is False:
        write_atomic(recorded, json.dumps({**json.loads(earlier), "rollback_compatible": False}))
    migration = env.compose("run", "--pull", "never", "--rm", "--no-deps", "-T", "migrate", override=override, timeout=1500)
    if migration.returncode:
        report.fail("migration failed; app and worker were NOT switched. Inspect migration state before any retry"
                    + (" (timed out: it may still be running)" if migration.returncode == 124 else ""))
        return
    migrated = Report()
    check_migrations(env, migrated, target, complete=target["migrations"] is not None)
    report.lines += migrated.lines
    if migrated.failures:
        report.fail("migrations incomplete; app and worker were NOT switched")
        return
    if target["seed"]:
        if env.compose("run", "--pull", "never", "--rm", "--no-deps", "-T", "app", "pnpm", "db:seed:system", override=override).returncode:
            report.fail("seed failed; app and worker were NOT switched")
            return
        report.ok("system seed applied as declared by the release")

    report.note("Switching app and worker...")
    older = recorded.read_bytes() if recorded.exists() else None
    write_atomic(recorded, json.dumps({
        "image_ref": ref_before, "image_id": app_before, "build_id": health_before.get("buildId"),
        "source_sha": health_before.get("gitSha"), "rollback_compatible": target["rollback_compatible"],
        "replaced_by": target["build_id"], "recorded": now()}))
    if env.compose("up", "-d", "--pull", "never", "--no-deps", "--force-recreate", "app", "worker", override=override).returncode:
        report.fail("container switch failed")
        if env.current() == (app_before, app_before):  # nothing was replaced
            write_atomic(recorded, older.decode()) if older else recorded.unlink()
    else:
        env.verify_fleet(report, allowed, target["source_sha"], target["build_id"])
    verify_neighbours(env, report, db_before, others_before)
    if not report.failures and target["mode"] == "standard":
        report.check(set_app_version(env, target["ref_tag"]), "APP_VERSION recorded", "could not record APP_VERSION")


def run_rollback(env: Environment, confirmed: str, report: Report) -> None:
    checks, previous, _ = rollback_preflight(env)
    report.lines += checks.lines
    if checks.failures:
        report.fail("rollback preflight failed; nothing changed")
        return
    if fingerprint(env, "rollback", None) != confirmed:
        report.fail("state changed since confirmation; nothing changed")
        return
    db_before, others_before = env.db_identity(), env.neighbours()
    override = env.state / "override.yml"
    env.write_override(override, previous["image_ref"])
    if env.compose("up", "-d", "--pull", "never", "--no-deps", "--force-recreate", "app", "worker", override=override).returncode:
        report.fail("container switch failed")
    else:
        env.verify_fleet(report, {previous["image_id"]}, previous["source_sha"], previous["build_id"])
    verify_neighbours(env, report, db_before, others_before)
    if not report.failures:
        tag = str(previous["build_id"])
        if previous["image_ref"].endswith(":" + tag) and BUILD_TAG.fullmatch(tag):
            set_app_version(env, tag)
        os.replace(env.state / "previous.json", env.state / "previous.rolled-back.json")
        report.note("The schema keeps the newer migrations; no data was restored.")


def verify_neighbours(env: Environment, report: Report, db_before: str, others_before: str):
    report.check(env.db_identity() == db_before, f"{env.cfg['db_container']} not recreated or restarted",
                 f"CRITICAL {env.cfg['db_container']} identity changed")
    report.check(env.neighbours() == others_before, "other environments unchanged",
                 "CRITICAL another environment's containers changed during the operation")


# --- operation records ---------------------------------------------------------
@contextlib.contextmanager
def host_lock(path: str):
    """Shared with the legacy deploy.sh. Opened without O_CREAT when present
    because Ubuntu's protected_regular forbids O_CREAT on another user's file in /tmp."""
    try:
        handle = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        handle = os.open(path, os.O_RDONLY | os.O_CREAT | os.O_NOFOLLOW, 0o644)
    try:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Refused("another deploy or rollback is running on this host") from None
        yield
    finally:
        os.close(handle)


def op_path(env: Environment, opid: str) -> Path:
    if not OPID.fullmatch(opid):
        raise Refused("invalid operation id")
    return env.state / "ops" / f"{opid}.json"


def write_atomic(path: Path, text: str, exclusive: bool = False):
    """Readers see the whole file or the old one. exclusive: never replace."""
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=".tmp-")
    try:
        with os.fdopen(handle, "w") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        if exclusive:
            os.link(temporary, path)
        else:
            os.replace(temporary, path)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(temporary)


def save_op(path: Path, record: dict):
    write_atomic(path, json.dumps(record))


def journal(env: Environment, text: str):
    env.state.mkdir(parents=True, exist_ok=True)
    with (env.state / "executor.log").open("a") as stream:
        stream.write(f"{now()} {text}\n")


def process_alive(pid) -> bool:
    if not isinstance(pid, int):
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    with contextlib.suppress(OSError, IndexError):
        # A killed, not yet reaped process still answers signals: it is not alive.
        return Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[0] != "Z"
    return True


def claim(path: Path) -> int | None:
    """One worker per operation. The worker holds this lock for as long as it
    lives, so its death is visible without trusting a (reusable) process id."""
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=".tmp-")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX)  # locked before it becomes visible
        os.link(temporary, path.with_suffix(".claim"))
    except FileExistsError:
        os.close(handle)
        return None
    finally:
        os.unlink(temporary)
    return handle


def claim_held(path: Path) -> bool | None:
    """None: never claimed."""
    try:
        handle = os.open(path.with_suffix(".claim"), os.O_RDONLY)
    except FileNotFoundError:
        return None
    try:
        fcntl.flock(handle, fcntl.LOCK_SH | fcntl.LOCK_NB)
        return False
    except BlockingIOError:
        return True
    finally:
        os.close(handle)


def read_record(path: Path) -> dict:
    try:
        record = json.loads(path.read_text())
        if record["state"] != "running":
            return record
        held = claim_held(path)
        dead = held is False or (held is None and time.time() - record.get("queued", 0) > CLAIM_GRACE)
        if dead:
            # The worker may have saved its verdict between the two reads.
            record = json.loads(path.read_text())
            if record["state"] == "running":
                record["state"] = "unknown"  # no verdict: never report success
        return record
    except FileNotFoundError:
        return {"state": "absent", "report": []}
    except (OSError, ValueError, KeyError, TypeError):
        return {"state": "unknown", "report": ["FAIL the operation record is damaged"]}


def read_op(env: Environment, opid: str) -> dict:
    return read_record(op_path(env, opid))


def unfinished_operation(host: HostConfig) -> str | None:
    for path in Path(host.data["state_dir"]).glob("*/ops/*.json"):
        if read_record(path)["state"] == "running":
            return path.stem
    return None


def submit(env: Environment, config_path: str, action: str, ref: str, confirmed: str, opid: str, actor: str, detach: bool = True) -> dict:
    """Accepts an operation once. Repeating the same request only returns its state."""
    path = op_path(env, opid)
    path.parent.mkdir(parents=True, exist_ok=True)
    request = {"action": action, "ref": ref, "fingerprint": confirmed}
    record = {"opid": opid, **request, "actor": actor, "state": "running", "queued": time.time(), "started": now(),
              "report": [], "pid": None}

    def existing() -> dict:
        found = read_record(path)
        if any(k in found and found[k] != v for k, v in request.items()):
            raise Refused("operation id was already used for another request")
        return found

    if path.exists():  # before the lock: the operation itself may be holding it
        return existing()
    with host_lock(env.host.data["lock_file"]):
        if path.exists():
            return existing()
        # The lock is free between acceptance and the worker taking it.
        if unfinished_operation(env.host):
            raise Refused("another operation was accepted and has not finished")
        write_atomic(path, json.dumps(record), exclusive=True)
        if detach:
            # New session: closing the SSH connection or restarting the bot does not stop it.
            # Only the worker writes the record from here on, so a verdict is never overwritten.
            command = [sys.executable, "-B", "-m", "mamago_deploy.executor", "--config", config_path, "_run", env.name, opid]
            try:
                subprocess.Popen(command, start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL, cwd=str(Path(__file__).resolve().parent.parent))
            except OSError as error:
                save_op(path, {**record, "state": "failed", "finished": now(),
                               "report": [f"FAIL the worker could not be started ({type(error).__name__}); nothing changed"]})
    with contextlib.suppress(OSError):  # the operation exists; a full disk must not hide that
        journal(env, f"op={opid} actor={actor} accepted {action} {ref}")
    return read_record(path)


def run_operation(env: Environment, opid: str) -> dict:
    path = op_path(env, opid)
    if json.loads(path.read_text())["state"] != "running":
        return read_record(path)
    handle = claim(path)
    if handle is None:
        return read_record(path)
    try:
        record = json.loads(path.read_text())
        if record["state"] != "running":
            return record
        report = Report()
        if time.time() - record["queued"] > CLAIM_DEADLINE:
            report.fail("the worker started too late; nothing changed. Confirm the operation again")
        else:
            record.update(pid=os.getpid())
            save_op(path, record)
            perform(env, record, opid, report)
        record.update(state="failed" if report.failures else "succeeded", finished=now(), report=report.lines)
        save_op(path, record)
        journal(env, f"op={opid} actor={record['actor']} {record['action']} {record['state']}")
        return record
    finally:
        os.close(handle)


def perform(env: Environment, record: dict, opid: str, report: Report):
    try:
        for attempt in range(50):
            try:
                with host_lock(env.host.data["lock_file"]):
                    if record["action"] == "deploy":
                        run_deploy(env, record["ref"], record["fingerprint"], opid, report)
                    else:
                        run_rollback(env, record["fingerprint"], report)
                return
            except Refused as refusal:
                # submit() may still hold the lock for an instant; real contention persists.
                if "another deploy" in str(refusal) and attempt < 49:
                    time.sleep(0.1)
                    continue
                raise
    except Refused as refusal:
        report.fail(str(refusal))
    except Exception as error:  # report, never leak values from the traceback
        report.fail(f"internal error {type(error).__name__}; state must be checked manually")


# --- read-only views ----------------------------------------------------------
def status(env: Environment) -> dict:
    report = Report()
    app, worker = env.current()
    for service in ("app", "worker"):
        report.note(f"{service}: {env.inspect(env.container(service), '{{.Config.Image}} {{.State.Status}}') or 'missing'}")
    report.note(f"db: {env.inspect(env.cfg['db_container'], '{{.State.Health.Status}} since {{.State.StartedAt}}') or 'missing'}")
    health = env.parse_health(env.internal_health())
    report.note(f"health: {health.get('status')} db={health.get('db')} build={health.get('buildId')} sha={str(health.get('gitSha'))[:12]}")
    report.note("fleet: consistent" if app and app == worker else "fleet: DRIFT between app and worker")
    previous = env.state / "previous.json"
    report.note(f"rollback available: {json.loads(previous.read_text())['build_id'] if previous.exists() else 'none recorded'}")
    check_disk(env, report)
    return {"report": report.lines, "facts": {"current": health.get("buildId"), "sha": health.get("gitSha")}}


def releases(env: Environment) -> dict:
    found = []
    for path in sorted(env.releases.glob("*.json")):
        with contextlib.suppress(Refused):
            release = load_release(env.releases, path.stem)
            if env.name in release["environments"]:
                found.append({"id": release["id"], "build_id": release["build_id"], "mode": release["mode"]})
    return {"releases": found, "tag_deploy": env.cfg["tag_deploy"], "log_services": env.cfg["log_services"]}


def logs(env: Environment, service: str) -> dict:
    if not SERVICE.fullmatch(service) or service not in env.cfg["log_services"]:
        raise Refused("logs of this service are not available")
    done = env.compose("logs", "--no-color", f"--tail={LOG_TAIL}", service, timeout=60)
    return {"report": redact(done.stdout[-60000:], personal=True).splitlines()}


# --- command line -------------------------------------------------------------
def dispatch(config_path: str, argv: list[str], detach: bool = True) -> dict:
    """argv is [verb, environment, ...]. The single entry used by the gate and the CLI."""
    host = HostConfig.load(Path(config_path))
    if not argv:
        raise Refused("missing command")
    verb, args = argv[0], argv[1:]
    arity = {"identify": 1, "status": 1, "releases": 1, "rollback-preflight": 1, "preflight": 2, "result": 2,
             "logs": 2, "_run": 2, "submit-rollback": 4, "submit-deploy": 5}
    if verb not in arity or len(args) != arity[verb]:
        raise Refused("unknown command or wrong arguments")
    env = Environment(host, args[0])
    base = {"ok": True, "host_id": host.host_id, "environment": env.name}
    if verb == "identify":
        return base
    if verb == "status":
        return {**base, **status(env)}
    if verb == "releases":
        return {**base, **releases(env)}
    if verb == "logs":
        return {**base, **logs(env, args[1])}
    if verb == "result":
        record = read_op(env, args[1])
        return {**base, "state": record["state"], "report": record["report"], "action": record.get("action")}
    if verb == "_run":
        record = run_operation(env, args[1])
        return {**base, "ok": record["state"] == "succeeded", "state": record["state"], "report": record["report"]}
    if verb in ("preflight", "rollback-preflight"):
        with host_lock(host.data["lock_file"]):
            if verb == "preflight":
                report, target, facts = preflight(env, args[1])
                action = "deploy"
            else:
                report, target, facts = rollback_preflight(env)
                action = "rollback"
            ready = not report.failures
            return {**base, "ok": ready, "report": report.lines, "facts": facts,
                    "fingerprint": fingerprint(env, action, target if action == "deploy" else None) if ready else None}
    action = "deploy" if verb == "submit-deploy" else "rollback"
    ref, confirmed, opid, actor = (args[1:] if action == "deploy" else ["previous", *args[1:]])
    if action == "deploy" and not (ref.startswith("rel:") and RELEASE_ID.fullmatch(ref[4:])
                                   or ref.startswith("tag:") and BUILD_TAG.fullmatch(ref[4:])):
        raise Refused("invalid target reference")
    if not FINGERPRINT.fullmatch(confirmed) or not ACTOR.fullmatch(actor):
        raise Refused("invalid confirmation or actor")
    record = submit(env, config_path, action, ref, confirmed, opid, actor, detach)
    return {**base, "state": record["state"], "report": record["report"], "opid": opid}


def execute(config_path: str, argv: list[str]) -> tuple[int, dict]:
    try:
        result = dispatch(config_path, argv)
    except Refused as refusal:
        return 2, {"ok": False, "error": str(refusal), "report": [f"FAIL {refusal}"]}
    except Exception as error:
        return 1, {"ok": False, "error": f"internal error {type(error).__name__}", "report": []}
    result["report"] = [redact(line) for line in result.get("report", [])]
    return (0 if result.get("ok") else 1), result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    options = parser.parse_args(argv)
    os.umask(0o077)
    code, result = execute(os.path.abspath(options.config), options.command)
    print(json.dumps(result, ensure_ascii=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
