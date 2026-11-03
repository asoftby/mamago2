#!/usr/bin/env python3
"""Read-only reconciliation of five WordPress user emails from a local audit archive."""
import csv
import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
from pathlib import Path

TARGET = ("7", "17", "22", "42", "43")
ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "docs/migration/users-production-activation-manifest.json"

# SELECT only. Neither email addresses nor hashes are printed to the console.
REMOTE = r"""
set -euo pipefail
for db in dev-db-1 prod-db-1; do
  printf 'BEGIN:%s\n' "$db"
  docker exec -i "$db" sh -c '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    exec psql -XAt -v ON_ERROR_STOP=1 -F "|" \
      -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  ' <<'SQL'
SELECT 'DB', current_database();
SELECT 'U', md5(lower(btrim(email))) FROM "User"
WHERE "deletedAt" IS NULL AND email IS NOT NULL;
SELECT 'L', l."sourceRecordKey", md5(lower(btrim(u.email)))
FROM "MigrationLineage" l
JOIN "MigrationSource" s ON s.id = l."sourceId"
JOIN "User" u ON u.id = l."targetId"
WHERE l."targetType" = 'USER' AND l."isActive" = true
  AND s."adapterKey" = 'wordpress-db'
  AND l."sourceRecordKey" IN ('wordpress-db:user:7',
    'wordpress-db:user:17', 'wordpress-db:user:22',
    'wordpress-db:user:42', 'wordpress-db:user:43');
SQL
  printf 'END:%s\n' "$db"
done
"""


def from_archive(path):
    with tarfile.open(path, "r:gz") as tar:
        members = [m for m in tar if m.isfile() and m.name.endswith("/core/users.tsv")]
        if len(members) != 1 or members[0].size > 20_000_000:
            raise RuntimeError("Expected one small core/users.tsv in archive")
        stream = tar.extractfile(members[0])
        if stream is None:
            raise RuntimeError("Cannot open users.tsv")
        reader = csv.DictReader(
            io.TextIOWrapper(stream, encoding="utf-8-sig", newline=""), delimiter="\t"
        )
        fields = {s.strip().lower(): s for s in (reader.fieldnames or [])}
        uid = next((fields[k] for k in ("id", "user_id", "wp_user_id") if k in fields), None)
        em = next((fields[k] for k in ("user_email", "email") if k in fields), None)
        nm = next((fields[k] for k in ("display_name", "name") if k in fields), None)
        if not uid or not em:
            raise RuntimeError("Source ID or email column missing")
        rows = {}
        total = 0
        for row in reader:
            total += 1
            identifier = (row.get(uid) or "").strip()
            if identifier in TARGET:
                if identifier in rows:
                    raise RuntimeError("Duplicate source ID")
                rows[identifier] = (
                    (row.get(em) or "").strip().lower(),
                    (row.get(nm) or "").strip() if nm else "",
                )
    if total != 579 or set(rows) != set(TARGET):
        raise RuntimeError("Unexpected archive row count or missing target IDs")
    return rows


def from_databases():
    try:
        result = subprocess.run(
            [
                "ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15",
                "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3",
                "-T", "mamago-prod", "bash -s",
            ],
            input=REMOTE, text=True, capture_output=True, timeout=150,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("SSH read-only audit timed out") from None
    if result.returncode:
        raise RuntimeError("SSH audit failed; check connectivity (no writes attempted)")
    data = {
        "dev-db-1": {"name": None, "emails": set(), "lineages": {}},
        "prod-db-1": {"name": None, "emails": set(), "lineages": {}},
    }
    active = None
    for line in result.stdout.splitlines():
        if line.startswith("BEGIN:"):
            active = line[6:]
            if active not in data:
                raise RuntimeError("Unexpected DB section")
            continue
        if line.startswith("END:"):
            if line[4:] != active:
                raise RuntimeError("Unexpected section end")
            active = None
            continue
        if active is None:
            raise RuntimeError("Unexpected SSH response")
        tokens = line.split("|")
        if tokens[0] == "DB" and len(tokens) == 2:
            data[active]["name"] = tokens[1]
        elif tokens[0] == "U" and len(tokens) == 2:
            if re.fullmatch("[a-f0-9]{32}", tokens[1]):
                data[active]["emails"].add(tokens[1])
        elif tokens[0] == "L" and len(tokens) == 3:
            if tokens[1] not in {"wordpress-db:user:" + t for t in TARGET}:
                raise RuntimeError("Unknown lineage source ID")
            if tokens[1] in data[active]["lineages"]:
                raise RuntimeError("Duplicate active user lineage")
            data[active]["lineages"][tokens[1]] = tokens[2]
        else:
            raise RuntimeError("Unexpected SELECT result")
    if active is not None or data["dev-db-1"]["name"] != "devmamago" or data["prod-db-1"]["name"] != "prodmamago":
        raise RuntimeError("Incomplete audit or incorrect DB identity")
    return data


def main():
    if len(sys.argv) != 2:
        raise RuntimeError("Usage: python3 scripts/migration-wordpress-user-archive-reconcile.py PATH_TO_ARCHIVE")
    archive = from_archive(Path(sys.argv[1]).expanduser())
    history = json.loads(MANIFEST.read_text(encoding="utf-8"))
    masks = {
        entry["sourceRecordKey"]: entry["emailMask"]
        for entry in history["entries"]
        if entry.get("sourceRecordKey") in {"wordpress-db:user:" + t for t in TARGET}
    }
    if len(masks) != 5:
        raise RuntimeError("Archived activation manifest missing source user")
    db = from_databases()
    dev, prod = db["dev-db-1"], db["prod-db-1"]
    print("READ-ONLY ARCHIVE MATCH: 579 historical users; five target records found")
    print("No email, name, email fingerprint, password or raw database result is printed.")
    for uid in TARGET:
        email, name = archive[uid]
        valid = (
            email.count("@") == 1 and 0 < len(email) <= 254
            and all(email.split("@")) and not any(c.isspace() for c in email)
        )
        digest = hashlib.md5(email.encode("utf-8")).hexdigest() if valid else None
        masked = email[:1] + "***@" + email.split("@")[1] if valid else ""
        key = "wordpress-db:user:" + uid
        lineage = dev["lineages"].get(key)
        lineage_result = ("NO_LINEAGE" if lineage is None else
                          "MATCH" if digest == lineage else "DIFFERENT")
        print(
            f"user:{uid} archive_email_valid={'YES' if valid else 'NO'} "
            f"name_present={'YES' if name else 'NO'} "
            f"archive_vs_activation_mask={'MATCH' if masked.casefold() == masks[key].casefold() else 'DIFFERENT'} "
            f"DEV_email_exists={'YES' if digest in dev['emails'] else 'NO'} "
            f"PROD_email_exists={'YES' if digest in prod['emails'] else 'NO'} "
            f"DEV_lineage_email={lineage_result}"
        )
    print("NO WRITES. Historical archive dated 2026-07-03; not a production import authorization.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError, UnicodeError, tarfile.TarError) as error:
        print(f"Archive audit failed: {error}", file=sys.stderr)
        sys.exit(1)
