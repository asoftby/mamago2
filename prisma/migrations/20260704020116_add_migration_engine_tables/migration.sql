-- CreateEnum
CREATE TYPE "MigrationSourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED', 'ERROR', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MigrationRunMode" AS ENUM ('DRY_RUN', 'COMMIT');

-- CreateEnum
CREATE TYPE "MigrationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MigrationRecordStatus" AS ENUM ('DISCOVERED', 'EXTRACTED', 'NORMALIZED', 'VALIDATED', 'PLANNED', 'PUBLISHED', 'LINKED', 'COMPLETED', 'QUARANTINED', 'FAILED');

-- CreateEnum
CREATE TYPE "MigrationTargetType" AS ENUM ('USER', 'USER_PROFILE', 'CHILD', 'BUSINESS', 'BUSINESS_PROFILE', 'ORGANIZER', 'PLACE', 'OFFER', 'ACTIVITY', 'ARTICLE', 'ROUTE', 'ROUTE_STOP', 'PLACE_REVIEW', 'MEDIA_ASSET', 'TAXONOMY', 'RELATION', 'REDIRECT');

-- CreateEnum
CREATE TYPE "MigrationPlanAction" AS ENUM ('CREATE', 'UPDATE', 'LINK_EXISTING', 'SKIP_UNCHANGED', 'SKIP_POLICY', 'QUARANTINE', 'FAIL');

-- CreateEnum
CREATE TYPE "MigrationPlanStatus" AS ENUM ('PLANNED', 'SKIPPED', 'DUPLICATE', 'APPLIED', 'BOUND', 'LINKED', 'QUARANTINED', 'FAILED');

-- CreateEnum
CREATE TYPE "MigrationMediaScope" AS ENUM ('USER_PROFILE', 'BUSINESS_PROFILE', 'PLACE', 'ARTICLE', 'OFFER_SERVICES', 'OFFER_PROGRAMS', 'ROUTE', 'EVENT_BLOCKED');

-- CreateEnum
CREATE TYPE "MigrationReviewTaskStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MigrationReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'LINK_EXISTING', 'SKIP', 'DEFER', 'NEEDS_MORE_DATA');

-- CreateEnum
CREATE TYPE "MigrationQuarantineStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED', 'RETRYING');

-- CreateEnum
CREATE TYPE "MigrationSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'BLOCKER');

-- CreateEnum
CREATE TYPE "MigrationReportType" AS ENUM ('MACHINE', 'HUMAN', 'MANUAL_REVIEW', 'QUARANTINE');

