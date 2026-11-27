#!/usr/bin/env python3
"""Add (or remove) the /uat_* router to the host-managed deploy_bot.py.

Mirrors the existing host patchers: refuses an unexpected source file, keeps a
backup, verifies the result compiles, and never restarts any service. The added
block is fail-safe: if the UAT module cannot load, the bot starts without it.
"""
import argparse
import hashlib
import os
import py_compile
import shutil
import sys
import tempfile
from pathlib import Path

BEGIN = "# >>> mamago uat router (managed by install-uat-bot.py)\n"
END = "# <<< mamago uat router\n"
ANCHOR = "async def main():\n"
BLOCK = BEGIN + '''try:
    import sys as _uat_sys
    _uat_sys.path.insert(0, "/opt/mamago/uat")
    from uat_bot import default_router as _uat_router
    dp.include_router(_uat_router())
except Exception:
    logger.exception("UAT commands unavailable; the bot continues without them")
''' + END + "\n\n"


def patched(source: str) -> str:
    if BEGIN in source:
        raise ValueError("UAT block already present")
    if source.count(ANCHOR) != 1 or "dp = Dispatcher()" not in source or "logger = " not in source:
        raise ValueError("unexpected bot source layout")
    return source.replace(ANCHOR, BLOCK + ANCHOR, 1)


def removed(source: str) -> str:
    if source.count(BLOCK) != 1:
        raise ValueError("managed UAT block missing or modified")
    return source.replace(BLOCK, "", 1)


def write(target: Path, source: str) -> None:
    with tempfile.TemporaryDirectory() as directory:
        probe = Path(directory) / "probe.py"
        probe.write_text(source, encoding="utf-8")
        py_compile.compile(str(probe), cfile=str(probe) + "c", doraise=True)
    mode = target.stat().st_mode & 0o777
    handle, name = tempfile.mkstemp(prefix=".uat-", dir=target.parent)
    with os.fdopen(handle, "w", encoding="utf-8") as stream:
        stream.write(source)
    os.chmod(name, mode)
    os.replace(name, target)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bot", type=Path)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--check", action="store_true", help="dry run: report whether the patch would apply")
    action.add_argument("--apply", action="store_true")
    action.add_argument("--revert", action="store_true")
    parser.add_argument("--expected-sha256", help="required with --apply")
    args = parser.parse_args()
    raw = args.bot.read_bytes()
    source = raw.decode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    try:
        if args.check:
            patched(source)
            print(f"OK: patch applies; current sha256 {digest}")
        elif args.apply:
            if args.expected_sha256 != digest:
                raise ValueError(f"sha256 mismatch: file is {digest}")
            result = patched(source)
            backup = args.bot.with_name(args.bot.name + f".before-uat-{digest[:12]}")
            shutil.copy2(args.bot, backup)
            os.chmod(backup, 0o600)
            write(args.bot, result)
            print(f"Applied. Backup: {backup}. Service NOT restarted.")
        else:
            write(args.bot, removed(source))
            print("Removed. Service NOT restarted.")
    except (ValueError, py_compile.PyCompileError) as error:
        print(f"REFUSED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
