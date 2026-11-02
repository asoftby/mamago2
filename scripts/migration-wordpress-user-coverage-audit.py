#!/usr/bin/env python3
"""Read-only reconciliation of WordPress USER identities across DEV and PROD.

Compare the historical activation manifest (reference only) and known founder
exclusions with all active WordPress USER migration lineages in both databases.
The legacy WordPress DB is intentionally NOT required. No credentials, raw
emails, user IDs, names, or passwords are logged; PROD email comparisons use
ephemeral SHA-256-equivalent MD5 fingerprints inside memory only.

Does not authorize any imports. A missing lineage isn't proof a User is missing.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "docs/migration/users-production-activation-manifest.json"
EXCLUSIONS = ROOT / "docs/migration/manifests/phoenix-users-founder-exclusions-2026-07-31.json"
KEY = re.compile(r"^wordpress-db:user:[0-9]+$")

# One SSH round trip for both containers; all statements are SELECT only.
REMOTE_SQL = r"""
set -euo pipefail
for db in dev-db-1 prod-db-1; do
  case "$db" in
    dev-db-1) label=dev ;;
    prod-db-1) label=prod ;;
    *) exit 1 ;;
  esac
  printf 'BEGIN:%s\n' "$label"
  docker exec -i "$db" sh -c '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    exec psql -XAt -v ON_ERROR_STOP=1 -F "|" \
      -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  ' <<'SQL'
SELECT 'DB', current_database();
SELECT
  'L', l."sourceRecordKey",
  md5(lower(btrim(u.email))),
  u.role::text, u.status::text,
  CASE WHEN u."deletedAt" IS NULL THEN 'ACTIVE_RECORD' ELSE 'DELETED_RECORD' END,
  s."sourceNamespace"
FROM "MigrationLineage" l
JOIN "MigrationSource" s ON s.id = l."sourceId"
LEFT JOIN "User" u ON u.id = l."targetId"
WHERE l."targetType" = 'USER'
  AND l."isActive" = true
  AND s."adapterKey" = 'wordpress-db'
  AND l."sourceRecordKey" LIKE 'wordpress-db:user:%';
SELECT
  'U', md5(lower(btrim(email))), role::text
FROM "User"
WHERE "deletedAt" IS NULL
  AND email IS NOT NULL;
SQL
  printf 'END:%s\n' "$label"