-- CreateTable
CREATE TABLE "MigrationSource" (
    "id" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "sourceNamespace" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MigrationSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB,
    "scope" JSONB,
    "capabilities" JSONB,
    "notes" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "mode" "MigrationRunMode" NOT NULL,
    "status" "MigrationRunStatus" NOT NULL DEFAULT 'PENDING',
    "adapterVersion" TEXT NOT NULL,
    "triggerType" TEXT,
    "triggerUserId" TEXT,
    "resumedFromRunId" TEXT,
    "snapshotHash" TEXT,
    "snapshotRef" TEXT,
    "planHash" TEXT,
    "counters" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationRecord" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "status" "MigrationRecordStatus" NOT NULL DEFAULT 'DISCOVERED',
    "sourceEntityType" TEXT NOT NULL,
    "sourceExternalId" TEXT,
    "sourceStableKey" TEXT NOT NULL,
    "sourceRecordKey" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "canonicalSourceUrl" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "sourceHash" TEXT,
    "rawPayloadRef" TEXT,
    "rawPayload" JSONB,
    "normalizedPayloadRef" TEXT,
    "normalizedPayload" JSONB,
    "targetTypeHint" "MigrationTargetType",
    "planAction" "MigrationPlanAction",
    "planSummary" JSONB,
    "validationSummary" JSONB,
    "dependencyRefs" JSONB,
    "mediaRefs" JSONB,
    "relationRefs" JSONB,
    "redirectRefs" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationLineage" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "recordId" TEXT,
    "runId" TEXT,
    "sourceEntityType" TEXT NOT NULL,
    "sourceExternalId" TEXT,
    "sourceStableKey" TEXT NOT NULL,
    "sourceRecordKey" TEXT NOT NULL,
    "targetType" "MigrationTargetType" NOT NULL,
    "targetId" TEXT,
    "targetRole" TEXT NOT NULL DEFAULT 'primary',
    "targetNaturalKey" TEXT,
    "lastSourceHash" TEXT,
    "lastPlanAction" "MigrationPlanAction",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationLineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationMediaAsset" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "recordId" TEXT,
    "status" "MigrationPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "sourceMediaKey" TEXT NOT NULL,
    "sourceMediaExternalId" TEXT,
    "sourceUrl" TEXT,
    "canonicalSourceUrl" TEXT,
    "sourcePath" TEXT,
    "sourceHash" TEXT,
    "contentHash" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "primaryScope" "MigrationMediaScope",
    "requestedBindings" JSONB,
    "approvedBindings" JSONB,
    "blockedBindings" JSONB,
    "targetMediaAssetId" TEXT,
    "bindingPlan" JSONB,
    "bindingResult" JSONB,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationRelation" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "fromRecordId" TEXT,
    "toRecordId" TEXT,
    "status" "MigrationPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "sourceRelationKey" TEXT NOT NULL,
    "sourceRelationType" TEXT NOT NULL,
    "sourceRelationExternalId" TEXT,
    "fromSourceRecordKey" TEXT,
    "toSourceRecordKey" TEXT,
    "fromTargetType" "MigrationTargetType",
    "fromTargetId" TEXT,
    "toTargetType" "MigrationTargetType",
    "toTargetId" TEXT,
    "nativeRelationType" TEXT,
    "planSummary" JSONB,
    "applyResult" JSONB,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationRedirect" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "recordId" TEXT,
    "status" "MigrationPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "sourceRedirectKey" TEXT NOT NULL,
    "sourceRedirectExternalId" TEXT,
    "sourceUrl" TEXT,
    "normalizedSourcePath" TEXT NOT NULL,
    "matchMode" TEXT NOT NULL,
    "sourceDestinationUrl" TEXT,
    "targetType" "MigrationTargetType",
    "targetId" TEXT,
    "targetUrl" TEXT,
    "httpStatus" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conflictGroupKey" TEXT,
    "planSummary" JSONB,
    "applyResult" JSONB,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationReviewTask" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "recordId" TEXT,
    "status" "MigrationReviewTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scopeKey" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "context" JSONB,
    "proposedDecision" JSONB,
    "decision" "MigrationReviewDecision",
    "decisionPayload" JSONB,
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationQuarantineItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "recordId" TEXT,
    "status" "MigrationQuarantineStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "MigrationSeverity" NOT NULL DEFAULT 'ERROR',
    "quarantineKey" TEXT NOT NULL,
    "relatedType" TEXT NOT NULL,
    "relatedKey" TEXT NOT NULL,
    "lifecycleStatus" "MigrationRecordStatus",
    "reasonCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blockingDependencies" JSONB,
    "suggestedResolution" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationQuarantineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationReportArtifact" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" "MigrationReportType" NOT NULL,
    "format" TEXT NOT NULL,
    "artifactRef" TEXT NOT NULL,
    "artifactHash" TEXT,
    "byteSize" INTEGER,
    "summary" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationReportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MigrationSource_adapterKey_status_idx" ON "MigrationSource"("adapterKey", "status");

-- CreateIndex
CREATE INDEX "MigrationSource_status_idx" ON "MigrationSource"("status");

-- CreateIndex
CREATE INDEX "MigrationSource_archivedAt_idx" ON "MigrationSource"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationSource_adapterKey_sourceNamespace_key" ON "MigrationSource"("adapterKey", "sourceNamespace");

-- CreateIndex
CREATE INDEX "MigrationRun_sourceId_status_idx" ON "MigrationRun"("sourceId", "status");

-- CreateIndex
CREATE INDEX "MigrationRun_sourceId_mode_idx" ON "MigrationRun"("sourceId", "mode");

-- CreateIndex
CREATE INDEX "MigrationRun_status_idx" ON "MigrationRun"("status");

-- CreateIndex
CREATE INDEX "MigrationRun_createdAt_idx" ON "MigrationRun"("createdAt");

-- CreateIndex
CREATE INDEX "MigrationRun_resumedFromRunId_idx" ON "MigrationRun"("resumedFromRunId");

-- CreateIndex
CREATE INDEX "MigrationRecord_sourceId_sourceRecordKey_idx" ON "MigrationRecord"("sourceId", "sourceRecordKey");

-- CreateIndex
CREATE INDEX "MigrationRecord_runId_status_idx" ON "MigrationRecord"("runId", "status");

-- CreateIndex
CREATE INDEX "MigrationRecord_sourceId_sourceEntityType_status_idx" ON "MigrationRecord"("sourceId", "sourceEntityType", "status");

-- CreateIndex
CREATE INDEX "MigrationRecord_sourceHash_idx" ON "MigrationRecord"("sourceHash");

-- CreateIndex
CREATE INDEX "MigrationRecord_canonicalSourceUrl_idx" ON "MigrationRecord"("canonicalSourceUrl");

-- CreateIndex
CREATE INDEX "MigrationRecord_targetTypeHint_status_idx" ON "MigrationRecord"("targetTypeHint", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationRecord_runId_sourceRecordKey_key" ON "MigrationRecord"("runId", "sourceRecordKey");

-- CreateIndex
CREATE INDEX "MigrationLineage_targetType_targetId_idx" ON "MigrationLineage"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "MigrationLineage_sourceId_sourceEntityType_idx" ON "MigrationLineage"("sourceId", "sourceEntityType");

-- CreateIndex
CREATE INDEX "MigrationLineage_sourceId_sourceExternalId_idx" ON "MigrationLineage"("sourceId", "sourceExternalId");

-- CreateIndex
CREATE INDEX "MigrationLineage_lastSourceHash_idx" ON "MigrationLineage"("lastSourceHash");

-- CreateIndex
CREATE INDEX "MigrationLineage_isActive_idx" ON "MigrationLineage"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationLineage_sourceId_sourceRecordKey_targetType_target_key" ON "MigrationLineage"("sourceId", "sourceRecordKey", "targetType", "targetRole");

-- CreateIndex
CREATE INDEX "MigrationMediaAsset_runId_status_idx" ON "MigrationMediaAsset"("runId", "status");

-- CreateIndex
CREATE INDEX "MigrationMediaAsset_recordId_idx" ON "MigrationMediaAsset"("recordId");

-- CreateIndex
CREATE INDEX "MigrationMediaAsset_sourceMediaExternalId_idx" ON "MigrationMediaAsset"("sourceMediaExternalId");

-- CreateIndex
CREATE INDEX "MigrationMediaAsset_contentHash_idx" ON "MigrationMediaAsset"("contentHash");

-- CreateIndex
CREATE INDEX "MigrationMediaAsset_targetMediaAssetId_idx" ON "MigrationMediaAsset"("targetMediaAssetId");

-- CreateIndex
CREATE INDEX "MigrationMediaAsset_primaryScope_status_idx" ON "MigrationMediaAsset"("primaryScope", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationMediaAsset_sourceId_sourceMediaKey_key" ON "MigrationMediaAsset"("sourceId", "sourceMediaKey");

-- CreateIndex
CREATE INDEX "MigrationRelation_runId_status_idx" ON "MigrationRelation"("runId", "status");

-- CreateIndex
CREATE INDEX "MigrationRelation_sourceRelationType_idx" ON "MigrationRelation"("sourceRelationType");

-- CreateIndex
CREATE INDEX "MigrationRelation_fromSourceRecordKey_idx" ON "MigrationRelation"("fromSourceRecordKey");

-- CreateIndex
CREATE INDEX "MigrationRelation_toSourceRecordKey_idx" ON "MigrationRelation"("toSourceRecordKey");

-- CreateIndex
CREATE INDEX "MigrationRelation_fromTargetType_fromTargetId_idx" ON "MigrationRelation"("fromTargetType", "fromTargetId");

-- CreateIndex
CREATE INDEX "MigrationRelation_toTargetType_toTargetId_idx" ON "MigrationRelation"("toTargetType", "toTargetId");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationRelation_sourceId_sourceRelationKey_key" ON "MigrationRelation"("sourceId", "sourceRelationKey");

-- CreateIndex
CREATE INDEX "MigrationRedirect_runId_status_idx" ON "MigrationRedirect"("runId", "status");

-- CreateIndex
CREATE INDEX "MigrationRedirect_recordId_idx" ON "MigrationRedirect"("recordId");

-- CreateIndex
CREATE INDEX "MigrationRedirect_sourceId_normalizedSourcePath_matchMode_idx" ON "MigrationRedirect"("sourceId", "normalizedSourcePath", "matchMode");

-- CreateIndex
CREATE INDEX "MigrationRedirect_targetType_targetId_idx" ON "MigrationRedirect"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "MigrationRedirect_conflictGroupKey_idx" ON "MigrationRedirect"("conflictGroupKey");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationRedirect_sourceId_sourceRedirectKey_key" ON "MigrationRedirect"("sourceId", "sourceRedirectKey");

-- CreateIndex
CREATE INDEX "MigrationReviewTask_status_priority_idx" ON "MigrationReviewTask"("status", "priority");

-- CreateIndex
CREATE INDEX "MigrationReviewTask_sourceId_status_idx" ON "MigrationReviewTask"("sourceId", "status");

-- CreateIndex
CREATE INDEX "MigrationReviewTask_runId_status_idx" ON "MigrationReviewTask"("runId", "status");

-- CreateIndex
CREATE INDEX "MigrationReviewTask_recordId_idx" ON "MigrationReviewTask"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationReviewTask_sourceId_scopeKey_reasonCode_key" ON "MigrationReviewTask"("sourceId", "scopeKey", "reasonCode");

-- CreateIndex
CREATE INDEX "MigrationQuarantineItem_runId_status_idx" ON "MigrationQuarantineItem"("runId", "status");

-- CreateIndex
CREATE INDEX "MigrationQuarantineItem_sourceId_status_idx" ON "MigrationQuarantineItem"("sourceId", "status");

-- CreateIndex
CREATE INDEX "MigrationQuarantineItem_severity_status_idx" ON "MigrationQuarantineItem"("severity", "status");

-- CreateIndex
CREATE INDEX "MigrationQuarantineItem_recordId_idx" ON "MigrationQuarantineItem"("recordId");

-- CreateIndex
CREATE INDEX "MigrationQuarantineItem_relatedType_relatedKey_idx" ON "MigrationQuarantineItem"("relatedType", "relatedKey");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationQuarantineItem_sourceId_quarantineKey_key" ON "MigrationQuarantineItem"("sourceId", "quarantineKey");

-- CreateIndex
CREATE INDEX "MigrationReportArtifact_sourceId_type_idx" ON "MigrationReportArtifact"("sourceId", "type");

-- CreateIndex
CREATE INDEX "MigrationReportArtifact_runId_idx" ON "MigrationReportArtifact"("runId");

-- CreateIndex
CREATE INDEX "MigrationReportArtifact_artifactHash_idx" ON "MigrationReportArtifact"("artifactHash");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationReportArtifact_runId_type_format_key" ON "MigrationReportArtifact"("runId", "type", "format");

-- AddForeignKey
ALTER TABLE "MigrationRun" ADD CONSTRAINT "MigrationRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MigrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRecord" ADD CONSTRAINT "MigrationRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MigrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRecord" ADD CONSTRAINT "MigrationRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationLineage" ADD CONSTRAINT "MigrationLineage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MigrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationLineage" ADD CONSTRAINT "MigrationLineage_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MigrationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationLineage" ADD CONSTRAINT "MigrationLineage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationMediaAsset" ADD CONSTRAINT "MigrationMediaAsset_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MigrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationMediaAsset" ADD CONSTRAINT "MigrationMediaAsset_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationMediaAsset" ADD CONSTRAINT "MigrationMediaAsset_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MigrationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRelation" ADD CONSTRAINT "MigrationRelation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MigrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRelation" ADD CONSTRAINT "MigrationRelation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRelation" ADD CONSTRAINT "MigrationRelation_fromRecordId_fkey" FOREIGN KEY ("fromRecordId") REFERENCES "MigrationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRelation" ADD CONSTRAINT "MigrationRelation_toRecordId_fkey" FOREIGN KEY ("toRecordId") REFERENCES "MigrationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRedirect" ADD CONSTRAINT "MigrationRedirect_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MigrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRedirect" ADD CONSTRAINT "MigrationRedirect_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRedirect" ADD CONSTRAINT "MigrationRedirect_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MigrationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationReviewTask" ADD CONSTRAINT "MigrationReviewTask_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MigrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationReviewTask" ADD CONSTRAINT "MigrationReviewTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationReviewTask" ADD CONSTRAINT "MigrationReviewTask_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MigrationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationQuarantineItem" ADD CONSTRAINT "MigrationQuarantineItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MigrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationQuarantineItem" ADD CONSTRAINT "MigrationQuarantineItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationQuarantineItem" ADD CONSTRAINT "MigrationQuarantineItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MigrationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationReportArtifact" ADD CONSTRAINT "MigrationReportArtifact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MigrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationReportArtifact" ADD CONSTRAINT "MigrationReportArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
