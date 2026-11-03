#!/usr/bin/env python3
"""Read-only inventory: every User email present in DEV but not PROD.

No names, emails, password hashes, user IDs or email fingerprints are printed.
Both databases are queried with SQL SELECT statements over one SSH connection.
"""
from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict

REMOTE_SQL = r"""
set -euo pipefail
for container in dev-db-1 prod-db-1; do
  printf 'BEGIN:%s\n' "$container"
  docker exec -i "$container" sh -c '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    exec psql -XAt -v ON_ERROR_STOP=1 -F "|" \
      -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  ' <<'SQL'
SELECT 'DB', current_database();
SELECT
  'U',
  md5(lower(btrim(u.email))),
  u.role::text, u.status::text,
  CASE WHEN u."deletedAt" IS NULL THEN 'LIVE' ELSE 'DELETED' END,
  CASE WHEN u."passwordHash" IS NULL THEN 'NO_PASSWORD' ELSE 'PASSWORD_SET' END,
  to_char(u."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM'),
  COALESCE((
    SELECT string_agg(DISTINCT s."adapterKey" || '/' || l."sourceRecordKey", ';')
    FROM "MigrationLineage" l
    JOIN "MigrationSource" s ON s.id = l."sourceId"
    WHERE l."targetId" = u.id AND l."targetType" = 'USER'
      AND l."isActive" = true
  ), ''),
  CASE WHEN u."emailVerifiedAt" IS NULL THEN 'EMAIL_NOT_VERIFIED'
       ELSE 'EMAIL_VERIFIED' END,
  CASE WHEN u."lastLoginAt" IS NULL THEN 'NEVER_LOGGED_IN'
       ELSE 'LOGIN_PRESENT' END,
  CASE WHEN nullif(btrim(u."displayName"), '') IS NULL THEN 'NO_DISPLAY_NAME'
       ELSE 'HAS_DISPLAY_NAME' END,
  (SELECT COUNT(*) FROM "Business" b WHERE b."ownerUserId" = u.id),
  (SELECT COUNT(*) FROM "BusinessMember" bm
    WHERE bm."userId" = u.id AND bm."isActive" = true),
  (SELECT COUNT(*) FROM "Activity" a WHERE a."ownerUserId" = u.id),
  (SELECT COUNT(*) FROM "FamilyMembership" fm
    WHERE fm."userId" = u.id AND fm."leftAt" IS NULL),
  (SELECT COUNT(*) FROM "Session" sess WHERE sess."userId" = u.id)
FROM "User" u
WHERE u.email IS NOT NULL;
SQL
  printf 'END:%s\n' "$container"
done
"""

