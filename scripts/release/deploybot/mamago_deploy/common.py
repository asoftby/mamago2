"""Validation patterns and redaction shared by the control and execution planes."""
from __future__ import annotations

import re

ENV_ID = re.compile(r"^(dev|prod)$")
RELEASE_ID = re.compile(r"^[a-z0-9][a-z0-9.-]{0,29}$")
BUILD_TAG = re.compile(r"^(dev|prod)-[0-9]{1,9}$")
SERVICE = re.compile(r"^[a-z][a-z0-9-]{0,30}$")
FINGERPRINT = re.compile(r"^[0-9a-f]{16}$")
OPID = re.compile(r"^[0-9a-f]{32}$")
ACTOR = re.compile(r"^(manual|telegram:[0-9]{1,20})$")
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")

_SECRETS = (
    (re.compile(r"\b\d{6,12}:[A-Za-z0-9_-]{30,}"), "[redacted-bot-token]"),
    (re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})"), "[redacted-token]"),
    (re.compile(r"(?i)\b(postgres(?:ql)?|redis|amqp|https?)://[^\s/'\"]+:[^\s@'\"]+@"), r"\1://[redacted]@"),
    (re.compile(r"(?i)\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_?KEY|DATABASE_URL)[A-Z0-9_]*[\"']?\s*[=:]\s*)[\"']?[^\s\"',}]+"), r"\1[redacted]"),
    (re.compile(r"(?i)\b(authorization|cookie|set-cookie)(\s*[:=]\s*).+"), r"\1\2[redacted]"),
)
_PERSONAL = (
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[email]"),
    (re.compile(r"(?<![\w.])\+?(?:375|7|48|380)[\s()-]*\d{2}[\s()-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?![\w])"), "[phone]"),
)


def redact(text: str, personal: bool = False) -> str:
    """Best effort: removes credentials, and for logs also e-mails and phones."""
    for pattern, replacement in _SECRETS + (_PERSONAL if personal else ()):
        text = pattern.sub(replacement, text)
    return text


class Refused(Exception):
    """A request that must not be carried out. The message is safe to show."""
