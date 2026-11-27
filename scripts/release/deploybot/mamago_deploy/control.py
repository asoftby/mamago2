"""Control plane: who may ask, one-time confirmations, audit log and orchestration.

Telegram specifics live in bot.py; nothing here touches Docker or paths on a host.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import fcntl
import hashlib
import json
import logging
import os
import secrets
import time
from dataclasses import dataclass, replace
from pathlib import Path

from .common import OPID, Refused, redact
from .config import Registry
from .transport import PREFLIGHT_TIMEOUT, Transport, TransportError

log = logging.getLogger("mamago-deploy")

# How many times in a row a host must not know a lost request before it counts as never accepted.
ABSENT_CONFIRMATIONS = 3
NORMAL_TTL = 300
STRICT_TTL = 120


@dataclass(frozen=True)
class Access:
    owner_ids: frozenset

    @classmethod
    def load(cls, path: Path) -> "Access":
        """Fail closed: a missing or malformed file authorizes nobody."""
        try:
            ids = json.loads(path.read_text())["owner_ids"]
            if not isinstance(ids, list) or not all(type(i) is int and i > 0 for i in ids):
                raise ValueError
            return cls(frozenset(ids))
        except (OSError, ValueError, KeyError, TypeError):
            return cls(frozenset())

    def allows(self, user_id, chat_id, chat_type) -> bool:
        """Only an allowlisted user, only in their own private chat."""
        return user_id in self.owner_ids and chat_type == "private" and chat_id == user_id


@dataclass(frozen=True)
class Pending:
    action: str
    env: str
    host_id: str
    ref: str
    fingerprint: str
    user_id: int
    chat_id: int
    expires_at: float
    summary: str
    code: str | None = None  # set when a typed second step is awaited


class Confirmations:
    """Single use, short lived, in memory only; a restart or a newer request voids them."""

    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._pending: dict[str, Pending] = {}

    def issue(self, *, action, env, host_id, ref, fingerprint, user_id, chat_id, summary, strict) -> str:
        self.cancel(user_id)
        nonce = secrets.token_urlsafe(12)
        self._pending[nonce] = Pending(action, env, host_id, ref, fingerprint, user_id, chat_id,
                                       self._clock() + (STRICT_TTL if strict else NORMAL_TTL), summary)
        return nonce

    def cancel(self, user_id):
        self._pending = {n: p for n, p in self._pending.items() if p.user_id != user_id}

    def _take(self, nonce, user_id, chat_id) -> Pending | None:
        pending = self._pending.get(nonce)
        if pending is None or pending.user_id != user_id or pending.chat_id != chat_id:
            return None
        del self._pending[nonce]
        return pending if self._clock() < pending.expires_at else None

    def press(self, nonce, user_id, chat_id) -> Pending | None:
        pending = self._take(nonce, user_id, chat_id)
        return pending if pending and pending.code is None else None

    def require_typed(self, pending: Pending) -> str:
        code = f"{pending.env.upper()} {secrets.token_hex(3).upper()}"
        self._pending[secrets.token_urlsafe(12)] = replace(pending, code=code)
        return code

    def awaiting(self, user_id, chat_id) -> bool:
        return any(p.code and p.user_id == user_id and p.chat_id == chat_id for p in self._pending.values())

    def typed(self, text: str, user_id, chat_id) -> Pending | None:
        """One attempt: any other text voids the confirmation."""
        for nonce, pending in list(self._pending.items()):
            if pending.code and pending.user_id == user_id and pending.chat_id == chat_id:
                taken = self._take(nonce, user_id, chat_id)
                return taken if taken and secrets.compare_digest(text.strip().encode(), taken.code.encode()) else None
        return None


class Audit:
    """JSON lines, each carrying the hash of the previous one.

    The chain shows editing and damage. It cannot show a rewrite or a cut tail by
    someone who owns the file, so every hash also goes to the service log, which
    the bot's user cannot rewrite.
    """

    def __init__(self, path: Path):
        self.path = path

    def write(self, **event):
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        handle = os.open(self.path, os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        with os.fdopen(handle, "rb+", buffering=0) as stream:
            fcntl.flock(stream, fcntl.LOCK_EX)  # reading the last hash and appending are one step
            data = stream.read()
            previous, damaged = "0" * 64, False
            if data:
                last = data.rstrip(b"\n").rsplit(b"\n", 1)[-1]
                try:
                    previous = json.loads(last)["hash"]
                except (ValueError, KeyError, TypeError):
                    previous, damaged = hashlib.sha256(last).hexdigest(), True
                damaged = damaged or not data.endswith(b"\n")
            record = {"ts": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                      **{k: redact(v) if isinstance(v, str) else v for k, v in event.items()}, "prev": previous}
            if damaged:
                record["damaged_previous"] = True
                log.error("audit log was damaged before this record")
            record["hash"] = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
            line = (json.dumps(record, sort_keys=True) + "\n").encode()
            if data and not data.endswith(b"\n"):
                line = b"\n" + line
            while line:
                line = line[stream.write(line):]
            os.fsync(stream.fileno())
        log.info("audit event=%s opid=%s hash=%s", record.get("event"), record.get("opid", "-"), record["hash"])

    def verify(self) -> bool:
        """False for any damage; a missing file is an empty, valid log."""
        previous = "0" * 64
        try:
            for line in self.path.read_text().splitlines():
                record = json.loads(line)
                claimed = record.pop("hash")
                if record["prev"] != previous or hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest() != claimed:
                    return False
                previous = claimed
        except FileNotFoundError:
            return True
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            return False
        return True


@dataclass(frozen=True)
class Outcome:
    state: str  # succeeded | failed | refused | not_started | unknown
    report: list
    opid: str = ""


class Busy(Exception):
    pass


class Orchestrator:
    def __init__(self, registry_loader, transport: Transport, audit: Audit, poll_seconds: float = 5,
                 deadline_seconds: float = 40 * 60):
        self._load = registry_loader
        self.transport = transport
        self.audit = audit
        self._poll = poll_seconds
        self._deadline = deadline_seconds
        self._busy: set[str] = set()
        self.last_operation: dict[str, str] = {}

    def registry(self) -> Registry:
        return self._load()

    def _target(self, env: str, operation: str) -> tuple[str, dict]:
        registry = self.registry()
        entry = registry.environment(env)
        if not registry.allows(env, operation):
            raise Refused(f"{operation} is not allowed for {env}")
        return entry["host"], registry.hosts[entry["host"]]

    async def ask(self, env: str, operation: str, words: list[str], timeout: float = PREFLIGHT_TIMEOUT) -> dict:
        host_id, host = self._target(env, operation)
        answer = await self.transport.call(host, env, words, timeout)
        if "host_id" in answer and (answer["host_id"] != host_id or answer.get("environment") != env):
            raise Refused(f"host answered as {answer['host_id']}/{answer.get('environment')}, expected {host_id}/{env}")
        return answer

    async def execute(self, pending: Pending) -> Outcome:
        """Submits once. A lost connection is never success and never a resubmission."""
        if pending.env in self._busy:
            raise Busy
        host_id, _ = self._target(pending.env, pending.action)
        if host_id != pending.host_id:
            raise Refused("the environment moved to another host after confirmation")
        self._busy.add(pending.env)
        opid = secrets.token_hex(16)
        actor = f"telegram:{int(pending.user_id)}"
        record = {"user": pending.user_id, "action": pending.action, "env": pending.env, "host": host_id,
                  "ref": pending.ref, "opid": opid}
        self.last_operation[pending.env] = opid
        try:
            try:
                self.audit.write(event="start", **record)
            except OSError:
                raise Refused("the audit log cannot be written; nothing was started") from None
            words = (["submit-deploy", pending.ref, pending.fingerprint, opid, actor] if pending.action == "deploy"
                     else ["submit-rollback", pending.fingerprint, opid, actor])
            try:
                answer = await self.ask(pending.env, pending.action, words, timeout=120)
                error = str(answer.get("error", ""))
                if error.startswith("internal error"):  # it may have failed after accepting
                    outcome = await self.follow(pending.env, pending.action, opid, submitted=False, cause=error)
                elif not answer.get("ok") and "state" not in answer:
                    outcome = Outcome("refused", answer.get("report", []), opid)
                else:
                    outcome = await self.follow(pending.env, pending.action, opid, submitted=True)
            except TransportError as error:
                outcome = await self.follow(pending.env, pending.action, opid, submitted=False, cause=str(error))
            try:
                self.audit.write(event="end", outcome=outcome.state, **record)
            except OSError:
                log.error("audit end record lost opid=%s outcome=%s", opid, outcome.state)
                outcome = replace(outcome, report=[*outcome.report, "RISK the result could not be written to the audit log"])
            return outcome
        finally:
            self._busy.discard(pending.env)

    async def follow(self, env: str, operation: str, opid: str, submitted: bool, cause: str = "") -> Outcome:
        if not OPID.fullmatch(opid):
            raise Refused("invalid operation id")
        started, absent = time.monotonic(), 0
        while True:
            try:
                answer = await self.ask(env, operation, ["result", opid], timeout=60)
                state = answer.get("state")
                if state in ("succeeded", "failed", "unknown"):
                    return Outcome(state, answer.get("report", []), opid)
                if state == "absent" and not submitted:
                    # The host may still be handling a request whose connection dropped.
                    absent += 1
                    if absent >= ABSENT_CONFIRMATIONS:
                        return Outcome("not_started", [f"The host never accepted the operation ({cause}). Nothing was started."], opid)
                elif state != "running":
                    return Outcome("unknown", answer.get("report", []) or ["The host does not know the operation."], opid)
            except TransportError as error:
                cause, absent = str(error), 0
            except Refused as refusal:  # the host or registry changed under a running operation
                return Outcome("unknown", [f"Cannot ask the host for the result: {refusal}. It may be running."], opid)
            if time.monotonic() - started >= self._deadline:
                return Outcome("unknown", [f"No verdict from the host ({cause or 'still running'}). It may still be running; "
                                           "do not repeat it. Check /result and status."], opid)
            await asyncio.sleep(self._poll)