def read_users():
    try:
        process = subprocess.run(
            [
                "ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15",
                "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3",
                "-T", "mamago-prod", "bash -s",
            ], input=REMOTE_SQL, text=True, capture_output=True,
            check=False, timeout=150,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("SSH read-only audit timed out") from None
    if process.returncode:
        raise RuntimeError("Remote read-only audit failed; inspect SSH connectivity privately")

    rows = {"dev-db-1": [], "prod-db-1": []}
    names = {}
    seen = set()
    current = None
    for line in process.stdout.splitlines():
        if line.startswith("BEGIN:"):
            section = line[6:]
            if section not in rows or current is not None or section in seen:
                raise RuntimeError("Unexpected SSH result section")
            current = section
            seen.add(section)
        elif line.startswith("END:"):
            if line[4:] != current:
                raise RuntimeError("SSH result section mismatch")
            current = None
        else:
            if current is None:
                raise RuntimeError("Unexpected SSH response")
            values = line.split("|")
            if len(values) == 2 and values[0] == "DB":
                names[current] = values[1]
            elif len(values) == 16 and values[0] == "U":
                if not re.fullmatch(r"[a-f0-9]{32}", values[1]):
                    raise RuntimeError("Bad fingerprint in query")
                if any(not re.fullmatch(r"[0-9]+", item) for item in values[11:16]):
                    raise RuntimeError("Invalid account relationship counts")
                rows[current].append({
                    "fingerprint": values[1],
                    "role": values[2],
                    "status": values[3],
                    "lifecycle": values[4],
                    "credential": values[5],
                    "created": values[6],
                    "lineage": tuple(sorted(set(filter(None, values[7].split(";"))))),
                    "email_verified": values[8],
                    "login": values[9],
                    "display_name": values[10],
                    "business_owned": int(values[11]),
                    "business_memberships": int(values[12]),
                    "activities_owned": int(values[13]),
                    "family_memberships": int(values[14]),
                    "sessions": int(values[15]),
                })
            else:
                raise RuntimeError("Unexpected SQL columns")
    if current is not None or seen != set(rows) or names.get("dev-db-1") != "devmamago" or names.get("prod-db-1") != "prodmamago":
        raise RuntimeError("DEV/PROD identity or data completeness check failed")
    return rows


def index_by_email(users):
    result = defaultdict(list)
    for user in users:
        result[user["fingerprint"]].append(user)
    return result


def main():
    if len(sys.argv) != 1:
        raise RuntimeError("No arguments accepted: audit is read-only")
    rows = read_users()
    dev, prod = rows["dev-db-1"], rows["prod-db-1"]
    dev_by_email, prod_by_email = index_by_email(dev), index_by_email(prod)
    dev_unique = set(dev_by_email)
    prod_unique = set(prod_by_email)
    print("READ-ONLY DEV / PROD — ALL USERS")
    print("DEV total:", len(dev))
    print("PROD total:", len(prod))
    print("Matching normalized emails:", len(dev_unique & prod_unique))
    print("Email keys only DEV:", len(dev_unique - prod_unique))
    print("Email keys only PROD:", len(prod_unique - dev_unique))
    print("DEV case-insensitive duplicate email groups:", sum(len(x) > 1 for x in dev_by_email.values()))
    print("PROD case-insensitive duplicate email groups:", sum(len(x) > 1 for x in prod_by_email.values()))

    prod_sources = defaultdict(set)
    for user in prod:
        for key in user["lineage"]:
            prod_sources[key].add(user["fingerprint"])
    candidates = sorted(
        (user for user in dev if user["fingerprint"] not in prod_unique),
        key=lambda u: (u["lineage"], u["role"], u["status"], u["created"], u["fingerprint"])
    )
    active = [x for x in candidates if x["lifecycle"] == "LIVE"]
    deleted = [x for x in candidates if x["lifecycle"] != "LIVE"]
    print("DEV-only live users (need manual classification):", len(active))
    print("DEV-only soft-deleted users (never auto-import):", len(deleted))
    for index, user in enumerate(active, start=1):
        source = ",".join(user["lineage"][:3]) if user["lineage"] else "NO_ACTIVE_LINEAGE"
        matched_keys = [key for key in user["lineage"] if key in prod_sources]
        if any(user["fingerprint"] not in prod_sources[k] for k in matched_keys):
            source_state = "SAME_SOURCE_DIFFERENT_EMAIL_IN_PROD"
        elif matched_keys:
            source_state = "SOURCE_KEY_EXISTS_IN_PROD"
        else:
            source_state = "NO_MATCHED_SOURCE_IN_PROD"
        print(
            f"  {index}. source={source}; role={user['role']}; "
            f"status={user['status']}; credential={user['credential']}; "
            f"created={user['created']}; source_match={source_state}; "
            f"email={user['email_verified']}; {user['login']}; "
            f"{user['display_name']}; "
            f"businessesOwned={user['business_owned']}; "
            f"businessMemberships={user['business_memberships']}; "
            f"activitiesOwned={user['activities_owned']}; "
            f"familyMemberships={user['family_memberships']}; "
            f"sessions={user['sessions']}"
        )
    prod_deleted_matches = [
        user for user in dev if user["lifecycle"] == "LIVE"
        and user["fingerprint"] in prod_unique
        and not any(x["lifecycle"] == "LIVE" for x in prod_by_email[user["fingerprint"]])
    ]
    print("DEV live users matching only soft-deleted PROD email:", len(prod_deleted_matches))
    print("No emails, names, hashes or User IDs printed. NO DATABASE WRITES.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        print(f"Audit failed: {error}", file=sys.stderr)
        sys.exit(1)
