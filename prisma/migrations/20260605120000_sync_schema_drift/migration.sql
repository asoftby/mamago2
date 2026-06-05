-- Sync schema drift accumulated from out-of-band db push / manual edits.
-- All operations use IF NOT EXISTS so the migration is idempotent against
-- databases where some of these changes were applied manually (e.g. prod
-- showTitle ALTER) or via db push on dev environments.

-- AlterEnum: UiPlacement
ALTER TYPE "UiPlacement" ADD VALUE IF NOT EXISTS 'MODAL';
ALTER TYPE "UiPlacement" ADD VALUE IF NOT EXISTS 'ADVANCED';

-- AlterEnum: UserEventType
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'BOOKING_CREATED';
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'BOOKING_CONFIRMED';
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'BOOKING_COMPLETED';
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'BOOKING_CANCELLED';
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'FEEDBACK_LEFT';

-- AlterTable: Article
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- AlterTable: BillingTransaction
ALTER TABLE "BillingTransaction" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE INDEX IF NOT EXISTS "BillingTransaction_idempotencyKey_idx" ON "BillingTransaction"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingTransaction_billingAccountId_idempotencyKey_key" ON "BillingTransaction"("billingAccountId", "idempotencyKey");

-- AlterTable: FilterDefinition
ALTER TABLE "FilterDefinition" ADD COLUMN IF NOT EXISTS "showTitle" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Notification
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: Offer
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "contactSocialLinks" JSONB;
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "contactSource" TEXT DEFAULT 'manual';
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "contactWebsite" TEXT;
