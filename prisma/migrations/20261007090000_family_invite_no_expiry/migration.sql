-- Family invites become open-ended: expiresAt NULL = no expiry (until accepted or revoked).
-- Existing rows keep their dates. Additive/relaxing only.
ALTER TABLE "FamilyInvite" ALTER COLUMN "expiresAt" DROP NOT NULL;
