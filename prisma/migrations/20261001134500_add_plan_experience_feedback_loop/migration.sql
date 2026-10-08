-- Phase C: explicit Plan -> Experience outcome truth. No historical backfill.
ALTER TYPE "UserEventType" ADD VALUE 'ATTENDED';
ALTER TYPE "UserEventType" ADD VALUE 'EXPERIENCE_FEEDBACK';

-- Nullable and server-only: existing/ordinary telemetry rows remain untouched.
ALTER TABLE "UserEvent" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "UserEvent_idempotencyKey_key" ON "UserEvent"("idempotencyKey");

CREATE TYPE "ExperienceAttendance" AS ENUM ('ATTENDED', 'NOT_ATTENDED');
CREATE TYPE "ExperienceSentiment" AS ENUM ('LIKE', 'NEUTRAL', 'DISLIKE');

CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourcePlanItemId" TEXT NOT NULL,
    "entityType" "AnalyticsEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "plannedDate" TEXT NOT NULL,
    "plannedStartsAt" TIMESTAMP(3),
    "attendance" "ExperienceAttendance" NOT NULL,
    "attendanceConfirmedAt" TIMESTAMP(3) NOT NULL,
    "subjects" JSONB,
    "sourceDecisionId" TEXT,
    "sourceExposureId" TEXT,
    "feedbackSentiment" "ExperienceSentiment",
    "feedbackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Experience_sourcePlanItemId_key" ON "Experience"("sourcePlanItemId");
CREATE INDEX "Experience_userId_plannedDate_idx" ON "Experience"("userId", "plannedDate");
CREATE INDEX "Experience_userId_entityType_entityId_idx" ON "Experience"("userId", "entityType", "entityId");
CREATE INDEX "Experience_sourceDecisionId_idx" ON "Experience"("sourceDecisionId");
CREATE INDEX "Experience_sourceExposureId_idx" ON "Experience"("sourceExposureId");

ALTER TABLE "Experience" ADD CONSTRAINT "Experience_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
