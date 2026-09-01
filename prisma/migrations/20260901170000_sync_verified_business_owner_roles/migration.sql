-- Transitional compatibility for legacy business routes that still use User.role
-- as a coarse eligibility gate. Canonical resource access remains BusinessMember
-- + business permissions. Never overwrite ADMIN or MODERATOR.

-- Backfill approved canonical owners and active OWNER/MANAGER memberships.
UPDATE "User" AS u
SET "role" = 'BUSINESS_OWNER'::"Role"
WHERE u."role" = 'USER'::"Role"
  AND (
    EXISTS (
      SELECT 1
      FROM "Business" AS b
      WHERE b."ownerUserId" = u."id"
        AND b."verificationStatus" = 'APPROVED'::"BusinessVerificationStatus"
    )
    OR EXISTS (
      SELECT 1
      FROM "BusinessMember" AS bm
      JOIN "Business" AS b ON b."id" = bm."businessId"
      WHERE bm."userId" = u."id"
        AND bm."isActive" = TRUE
        AND bm."role" IN (
          'OWNER'::"BusinessMemberRole",
          'MANAGER'::"BusinessMemberRole"
        )
        AND b."verificationStatus" = 'APPROVED'::"BusinessVerificationStatus"
    )
  );

-- Future team membership must not regress on legacy route gates. This trigger is
-- deliberately one-way: removing one membership must not downgrade a user who may
-- still belong to another business. Resource-level authorization remains canonical.
CREATE OR REPLACE FUNCTION "syncBusinessMemberPlatformRole"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."isActive" = TRUE
     AND NEW."role" IN (
       'OWNER'::"BusinessMemberRole",
       'MANAGER'::"BusinessMemberRole"
     )
     AND EXISTS (
       SELECT 1
       FROM "Business" AS b
       WHERE b."id" = NEW."businessId"
         AND b."verificationStatus" = 'APPROVED'::"BusinessVerificationStatus"
     )
  THEN
    UPDATE "User"
    SET "role" = 'BUSINESS_OWNER'::"Role"
    WHERE "id" = NEW."userId"
      AND "role" = 'USER'::"Role";
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "BusinessMember_syncPlatformRole" ON "BusinessMember";

CREATE TRIGGER "BusinessMember_syncPlatformRole"
AFTER INSERT OR UPDATE OF "isActive", "role", "businessId", "userId"
ON "BusinessMember"
FOR EACH ROW
EXECUTE FUNCTION "syncBusinessMemberPlatformRole"();

-- If OWNER/MANAGER membership already exists before verification is approved,
-- synchronize those users at the moment the business becomes APPROVED.
CREATE OR REPLACE FUNCTION "syncApprovedBusinessPlatformRoles"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."verificationStatus" = 'APPROVED'::"BusinessVerificationStatus"
     AND OLD."verificationStatus" IS DISTINCT FROM NEW."verificationStatus"
  THEN
    UPDATE "User" AS u
    SET "role" = 'BUSINESS_OWNER'::"Role"
    WHERE u."role" = 'USER'::"Role"
      AND (
        u."id" = NEW."ownerUserId"
        OR EXISTS (
          SELECT 1
          FROM "BusinessMember" AS bm
          WHERE bm."businessId" = NEW."id"
            AND bm."userId" = u."id"
            AND bm."isActive" = TRUE
            AND bm."role" IN (
              'OWNER'::"BusinessMemberRole",
              'MANAGER'::"BusinessMemberRole"
            )
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Business_syncApprovedPlatformRoles" ON "Business";

CREATE TRIGGER "Business_syncApprovedPlatformRoles"
AFTER UPDATE OF "verificationStatus"
ON "Business"
FOR EACH ROW
EXECUTE FUNCTION "syncApprovedBusinessPlatformRoles"();
