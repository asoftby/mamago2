-- Canonicalize partner authorization on BusinessMember.
-- Business.ownerUserId remains ownership metadata, not an authorization source.

-- Ensure every canonical business owner has an active OWNER membership.
INSERT INTO "BusinessMember" (
  "id",
  "businessId",
  "userId",
  "role",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'bm_' || md5(b."id" || ':' || b."ownerUserId"),
  b."id",
  b."ownerUserId",
  'OWNER'::"BusinessMemberRole",
  TRUE,
  NOW(),
  NOW()
FROM "Business" b
WHERE b."ownerUserId" IS NOT NULL
ON CONFLICT ("businessId", "userId") DO UPDATE
SET
  "role" = 'OWNER'::"BusinessMemberRole",
  "isActive" = TRUE,
  "updatedAt" = NOW();

-- Remove the transitional User.role synchronization layer. Existing role values
-- are intentionally left untouched; application authorization no longer trusts
-- BUSINESS_OWNER for partner/resource access.
DROP TRIGGER IF EXISTS "BusinessMember_syncPlatformRole" ON "BusinessMember";
DROP FUNCTION IF EXISTS "syncBusinessMemberPlatformRole"();
DROP TRIGGER IF EXISTS "Business_syncMemberPlatformRoles" ON "Business";
DROP FUNCTION IF EXISTS "syncApprovedBusinessMemberPlatformRoles"();
