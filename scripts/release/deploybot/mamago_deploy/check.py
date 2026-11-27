"""Read-only self-test of the control plane, run as the bot's user inside the
bot's sandbox before the service is switched: configuration, credentials, keys,
host keys and every environment's gate. Values of secrets are never printed.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from . import bot  # noqa: F401  # fails here if the dependencies do not load in this sandbox
from .common import Refused
from .config import Registry
from .control import Access, Audit
from .transport import Transport, TransportError

CREDENTIALS = ("bot_token", "ghcr_token")


async def run(config_dir: Path, require_credentials: bool, transport: Transport | None = None) -> tuple[bool, list[str]]:
    lines, failed = [], []

    def result(ok: bool, text: str):
        lines.append(f"{'PASS' if ok else 'FAIL'} {text}")
        if not ok:
            failed.append(text)

    result(bool(Access.load(config_dir / "access.json").owner_ids), "access.json names an owner")
    directory = os.environ.get("CREDENTIALS_DIRECTORY")
    if directory or require_credentials:
        for name in CREDENTIALS:
            try:
                usable = bool(directory) and bool((Path(directory) / name).read_text().strip())
            except OSError:
                usable = False
            result(usable, f"credential {name} is readable and not empty")
    try:
        registry = Registry.load(config_dir / "registry.json")
    except Refused as refusal:
        result(False, str(refusal))
        return False, lines
    for name, entry in sorted(registry.environments.items()):
        try:
            answer = await (transport or Transport()).call(registry.hosts[entry["host"]], name, ["identify"], 40)
            ok = answer.get("ok") is True and answer.get("host_id") == entry["host"] and answer.get("environment") == name
            result(ok, f"{name}: gate on {entry['host']} answers as expected")
        except (TransportError, Refused) as error:
            result(False, f"{name}: {error}")
    state = os.environ.get("STATE_DIRECTORY")
    if state and not Audit(Path(state) / "audit.jsonl").verify():
        lines.append("RISK the existing audit log is damaged; keep a copy and investigate")
    return not failed, lines


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config-dir", default="/etc/mamago-deploy")
    parser.add_argument("--require-credentials", action="store_true")
    options = parser.parse_args()
    ok, lines = asyncio.run(run(Path(options.config_dir), options.require_credentials))
    print("\n".join(lines))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
