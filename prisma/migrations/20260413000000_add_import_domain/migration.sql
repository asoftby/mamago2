-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('WEBSITE', 'RSS_FEED', 'JSON_API', 'CSV_FILE', 'SITEMAP', 'MANUAL');

-- CreateEnum
CREATE TYPE "ImportSourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ImportEntityType" AS ENUM ('PLACE', 'EVENT', 'OFFER');

-- CreateEnum
CREATE TYPE "ImportFetchStrategy" AS ENUM ('HTML_SCRAPE', 'RSS', 'JSON_API', 'CSV', 'SITEMAP_CRAWL', 'MANUAL_UPLOAD');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportTriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "ImportParseStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ImportNormalizeStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ImportMatchStatus" AS ENUM ('PENDING', 'MATCHED', 'NO_MATCH', 'AMBIGUOUS', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ImportReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ImportReviewTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportSuggestedAction" AS ENUM ('CREATE_NEW', 'UPDATE_EXISTING', 'MERGE', 'REJECT', 'SKIP');

-- CreateEnum
CREATE TYPE "ImportDecision" AS ENUM ('APPROVED_CREATE', 'APPROVED_UPDATE', 'APPROVED_MERGE', 'REJECTED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "ImportFieldLockMode" AS ENUM ('LOCKED', 'PREFER_IMPORT', 'PREFER_MANUAL');

-- DropIndex
DROP INDEX "TelegramLinkToken_userId_expiresAt_idx";

-- AlterTable
DO $$
BEGIN
  IF to_regclass('"DevTelegramBusinessApplication"') IS NOT NULL THEN
    ALTER TABLE "DevTelegramBusinessApplication" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable
DO $$
BEGIN
  IF to_regclass('"TelegramConnection"') IS NOT NULL THEN
    ALTER TABLE "TelegramConnection" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'TelegramLinkToken'
      AND column_name = 'environment'
  ) THEN
    ALTER TABLE "TelegramLinkToken" ALTER COLUMN "environment" DROP DEFAULT;
  END IF;
END $$;

-- CreateTable
CREATE TABLE "ImportSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ImportSourceType" NOT NULL,
    "status" "ImportSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "baseUrl" TEXT,
    "parserKey" TEXT,
    "fetchStrategy" "ImportFetchStrategy" NOT NULL DEFAULT 'HTML_SCRAPE',
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "isAutoUpdate" BOOLEAN NOT NULL DEFAULT false,
    "defaultEntity" "ImportEntityType",
    "rateLimitMs" INTEGER,
    "notes" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "cityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "totalParsed" INTEGER NOT NULL DEFAULT 0,
    "totalCreated" INTEGER NOT NULL DEFAULT 0,
    "totalUpdated" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalRejected" INTEGER NOT NULL DEFAULT 0,
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "triggerType" "ImportTriggerType" NOT NULL DEFAULT 'MANUAL',
    "triggerUserId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedRecord" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "externalId" TEXT,
    "sourceUrl" TEXT,
    "canonicalSourceUrl" TEXT,
    "entityTypeHint" "ImportEntityType",
    "rawPayload" JSONB,
    "rawText" TEXT,
    "contentHash" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "parseStatus" "ImportParseStatus" NOT NULL DEFAULT 'PENDING',
    "normalizeStatus" "ImportNormalizeStatus" NOT NULL DEFAULT 'PENDING',
    "matchStatus" "ImportMatchStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "ImportReviewStatus" NOT NULL DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "normalizedData" JSONB,
    "matchCandidates" JSONB,
    "reviewDecision" JSONB,
    "publishedPlaceId" TEXT,
    "publishedActivityId" TEXT,
    "errorMessage" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportReviewTask" (
    "id" TEXT NOT NULL,
    "importedRecordId" TEXT NOT NULL,
    "status" "ImportReviewTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "suggestedAction" "ImportSuggestedAction",
    "decision" "ImportDecision",
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportFieldOverride" (
    "id" TEXT NOT NULL,
    "entityType" "ImportEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "lockMode" "ImportFieldLockMode" NOT NULL DEFAULT 'LOCKED',
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportFieldOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportSource_slug_key" ON "ImportSource"("slug");

-- CreateIndex
CREATE INDEX "ImportSource_status_idx" ON "ImportSource"("status");

-- CreateIndex
CREATE INDEX "ImportSource_type_idx" ON "ImportSource"("type");

-- CreateIndex
CREATE INDEX "ImportSource_cityId_idx" ON "ImportSource"("cityId");

-- CreateIndex
CREATE INDEX "ImportRun_sourceId_idx" ON "ImportRun"("sourceId");

-- CreateIndex
CREATE INDEX "ImportRun_status_idx" ON "ImportRun"("status");

-- CreateIndex
CREATE INDEX "ImportRun_sourceId_status_idx" ON "ImportRun"("sourceId", "status");

-- CreateIndex
CREATE INDEX "ImportRun_createdAt_idx" ON "ImportRun"("createdAt");

-- CreateIndex
CREATE INDEX "ImportedRecord_sourceId_reviewStatus_idx" ON "ImportedRecord"("sourceId", "reviewStatus");

-- CreateIndex
CREATE INDEX "ImportedRecord_sourceId_externalId_idx" ON "ImportedRecord"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "ImportedRecord_contentHash_idx" ON "ImportedRecord"("contentHash");

-- CreateIndex
CREATE INDEX "ImportedRecord_runId_idx" ON "ImportedRecord"("runId");

-- CreateIndex
CREATE INDEX "ImportedRecord_parseStatus_idx" ON "ImportedRecord"("parseStatus");

-- CreateIndex
CREATE INDEX "ImportedRecord_normalizeStatus_idx" ON "ImportedRecord"("normalizeStatus");

-- CreateIndex
CREATE INDEX "ImportedRecord_matchStatus_idx" ON "ImportedRecord"("matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ImportReviewTask_importedRecordId_key" ON "ImportReviewTask"("importedRecordId");

-- CreateIndex
CREATE INDEX "ImportReviewTask_status_idx" ON "ImportReviewTask"("status");

-- CreateIndex
CREATE INDEX "ImportReviewTask_priority_idx" ON "ImportReviewTask"("priority");

-- CreateIndex
CREATE INDEX "ImportReviewTask_status_priority_idx" ON "ImportReviewTask"("status", "priority");

-- CreateIndex
CREATE INDEX "ImportFieldOverride_entityType_entityId_idx" ON "ImportFieldOverride"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportFieldOverride_entityType_entityId_fieldName_key" ON "ImportFieldOverride"("entityType", "entityId", "fieldName");

-- AddForeignKey
ALTER TABLE "ImportSource" ADD CONSTRAINT "ImportSource_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ImportSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedRecord" ADD CONSTRAINT "ImportedRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ImportSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedRecord" ADD CONSTRAINT "ImportedRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedRecord" ADD CONSTRAINT "ImportedRecord_publishedPlaceId_fkey" FOREIGN KEY ("publishedPlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedRecord" ADD CONSTRAINT "ImportedRecord_publishedActivityId_fkey" FOREIGN KEY ("publishedActivityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportReviewTask" ADD CONSTRAINT "ImportReviewTask_importedRecordId_fkey" FOREIGN KEY ("importedRecordId") REFERENCES "ImportedRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
