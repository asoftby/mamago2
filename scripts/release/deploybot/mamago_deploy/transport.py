"""Reach a host's gate: locally through sudo, or over SSH. Never through a shell."""
from __future__ import annotations

import asyncio
import json
import re

from .common import Refused
from .gate import VERBS, WORD

CALL_TIMEOUT = 120
PREFLIGHT_TIMEOUT = 600


class TransportError(Exception):
    """The host did not give a usable answer. The outcome of a request is then unknown."""


def command_for(host: dict, env: str, words: list[str]) -> list[str]:
    if not words or words[0] not in VERBS or len(words) - 1 != VERBS[words[0]] or not all(WORD.fullmatch(w) for w in words):
        raise Refused("request refused")
    if host["type"] == "local":
        prefix = ["sudo", "-n", "-u", host["sudo_user"]] if host.get("sudo_user") else []
        return [*prefix, host["gate"], "--env", env, "--", *words]
    return ["ssh", "-T", "-F", "/dev/null",
            "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", f"UserKnownHostsFile={host['known_hosts']}",
            "-o", "GlobalKnownHostsFile=/dev/null", "-o", "IdentitiesOnly=yes", "-o", "ForwardAgent=no",
            "-o", "ClearAllForwardings=yes", "-o", "PasswordAuthentication=no",
            "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3",
            "-i", host["identity_files"][env], "-p", str(host["port"]), f"{host['user']}@{host['address']}", "--", " ".join(words)]


class Transport:
    async def call(self, host: dict, env: str, words: list[str], timeout: float = CALL_TIMEOUT) -> dict:
        argv = command_for(host, env, words)
        try:
            process = await asyncio.create_subprocess_exec(
                *argv, stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                env={"PATH": "/usr/local/bin:/usr/bin:/bin", "LC_ALL": "C.UTF-8"})
        except OSError as error:
            raise TransportError(f"cannot start transport ({type(error).__name__})") from None
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise TransportError("timed out") from None
        try:
            answer = json.loads(stdout.decode("utf-8", "replace").strip().splitlines()[-1])
            if not isinstance(answer, dict) or "ok" not in answer:
                raise ValueError
        except (ValueError, IndexError):
            kind = "host key verification failed" if b"Host key verification failed" in stderr or b"REMOTE HOST IDENTIFICATION" in stderr \
                else "authentication failed" if re.search(rb"Permission denied", stderr) else f"no answer (exit {process.returncode})"
            raise TransportError(kind) from None
        return answer
