"""Authorization, one-time confirmations and the fixed command runner for /uat_*.

No Telegram or aiogram imports here, so every rule is testable in isolation.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
import time
from dataclasses import dataclass
from pathlib import Path

CONFIRM_TTL_SECONDS = 300
COMMAND_TIMEOUT_SECONDS = 20 * 60
#: The only script subcommands the bot can run. Nothing from a message reaches argv.
ACTIONS = {"deploy": "preflight", "rollback": "rollback-preflight"}
_FINGERPRINT = re.compile(r"^PREFLIGHT_FINGERPRINT=([0-9a-f]{16})$", re.M)
_SECRET_PATTERNS = (
    re.compile(r"\b\d{6,12}:[A-Za-z0-9_-]{30,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"(?i)(postgres(?:ql)?://)[^\s'\"]+"),
    re.compile(r"(?i)\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|DATABASE_URL)[A-Z0-9_]*=)\S+"),
)


def scrub(text: str) -> str:
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub(lambda m: (m.group(1) if m.groups() else "") + "[redacted]", text)
    return text


@dataclass(frozen=True)
class Access:
    user_ids: frozenset[int]

    @classmethod
    def load(cls, path: Path) -> "Access":
        """Fail closed: a missing or malformed file authorizes nobody."""
        try:
            data = json.loads(path.read_text())
            ids = data["user_ids"]
            if not isinstance(ids, list) or not all(type(i) is int and i > 0 for i in ids):
                raise ValueError
            return cls(frozenset(ids))
        except (OSError, ValueError, KeyError, TypeError):
            return cls(frozenset())

    def allows(self, user_id: int | None, chat_id: int | None, chat_type: str | None) -> bool:
        """Private chat of an allowlisted user only: never a group or channel."""
        return user_id in self.user_ids and chat_type == "private" and chat_id == user_id


@dataclass(frozen=True)
class Pending:
    action: str
    user_id: int
    chat_id: int
    fingerprint: str
    expires_at: float


class Confirmations:
    """Single-use, short-lived confirmations held only in memory.

    A bot restart forgets them, a new request supersedes the previous one and
    consuming removes the entry first, so a repeated tap or replayed callback
    can never start a second run.
    """

    def __init__(self, clock=time.monotonic, ttl: float = CONFIRM_TTL_SECONDS):
        self._clock = clock
        self._ttl = ttl
        self._pending: dict[str, Pending] = {}

    def issue(self, action: str, user_id: int, chat_id: int, fingerprint: str) -> str:
        if action not in ACTIONS:
            raise ValueError("unknown action")
        self._pending = {n: p for n, p in self._pending.items() if p.user_id != user_id}
        nonce = secrets.token_urlsafe(12)
        self._pending[nonce] = Pending(action, user_id, chat_id, fingerprint, self._clock() + self._ttl)
        return nonce

    def consume(self, nonce: str, user_id: int, chat_id: int) -> Pending | None:
        pending = self._pending.get(nonce)
        if pending is None or pending.user_id != user_id or pending.chat_id != chat_id:
            return None
        del self._pending[nonce]
        return pending if self._clock() < pending.expires_at else None


@dataclass(frozen=True)
class Result:
    code: int
    output: str

    @property
    def fingerprint(self) -> str | None:
        match = _FINGERPRINT.search(self.output)
        return match.group(1) if self.code == 0 and match else None


class Busy(Exception):
    pass


class Runner:
    """Runs the script with a fixed argv, no shell, a minimal environment, one at a time.

    The script additionally holds the host-wide deploy lock shared with deploy.sh.
    """

    def __init__(self, script: Path, timeout: float = COMMAND_TIMEOUT_SECONDS, extra_env: dict | None = None):
        self._script = str(script)
        self._timeout = timeout
        self._extra_env = extra_env or {}
        self._lock = asyncio.Lock()

    @property
    def busy(self) -> bool:
        return self._lock.locked()

    async def run(self, subcommand: str, user_id: int, fingerprint: str | None = None) -> Result:
        if subcommand not in {"status", *ACTIONS, *ACTIONS.values()}:
            raise ValueError("unknown subcommand")
        argv = [self._script, subcommand]
        if subcommand in ACTIONS:
            if not fingerprint or not re.fullmatch(r"[0-9a-f]{16}", fingerprint):
                raise ValueError("confirmation fingerprint required")
            argv += ["--confirm", fingerprint]
        if self._lock.locked():
            raise Busy
        async with self._lock:
            env = {
                "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "HOME": os.environ.get("HOME", "/home/user"),
                "LC_ALL": "C.UTF-8",
                "UAT_ACTOR": f"telegram:{int(user_id)}",
                **self._extra_env,
            }
            process = await asyncio.create_subprocess_exec(
                *argv, env=env, stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
            )
            try:
                output, _ = await asyncio.wait_for(process.communicate(), self._timeout)
            except asyncio.TimeoutError:
                # Do not kill a half-finished cutover; report and let the host lock protect it.
                return Result(124, "TIMEOUT: the operation is still running. Check /uat_status.")
            return Result(process.returncode or 0, scrub(output.decode("utf-8", "replace")))
