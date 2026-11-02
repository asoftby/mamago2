#!/usr/bin/env python3
"""Read-only PROD backfill preview via existing mamago-prod SSH access.

No persistent DB credentials, files or production writes. The SSH connection
carries two loopback-only Postgres forwards; each DB password remains in this
process environment and is never logged. Runs only --preview.
"""
from __future__ import annotations

import ipaddress
import os
import shutil
import socket
import subprocess
import sys
import time
from contextlib import closing
from pathlib import Path
from urllib.parse import quote

SSH_ALIAS = "mamago-prod"
DEV_CONTAINER = "dev-db-1"
PROD_CONTAINER = "prod-db-1"
DEV_DB = "devmamago"
PROD_DB = "prodmamago"
ROOT = Path(__file__).resolve().parent.parent


def remote(command: str) -> bytes:
    """Use a reused SSH connection; retry bounded transport problems once.

    Captured stdout may contain credentials, so NEVER print stdout, stderr,
    or the command argument (including on subprocess.TimeoutExpired).
    """
    for attempt in range(2):
        try:
            completed = subprocess.run(
                [
                    "ssh", "-o", "BatchMode=yes",
                    "-o", "ConnectTimeout=15",
                    "-o", "ControlMaster=auto",
                    "-o", "ControlPath=/tmp/mamago-preview-%C",
                    "-o", "ControlPersist=90",
                    "-o", "ServerAliveInterval=10",
                    "-o", "ServerAliveCountMax=3",
                    "-T", SSH_ALIAS, command,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=75,
                check=False,
            )
        except subprocess.TimeoutExpired:
            if attempt == 0:
                time.sleep(2)
                continue
            raise RuntimeError(
                "SSH read-only metadata request timed out twice; "
                "verify SSH/Docker connectivity before retrying"
            ) from None
        if completed.returncode == 0:
            return completed.stdout
        if completed.returncode == 255 and attempt == 0:
            time.sleep(2)
            continue
        raise RuntimeError(
            f"SSH metadata request failed (exit {completed.returncode}); "
            "check the SSH alias, remote Docker and container state"
        )
    raise RuntimeError("SSH read-only metadata request failed")


def container_config(container: str, expected_database: str) -> tuple[str, str, str, str]:
    if container not in {DEV_CONTAINER, PROD_CONTAINER}:
        raise RuntimeError("Unapproved container")
    # The remote shell expands the three vars INSIDE the selected container.
    # Null-delimited values safely preserve punctuation and newline characters.
    query = (
        f"docker exec {container} sh -c "
        """'printf "%s\\0%s\\0%s\\0" """
        '"${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-postgres}" "${POSTGRES_PASSWORD:-}"\' '
    )
    result = remote(query)
    values = result.split(b"\x00")
    if len(values) != 4 or values[-1] != b"":
        raise RuntimeError(f"Invalid container DB config format for {container}")
    user, database, password = (part.decode("utf-8") for part in values[:3])
    if database != expected_database or not user or not password:
        raise RuntimeError(f"Wrong DB identity or missing credential in {container}")

    ip_output = remote(f"docker exec {container} hostname -i")
    ipv4_candidates = []
    for token in ip_output.decode("ascii", "replace").split():
        try:
            address = ipaddress.ip_address(token)
        except ValueError:
            continue
        if address.version == 4 and not address.is_loopback:
            ipv4_candidates.append(str(address))
    if len(ipv4_candidates) != 1:
        raise RuntimeError(f"Expected one Docker IPv4 address for {container}")
    return ipv4_candidates[0], user, database, password


def free_port() -> int:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def postgres_url(user: str, password: str, port: int, db: str) -> str:
    return (
        f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}"
        f"@127.0.0.1:{port}/{quote(db, safe='')}?schema=public"
    )


def main(cli_args: list[str] | None = None, input_text: str | None = None) -> int:
    if cli_args is None:
        if len(sys.argv) != 1:
            raise RuntimeError("This helper accepts no flags; only safe preview is supported")
        cli_args = ["pnpm", "migration:user:exclusion-backfill", "--preview", "--confirm-production"]
    if "--confirm-writes" in cli_args or "--preview" not in cli_args:
        raise RuntimeError("This SSH helper only supports read-only preview commands")
    if shutil.which("pnpm") is None:
        raise RuntimeError("pnpm is unavailable")
    if not (ROOT / "scripts/migration-user-exclusion-backfill.ts").exists():
        raise RuntimeError("Run from the PR #1065 working tree")

    dev_ip, dev_user, dev_name, dev_password = container_config(DEV_CONTAINER, DEV_DB)
    prod_ip, prod_user, prod_name, prod_password = container_config(PROD_CONTAINER, PROD_DB)
    dev_port = free_port()
    prod_port = free_port()
    if dev_port == prod_port:
        prod_port = free_port()

    ssh_args = [
        "ssh", "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=15",
        "-o", "ExitOnForwardFailure=yes",
        "-o", "ServerAliveInterval=15",
        "-o", "ServerAliveCountMax=3",
        "-T", "-N",
        "-L", f"127.0.0.1:{dev_port}:{dev_ip}:5432",
        "-L", f"127.0.0.1:{prod_port}:{prod_ip}:5432",
        SSH_ALIAS,
    ]
    ssh = subprocess.Popen(
        ssh_args,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(120):
            if ssh.poll() is not None:
                raise RuntimeError("SSH tunnel terminated; check SSH alias and forwarding permissions")
            try:
                with socket.create_connection(("127.0.0.1", dev_port), timeout=0.3):
                    with socket.create_connection(("127.0.0.1", prod_port), timeout=0.3):
                        break
            except OSError:
                time.sleep(0.25)
        else:
            raise RuntimeError("SSH database forwards did not become ready")

        env = os.environ.copy()
        env["SOURCE_DEV_DATABASE_URL"] = postgres_url(
            dev_user, dev_password, dev_port, dev_name
        )
        env["DATABASE_URL"] = postgres_url(
            prod_user, prod_password, prod_port, prod_name
        )
        print("DEV and PROD SSH forwards established; read-only preview only.", flush=True)
        result = subprocess.run(
            cli_args,
            input=input_text,
            text=input_text is not None,
            cwd=ROOT, env=env, check=False,
        )
        return result.returncode
    finally:
        ssh.terminate()
        try:
            ssh.wait(timeout=5)
        except subprocess.TimeoutExpired:
            ssh.kill()
            ssh.wait(timeout=5)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, subprocess.TimeoutExpired, OSError) as error:
        # Never render the constructed URLs or secrets in errors.
        print(f"Preview setup failed: {error}", file=sys.stderr)
        sys.exit(1)
