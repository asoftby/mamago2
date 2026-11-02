#!/usr/bin/env python3
"""Read-only business/activity overlap for DEV-only user emails; no PII output."""
import subprocess
import sys
from collections import defaultdict

SQL = r"""
set -euo pipefail
for container in dev-db-1 prod-db-1; do
  printf 'BEGIN:%s\n' "$container"
  docker exec -i "$container" sh -c '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    exec psql -XAt -v ON_ERROR_STOP=1 -F "|" -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  ' <<'DBSQL'
SELECT 'DB', current_database();
SELECT 'U', md5(lower(btrim(u.email))), u.role::text, u.status::text,
  to_char(u."createdAt" AT TIME ZONE 'UTC','YYYY-MM'),
  COALESCE((SELECT string_agg(DISTINCT s."adapterKey" || '/' || l."sourceRecordKey", ';')
  FROM "MigrationLineage" l JOIN "MigrationSource" s ON s.id=l."sourceId"
  WHERE l."targetId"=u.id AND l."targetType"='USER' AND l."isActive"=true),'')
FROM "User" u WHERE u."deletedAt" IS NULL AND u.email IS NOT NULL;
SELECT 'B', md5(lower(btrim(u.email))), md5(lower(btrim(b.name))),
  CASE WHEN nullif(btrim(b.unp),'') IS NULL THEN '' ELSE md5(btrim(b.unp)) END,
  b.status::text, b."verificationStatus"::text, b."isVerified"::text,
  COALESCE((SELECT string_agg(DISTINCT s."adapterKey" || '/' || l."sourceRecordKey", ';')
  FROM "MigrationLineage" l JOIN "MigrationSource" s ON s.id=l."sourceId"
  WHERE l."targetId"=b.id AND l."targetType"='BUSINESS' AND l."isActive"=true),'')
FROM "Business" b JOIN "User" u ON u.id=b."ownerUserId";
SELECT 'A', md5(lower(btrim(u.email))), md5(lower(btrim(a.title))),
  CASE WHEN nullif(btrim(a.slug),'') IS NULL THEN '' ELSE md5(lower(btrim(a.slug))) END,
  a.status::text,
  COALESCE((SELECT string_agg(DISTINCT s."adapterKey" || '/' || l."sourceRecordKey", ';')
  FROM "MigrationLineage" l JOIN "MigrationSource" s ON s.id=l."sourceId"
  WHERE l."targetId"=a.id AND l."targetType"='ACTIVITY' AND l."isActive"=true),'')
FROM "Activity" a JOIN "User" u ON u.id=a."ownerUserId";
DBSQL
  printf 'END:%s\n' "$container"
done
"""

def parse():
    try:
        proc = subprocess.run(
            ["ssh","-o","BatchMode=yes","-o","ConnectTimeout=15",
             "-o","ServerAliveInterval=15","-o","ServerAliveCountMax=3",
             "-T","mamago-prod","bash -s"],
            input=SQL,text=True,capture_output=True,timeout=150,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("Read-only SSH audit timed out") from None
    if proc.returncode:
        raise RuntimeError("Read-only SSH audit failed; check connection privately")
    data={k:{"name":None,"users":{},"business":[],"activity":[]}
          for k in ("dev-db-1","prod-db-1")}
    current=None
    visited=set()
    for line in proc.stdout.splitlines():
        if line.startswith("BEGIN:"):
            current=line[6:]
            if current not in data or current in visited:
                raise RuntimeError("Unrecognized result section")
            visited.add(current)
            continue
        if line.startswith("END:"):
            if current!=line[4:]:
                raise RuntimeError("Unbalanced result sections")
            current=None
            continue
        if current is None:
            raise RuntimeError("Unexpected remote output")
        fields=line.split("|")
        if fields[0]=="DB" and len(fields)==2:
            data[current]["name"]=fields[1]
        elif fields[0]=="U" and len(fields)==6:
            _,fp,role,status,month,sources=fields
            data[current]["users"][fp]={"role":role,"status":status,
                                         "month":month,"source":set(filter(None,sources.split(";")))}
        elif fields[0]=="B" and len(fields)==8:
            _,fp,name,unp,status,verification,verified,sources=fields
            data[current]["business"].append({"owner":fp,"name":name,"unp":unp,
                 "status":status,"verification":verification,"verified":verified,
                 "source":set(filter(None,sources.split(";")))})
        elif fields[0]=="A" and len(fields)==6:
            _,fp,title,slug,status,sources=fields
            data[current]["activity"].append({"owner":fp,"title":title,"slug":slug,
                 "status":status,"source":set(filter(None,sources.split(";")))})
        else:
            raise RuntimeError("Unexpected SELECT data shape")
    if (current is not None or visited!=set(data)
        or data["dev-db-1"]["name"]!="devmamago"
        or data["prod-db-1"]["name"]!="prodmamago"):
        raise RuntimeError("Unexpected DB identity or incomplete SSH output")
    return data

def matches(item, target, field):
    if field=="source":
        return sum(bool(item["source"] & other["source"]) for other in target)
    return sum(bool(item[field]) and item[field]==other[field] for other in target)

def main():
    if len(sys.argv)!=1:
        raise RuntimeError("Read-only audit accepts no arguments")
    all_data=parse()
    dev,prod=all_data["dev-db-1"],all_data["prod-db-1"]
    missing=sorted(
        ((key,u) for key,u in dev["users"].items() if key not in prod["users"]),
        key=lambda x: (
            tuple(sorted(x[1]["source"])),x[1]["role"],x[1]["status"],x[1]["month"],x[0]
        )
    )
    print("READ-ONLY DEV-ONLY OWNERSHIP OVERLAP:",len(missing),"users")
    for index,(fp,user) in enumerate(missing,1):
        source=",".join(sorted(user["source"])[:3]) if user["source"] else "NO_ACTIVE_LINEAGE"
        business=[b for b in dev["business"] if b["owner"]==fp]
        activity=[a for a in dev["activity"] if a["owner"]==fp]
        print(f"  User {index}: source={source}; role={user['role']}; devBusinesses={len(business)}; devActivities={len(activity)}")
        for n,b in enumerate(business,1):
            print(f"    Business {n}: status={b['status']}; verified={b['verified']}; "
                  f"hasUNP={'YES' if b['unp'] else 'NO'}; "
                  f"PROD sameSource={matches(b,prod['business'],'source')}, "
                  f"sameUNP={matches(b,prod['business'],'unp')}, "
                  f"sameName={matches(b,prod['business'],'name')}")
        for n,a in enumerate(activity,1):
            print(f"    Activity {n}: status={a['status']}; "
                  f"PROD sameSource={matches(a,prod['activity'],'source')}, "
                  f"sameSlug={matches(a,prod['activity'],'slug')}, "
                  f"sameTitle={matches(a,prod['activity'],'title')}")
    print("All comparisons are read-only. Name/title matches alone are not authoritative.")

if __name__=="__main__":
    try:
        main()
    except (RuntimeError,OSError,ValueError) as error:
        print(f"Audit failed: {error}",file=sys.stderr)
        sys.exit(1)
