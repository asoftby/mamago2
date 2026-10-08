-- Decision Context v1 (PR A: FAM-001, FAM-005, ONB-013)
-- All new columns are nullable additive; existing code paths keep working
-- unchanged. `decisionId` is intentionally not a foreign key: raw UserEvent
-- history must not depend on recommendation-retention tables.

-- AlterTable
ALTER TABLE "UserEvent"
  ADD COLUMN "decisionId" TEXT,
  ADD COLUMN "anonymousId" TEXT;

-- CreateIndex
CREATE INDEX "UserEvent_decisionId_idx" ON "UserEvent"("decisionId");

-- CreateIndex
CREATE INDEX "UserEvent_anonymousId_createdAt_idx" ON "UserEvent"("anonymousId", "createdAt");

-- AlterTable
ALTER TABLE "RecommendationRun"
  ADD COLUMN "anonymousId" TEXT;

-- CreateIndex
CREATE INDEX "RecommendationRun_anonymousId_generatedAt_idx" ON "RecommendationRun"("anonymousId", "generatedAt");

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "UserEventType" ADD VALUE 'AUTH_STARTED';
ALTER TYPE "UserEventType" ADD VALUE 'AUTH_COMPLETED';
ALTER TYPE "UserEventType" ADD VALUE 'FAMILY_ONBOARDING_STARTED';
ALTER TYPE "UserEventType" ADD VALUE 'CHILD_SAVED';
ALTER TYPE "UserEventType" ADD VALUE 'CHILD_CONTEXT_COMPLETED';
ALTER TYPE "UserEventType" ADD VALUE 'ONBOARDING_COMPLETED';
ALTER TYPE "UserEventType" ADD VALUE 'FIRST_PERSONALIZED_RESULT';
ALTER TYPE "UserEventType" ADD VALUE 'FIRST_PERSONALIZED_PLAN_ADD';
ALTER TYPE "UserEventType" ADD VALUE 'PLAN_AUDIENCE_SNAPSHOT';
