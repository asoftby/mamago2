-- Keep the coarse platform role in sync with already-approved business ownership.
-- Resource-level access still comes from BusinessMember / business permissions.
-- Do not overwrite ADMIN or MODERATOR roles.

UPDATE "User" AS u
SET "role" = 'BUSINESS_OWNER'::"Role"
WHERE u."role" = 'USER'::"Role"
  AND EXISTS (
    SELECT 1
    FROM "Business" AS b
    WHERE b."ownerUserId" = u."id"
      AND b."verificationStatus" = 'APPROVED'::"BusinessVerificationStatus"
  );
