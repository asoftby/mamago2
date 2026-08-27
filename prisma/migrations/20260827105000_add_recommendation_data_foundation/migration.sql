-- CreateEnum
CREATE TYPE "RecommendationSurface" AS ENUM ('HOME', 'DISCOVERY', 'MY_PLAN', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "RecommendationPolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "RecommendationSurfacePolicy" (
    "id" TEXT NOT NULL,
    "surface" "RecommendationSurface" NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RecommendationPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "algorithmVersion" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationSurfacePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "surface" "RecommendationSurface" NOT NULL,
    "cityId" TEXT,
    "citySlug" TEXT,
    "targetDateFrom" TEXT,
    "targetDateTo" TEXT,
    "algorithmVersion" TEXT NOT NULL,
    "policyId" TEXT,
    "policyVersion" INTEGER,
    "context" JSONB,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "selectedCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationExposure" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "entityType" "AnalyticsEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "scoreBreakdown" JSONB,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "RecommendationExposure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationOutcome" (
    "id" TEXT NOT NULL,
    "exposureId" TEXT NOT NULL,
    "userEventId" TEXT NOT NULL,
    "eventType" "UserEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationSurfacePolicy_surface_version_key" ON "RecommendationSurfacePolicy"("surface", "version");
CREATE INDEX "RecommendationSurfacePolicy_surface_status_idx" ON "RecommendationSurfacePolicy"("surface", "status");
CREATE INDEX "RecommendationSurfacePolicy_createdAt_idx" ON "RecommendationSurfacePolicy"("createdAt");

CREATE INDEX "RecommendationRun_userId_generatedAt_idx" ON "RecommendationRun"("userId", "generatedAt");
CREATE INDEX "RecommendationRun_sessionId_generatedAt_idx" ON "RecommendationRun"("sessionId", "generatedAt");
CREATE INDEX "RecommendationRun_surface_generatedAt_idx" ON "RecommendationRun"("surface", "generatedAt");
CREATE INDEX "RecommendationRun_cityId_generatedAt_idx" ON "RecommendationRun"("cityId", "generatedAt");
CREATE INDEX "RecommendationRun_policyId_idx" ON "RecommendationRun"("policyId");

CREATE UNIQUE INDEX "RecommendationExposure_runId_entityType_entityId_key" ON "RecommendationExposure"("runId", "entityType", "entityId");
CREATE INDEX "RecommendationExposure_entityType_entityId_exposedAt_idx" ON "RecommendationExposure"("entityType", "entityId", "exposedAt");
CREATE INDEX "RecommendationExposure_runId_position_idx" ON "RecommendationExposure"("runId", "position");

CREATE UNIQUE INDEX "RecommendationOutcome_userEventId_key" ON "RecommendationOutcome"("userEventId");
CREATE INDEX "RecommendationOutcome_exposureId_eventType_createdAt_idx" ON "RecommendationOutcome"("exposureId", "eventType", "createdAt");
CREATE INDEX "RecommendationOutcome_eventType_createdAt_idx" ON "RecommendationOutcome"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "RecommendationRun" ADD CONSTRAINT "RecommendationRun_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "RecommendationSurfacePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationExposure" ADD CONSTRAINT "RecommendationExposure_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RecommendationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_exposureId_fkey" FOREIGN KEY ("exposureId") REFERENCES "RecommendationExposure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Repair legacy profile semantics. These keys were entity types (EVENT/OFFER/...)
-- accidentally stored inside preferredCategories; semantic category IDs now
-- populate this projection instead. Raw UserEvent history is untouched.
UPDATE "UserBehaviorProfile"
SET "preferredCategories" = COALESCE("preferredCategories", '{}'::jsonb)
  - ARRAY['EVENT', 'OFFER', 'PLACE', 'ROUTE', 'ARTICLE', '_none']::text[]
WHERE "preferredCategories" IS NOT NULL;
