"""The only entry point reachable by the bot, locally via sudo or over SSH.

authorized_keys:  restrict,command="/opt/mamago-deploy/gate --env dev" ssh-ed25519 AAAA...
sudoers:          mamago-bot ALL=(mamago-exec) NOPASSWD: /opt/mamago-deploy/gate --env dev *

The environment is fixed by the key or sudo rule, never by the request. No shell
is involved: the request is split into words and every word must match a pattern.
"""
from __future__ import annotations

import json
import os
import re
import sys

from . import executor
from .common import ENV_ID

WORD = re.compile(r"^[A-Za-z0-9][A-Za-z0-9:._-]{0,80}$")
VERBS = {"identify": 0, "status": 0, "releases": 0, "rollback-preflight": 0, "preflight": 1, "result": 1,
         "logs": 1, "submit-rollback": 3, "submit-deploy": 4}


def parse(argv: list[str], original: str | None) -> list[str]:
    if len(argv) < 2 or argv[0] != "--env" or not ENV_ID.fullmatch(argv[1]):
        raise ValueError("gate is not bound to an environment")
    env, rest = argv[1], argv[2:]
    if original is not None:
        if rest:
            raise ValueError("unexpected arguments")
        rest = original.split(" ")
    if rest[:1] == ["--"]:
        rest = rest[1:]
    if not rest or rest[0] not in VERBS or len(rest) - 1 != VERBS[rest[0]] or not all(WORD.fullmatch(w) for w in rest):
        raise ValueError("request refused")
    return [rest[0], env, *rest[1:]]


def main(argv: list[str] | None = None, config_path: str = executor.DEFAULT_CONFIG) -> int:
    argv = sys.argv[1:] if argv is None else argv
    try:
        command = parse(argv, os.environ.get("SSH_ORIGINAL_COMMAND"))
    except ValueError as error:
        print(json.dumps({"ok": False, "error": str(error), "report": [f"FAIL {error}"]}))
        return 2
    os.umask(0o077)
    code, result = executor.execute(config_path, command)
    print(json.dumps(result, ensure_ascii=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
