-- Final cleanup for transitional User.role synchronization introduced by
-- 20260901170000_sync_verified_business_owner_roles.
--
-- Keep this migration idempotent and drop both the exact historical object names
-- and the alternate names referenced by the previous cleanup migration.

DROP TRIGGER IF EXISTS "BusinessMember_syncPlatformRole" ON "BusinessMember";
DROP FUNCTION IF EXISTS "syncBusinessMemberPlatformRole"();

DROP TRIGGER IF EXISTS "Business_syncApprovedPlatformRoles" ON "Business";
DROP FUNCTION IF EXISTS "syncApprovedBusinessPlatformRoles"();

DROP TRIGGER IF EXISTS "Business_syncMemberPlatformRoles" ON "Business";
DROP FUNCTION IF EXISTS "syncApprovedBusinessMemberPlatformRoles"();