done
"""


def read_reference_keys() -> set[str]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    exclusions = json.loads(EXCLUSIONS.read_text(encoding="utf-8"))
    keys = {
        e["sourceRecordKey"]
        for e in manifest["entries"]
        if isinstance(e.get("sourceRecordKey"), str)
        and KEY.fullmatch(e["sourceRecordKey"])
    }
    keys.update(exclusions["excludedSourceRecordKeys"])
    # The historical privileged user #1 is intentionally not in activation
    # manifest. Presence/absence of its lineage alone is never an import gate.
    keys.add("wordpress-db:user:1")
    if not keys or any(not KEY.fullmatch(k) for k in keys):
        raise RuntimeError("Historical reference manifest has invalid keys")
    return keys


def read_databases() -> tuple[dict, dict]:
    try:
        result = subprocess.run(
            [
                "ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15",
                "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3",
                "-T", "mamago-prod", "bash -s",
            ],
            input=REMOTE_SQL, text=True, capture_output=True, timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("SSH audit timeout; no writes attempted") from None
    if result.returncode:
        raise RuntimeError(
            f"SSH audit failed (exit {result.returncode}); "
            "check containers and connectivity privately"
        )
    databases = {
        "dev": {"name": None, "lineages": defaultdict(list), "email_hashes": {}},
        "prod": {"name": None, "lineages": defaultdict(list), "email_hashes": {}},
    }
    current = None
    for line in result.stdout.splitlines():
        if line.startswith("BEGIN:"):
            label = line.removeprefix("BEGIN:")
            if current is not None or label not in databases:
                raise RuntimeError("Unexpected section boundary")
            current = label
            continue
        if line.startswith("END:"):
            if line.removeprefix("END:") != current:
                raise RuntimeError("Broken section boundary")
            current = None
            continue
        if current is None:
            raise RuntimeError("Unexpected output outside audit section")
        fields = line.split("|")
        if fields[0] == "DB" and len(fields) == 2:
            databases[current]["name"] = fields[1]
        elif fields[0] == "L" and len(fields) == 7:
            _, key, fingerprint, role, status, record_state, namespace = fields
            if not KEY.fullmatch(key):
                raise RuntimeError("Malformed source lineage key")
            databases[current]["lineages"][key].append(
                (fingerprint, role, status, record_state, namespace)
            )
        elif fields[0] == "U" and len(fields) == 3:
            _, fingerprint, role = fields
            if re.fullmatch(r"[0-9a-f]{32}", fingerprint):
                databases[current]["email_hashes"].setdefault(fingerprint, set()).add(role)
        else:
            raise RuntimeError("Unexpected read-only query output")
    if current is not None:
        raise RuntimeError("Incomplete SSH audit output")
    if databases["dev"]["name"] != "devmamago" or databases["prod"]["name"] != "prodmamago":
        raise RuntimeError("DEV/PROD database identity check failed")
    return databases["dev"], databases["prod"]


def main() -> None:
    if len(sys.argv) != 1:
        raise RuntimeError("Read-only coverage audit accepts no arguments")
    expected = read_reference_keys()
    dev, prod = read_databases()
    dk, pk = set(dev["lineages"]), set(prod["lineages"])
    reference_missing_both = sorted(expected - dk - pk)
    dev_without_prod_lineage = sorted(dk - pk)
    dev_only_email_exists = []
    dev_only_email_missing = []
    unresolved = []
    for key in dev_without_prod_lineage:
        rows = dev["lineages"][key]
        if len(rows) != 1 or not rows[0][0] or rows[0][3] != "ACTIVE_RECORD":
            unresolved.append(key)
            continue
        if rows[0][0] in prod["email_hashes"]:
            dev_only_email_exists.append(key)
        else:
            dev_only_email_missing.append(key)
    duplicate_lineages = sorted({
        key for database in (dev, prod)
        for key, rows in database["lineages"].items() if len(rows) > 1
    })

    def show(label: str, keys: list[str]) -> None:
        print(f"{label} ({len(keys)}):")
        for key in keys[:35]:
            print(f"  {key}")
        if len(keys) > 35:
            print(f"  ... {len(keys) - 35} more (not shown)")

    print("READ-ONLY WORDPRESS USER COVERAGE AUDIT — NO DATABASE WRITES")
    print(f"Historical reference keys, incl. admin and exclusions: {len(expected)}")
    print(f"DEV active WordPress USER lineage keys: {len(dk)}")
    print(f"PROD active WordPress USER lineage keys: {len(pk)}")
    print(f"Reference keys covered by PROD lineage: {len(expected & pk)}")
    print(f"Reference keys covered by DEV or PROD lineage: {len(expected & (dk | pk))}")
    print(f"PROD keys not in historical reference: {len(pk - expected)}")
    show("Historical reference keys absent from BOTH lineage sets", reference_missing_both)
    show("DEV-only keys whose normalized email already exists in PROD", dev_only_email_exists)
    show("DEV-only keys whose normalized email has no PROD match", dev_only_email_missing)
    show("DEV-only keys requiring manual review", unresolved)
    show("Duplicate active WordPress USER lineage keys", duplicate_lineages)
    print("No destructive operation, import, approval, or activation was performed.")
    print("Reference manifest is historical and may not represent the entire WordPress DB.")
    print("A missing lineage or matching email requires case-by-case validation.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, KeyError, OSError, json.JSONDecodeError) as exc:
        print(f"Audit failed: {exc}", file=sys.stderr)
        sys.exit(1)
