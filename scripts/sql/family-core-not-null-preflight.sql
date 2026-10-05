-- Family Core A2: READ-ONLY preflight before any NOT NULL / CHECK hardening of
-- Child.familyId and PlanItem.familyId. Run on PROD after the B1 migration and
-- `scripts/family-core-backfill.ts` (incl. --events). Every `must_be_zero` row
-- must be 0; `info` rows feed the tombstone decision. Changes nothing.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/family-core-not-null-preflight.sql

SELECT 'child_null_family_live_user' AS check_name, 'must_be_zero' AS kind, count(*) AS n
FROM "Child" c JOIN "User" u ON u.id = c."parentId"
WHERE c."familyId" IS NULL AND u."deletedAt" IS NULL
UNION ALL
SELECT 'planitem_null_family_live_user', 'must_be_zero', count(*)
FROM "PlanItem" p JOIN "User" u ON u.id = p."userId"
WHERE p."familyId" IS NULL AND u."deletedAt" IS NULL
UNION ALL
SELECT 'child_null_family_tombstone_user', 'info', count(*)
FROM "Child" c JOIN "User" u ON u.id = c."parentId"
WHERE c."familyId" IS NULL AND u."deletedAt" IS NOT NULL
UNION ALL
SELECT 'planitem_null_family_tombstone_user', 'info', count(*)
FROM "PlanItem" p JOIN "User" u ON u.id = p."userId"
WHERE p."familyId" IS NULL AND u."deletedAt" IS NOT NULL
UNION ALL
SELECT 'live_user_without_active_membership_but_with_data', 'must_be_zero', count(*)
FROM "User" u
WHERE u."deletedAt" IS NULL
  AND (EXISTS (SELECT 1 FROM "Child" c WHERE c."parentId" = u.id)
    OR EXISTS (SELECT 1 FROM "PlanItem" p WHERE p."userId" = u.id))
  AND NOT EXISTS (SELECT 1 FROM "FamilyMembership" m WHERE m."userId" = u.id AND m."leftAt" IS NULL)
UNION ALL
SELECT 'deleted_user_with_active_membership', 'must_be_zero', count(*)
FROM "FamilyMembership" m JOIN "User" u ON u.id = m."userId"
WHERE m."leftAt" IS NULL AND u."deletedAt" IS NOT NULL
UNION ALL
SELECT 'planitem_family_never_joined_by_owner', 'must_be_zero', count(*)
FROM "PlanItem" p
WHERE p."familyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FamilyMembership" m WHERE m."familyId" = p."familyId" AND m."userId" = p."userId")
UNION ALL
SELECT 'child_family_never_joined_by_parent', 'must_be_zero', count(*)
FROM "Child" c
WHERE c."familyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FamilyMembership" m WHERE m."familyId" = c."familyId" AND m."userId" = c."parentId")
UNION ALL
SELECT 'family_with_active_members_but_no_active_owner', 'must_be_zero', count(*)
FROM "Family" f
WHERE EXISTS (SELECT 1 FROM "FamilyMembership" m WHERE m."familyId" = f.id AND m."leftAt" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "FamilyMembership" m WHERE m."familyId" = f.id AND m."leftAt" IS NULL AND m."role" = 'OWNER')
UNION ALL
SELECT 'family_without_active_members_not_archived', 'must_be_zero', count(*)
FROM "Family" f
WHERE f."archivedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "FamilyMembership" m WHERE m."familyId" = f.id AND m."leftAt" IS NULL)
UNION ALL
SELECT 'planitem_private_proposed_violation', 'must_be_zero', count(*)
FROM "PlanItem" WHERE "visibility" = 'PRIVATE' AND "status" = 'PROPOSED'
UNION ALL
SELECT 'family_events_with_user_but_null_family_and_active_membership', 'must_be_zero', count(*)
FROM "UserEvent" e
WHERE e."familyId" IS NULL AND e."userId" IS NOT NULL
  AND e."eventType"::text IN ('PLAN_ADD','PLAN_REMOVE','FIRST_PERSONALIZED_PLAN_ADD','PLAN_AUDIENCE_SNAPSHOT','ATTENDED','EXPERIENCE_FEEDBACK')
  AND EXISTS (SELECT 1 FROM "FamilyMembership" m WHERE m."userId" = e."userId" AND m."leftAt" IS NULL)
ORDER BY kind DESC, check_name;
