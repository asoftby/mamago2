#!/usr/bin/env python3
"""Read-only five-user preview from a local WordPress audit archive.

PII stays in memory and is piped privately to the TypeScript preview.
No source file is written and nothing is sent to GitHub.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import io
import json
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = (7, 17, 22, 42, 43)


def source_from_archive(path: Path) -> dict:
    if not path.is_file() or path.stat().st_size > 100 * 1024 * 1024:
        raise RuntimeError("Missing archive or unexpectedly large archive")
    archive_digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with tarfile.open(path, "r:gz") as tar:
        members = [
            m for m in tar.getmembers()
            if m.isfile() and m.name.endswith("/core/users.tsv")
        ]
        if len(members) != 1 or members[0].size > 20 * 1024 * 1024:
            raise RuntimeError("Expected exactly one users.tsv of permitted size")
        stream = tar.extractfile(members[0])
        if stream is None:
            raise RuntimeError("Unable to read users.tsv")
        with stream:
            rows = csv.DictReader(
                io.TextIOWrapper(stream, encoding="utf-8-sig", newline=""),
                delimiter="\t",
            )
            names = {name.strip().lower(): name for name in (rows.fieldnames or [])}
            id_column = next((names[k] for k in ("id", "user_id", "wp_user_id") if k in names), None)
            email_column = next((names[k] for k in ("user_email", "email") if k in names), None)
            name_column = next((names[k] for k in ("display_name", "name") if k in names), None)
            if not id_column or not email_column or not name_column:
                raise RuntimeError("Expected WordPress user ID/email/name columns")
            matched = {}
            count = 0
            for row in rows:
                count += 1
                value = (row.get(id_column) or "").strip()
                if value.isdigit() and int(value) in TARGET:
                    key = int(value)
                    if key in matched:
                        raise RuntimeError("Duplicate WordPress ID in source archive")
                    matched[key] = {
                        "sourceRecordKey": "wordpress-db:user:" + str(key),
                        "email": (row.get(email_column) or "").strip(),
                        "displayName": (row.get(name_column) or "").strip(),
                    }
    if count != 579 or set(matched) != set(TARGET):
        raise RuntimeError("Unexpected historical archive coverage")
    return {
        "archiveSha256": archive_digest,
        "sourceRecords": [matched[key] for key in TARGET],
    }


def main() -> int:
    if len(sys.argv) != 2:
        raise RuntimeError(
            "Usage: python3 scripts/migration-wordpress-five-preview-ssh.py "
            "/absolute/path/mamago-wp-audit-20260703-034032.tar.gz"
        )
    source = source_from_archive(Path(sys.argv[1]).expanduser())
    helper_path = ROOT / "scripts/migration-user-exclusion-preview-ssh.py"
    spec = importlib.util.spec_from_file_location("mamago_readonly_preview_ssh", helper_path)
    if not spec or not spec.loader:
        raise RuntimeError("SSH preview support is unavailable")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    print("Five historical records parsed; establishing read-only DB preview.", flush=True)
    return helper.main(
        [
            "pnpm", "exec", "tsx",
            "scripts/migration-wordpress-five-preview.ts",
            "--preview", "--confirm-production",
        ],
        input_text=json.dumps(source, ensure_ascii=False),
    )


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, OSError, ValueError, UnicodeError, tarfile.TarError) as error:
        print("Five-user read-only preview failed: " + str(error), file=sys.stderr)
        sys.exit(1)
