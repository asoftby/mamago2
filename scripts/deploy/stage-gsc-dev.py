#!/usr/bin/env python3
"""Manual DEV-only credential staging. Never prints credentials or reads .env."""
import contextlib
import fcntl
import json
import os
import re
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile

ROOT = Path("/opt/mamago/dev/gsc-config")
EMAIL = "mamago-gsc-reader@mamago-2-0.iam.gserviceaccount.com"
PROPERTY = "sc-domain:mamago.by"
MAX_BYTES = 65536


def validate(payload):
    if not isinstance(payload, dict) or type(payload.get("enabled")) is not bool:
        raise ValueError("Invalid payload")
    credentials = payload.get("credentials")
    if not isinstance(credentials, dict):
        raise ValueError("Invalid credentials")
    if (credentials.get("type") != "service_account"
            or credentials.get("project_id") != "mamago-2-0"
            or credentials.get("client_email") != EMAIL
            or credentials.get("token_uri") != "https://oauth2.googleapis.com/token"):
        raise ValueError("Unexpected identity")
    key = credentials.get("private_key")
    if not isinstance(key, str) or not re.fullmatch(
            r"-----BEGIN PRIVATE KEY-----\n[A-Za-z0-9+/=\n]+-----END PRIVATE KEY-----\n?", key):
        raise ValueError("Invalid key")
    checked = subprocess.run(
        ["openssl", "rsa", "-check", "-noout"], input=key.encode(),
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5, check=False,
    )
    if checked.returncode:
        raise ValueError("Invalid RSA key")
    return credentials


def stage(payload, root=ROOT):
    """One atomic symlink swap publishes both files; no partial configuration."""
    credentials = validate(payload)
    # The operator provisions this directory; never create arbitrary host paths.
    if root.resolve() != root or not root.is_dir():
        raise ValueError("Unsafe directory")
    info = root.stat()
    if info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError("Directory must be owned by receiver and mode 0700")
    lock_fd = os.open(root / ".lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        current = root / "current"
        previous = None
        if current.is_symlink():
            previous = os.readlink(current)
            if not previous.startswith("generation-") or Path(previous).name != previous:
                raise ValueError("Unsafe current pointer")
        elif current.exists():
            raise ValueError("Unexpected current path")
        generation = Path(tempfile.mkdtemp(prefix="generation-", dir=root))
        pointer = root / (generation.name + ".link")
        try:
            common = ("GOOGLE_SEARCH_CONSOLE_ENABLED=" + str(payload["enabled"]).lower()
                      + "\nGOOGLE_SEARCH_CONSOLE_SITE_URL=" + PROPERTY + "\n")
            worker = common + "GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL=" + EMAIL + "\n"
            # Compose double-quoted dotenv values decode escaped newlines.
            worker += "GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY=" + json.dumps(credentials["private_key"]) + "\n"
            for name, content in (("web.env", common), ("worker.env", worker)):
                fd = os.open(generation / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "w") as stream:
                    stream.write(content)
                    stream.flush()
                    os.fsync(stream.fileno())
            pointer.symlink_to(generation.name)
            os.replace(pointer, current)
        except BaseException:
            with contextlib.suppress(FileNotFoundError):
                pointer.unlink()
            shutil.rmtree(generation)
            raise
        # Retain generations for owner-controlled rollback and secret cleanup.
        # No automatic deletion of unknown host files or directories.
        return previous


def main():
    try:
        if sys.argv[1:] == ["--client"]:
            raw = os.environ.pop("GSC_SERVICE_ACCOUNT_JSON_DEV", "")
            if len(raw.encode()) > MAX_BYTES:
                raise ValueError("Oversized credentials")
            enabled = os.environ.get("GSC_ENABLED", "false")
            if enabled not in ("true", "false"):
                raise ValueError("Invalid enabled flag")
            payload = {"credentials": json.loads(raw), "enabled": enabled == "true"}
            validate(payload)
            encoded = json.dumps(payload).encode()
            if len(encoded) > MAX_BYTES:
                raise ValueError("Oversized payload")
            sys.stdout.buffer.write(encoded)
        elif sys.argv[1:] == ["--receive"]:
            if os.environ.get("SSH_ORIGINAL_COMMAND") != "stage-gsc-dev":
                raise ValueError("Wrong SSH command")
            raw = sys.stdin.buffer.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise ValueError("Oversized payload")
            stage(json.loads(raw))
            print("GSC DEV configuration staged. No containers restarted; no database or cron touched.")
        else:
            raise ValueError("Unsupported mode")
    except Exception:
        # Neither JSON parser errors nor OpenSSL diagnostics may reach CI logs.
        print("GSC DEV staging failed; check identity, payload and receiver prerequisites.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
