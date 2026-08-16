-- Operations Center v1 — Step 1 persistence layer.
-- Spec: "mamaGo Operations Center v1 — Specification", rev 1.2.1, §21 Step 1.
--
-- Hand-reviewed subset of `prisma migrate diff` output: the raw diff also
-- contained unrelated pre-existing drift (Article FK churn, the
-- `*_cityId_slug_key` partial unique indexes getting recreated as
-- non-partial, HomeStoryItem index-name truncation renames — all documented
-- in CLAUDE.md as known `prisma migrate diff` limitations around the
-- hand-written partial-index migration `20260608114243_city_scoped_slugs`).
-- None of that belongs to this migration; only the new
-- enums/tables/indexes/FK below were kept.

-- CreateEnum
CREATE TYPE "OperationalSignalStatus" AS ENUM ('PENDING', 'OPEN', 'ABORTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SignalSeverity" AS ENUM ('CRITICAL', 'WARNING');

-- CreateEnum
CREATE TYPE "SignalResolution" AS ENUM ('AUTO', 'MANUAL', 'ABORTED');

-- CreateEnum
CREATE TYPE "DetectorRunStatus" AS ENUM ('RUNNING', 'OK', 'FAILED', 'TIMEOUT', 'SKIPPED_LOCKED');

-- CreateEnum
CREATE TYPE "ReleaseEventKind" AS ENUM ('BUILD_CHANGED', 'PROCESS_RESTART');

-- CreateTable
CREATE TABLE "MetricSample" (
    "id" BIGSERIAL NOT NULL,
    "metric" VARCHAR(64) NOT NULL,
    "dimKey" VARCHAR(128) NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalSignal" (
    "id" TEXT NOT NULL,
    "fingerprint" VARCHAR(255) NOT NULL,
    "detector" VARCHAR(64) NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "status" "OperationalSignalStatus" NOT NULL DEFAULT 'PENDING',
    "severity" "SignalSeverity" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "detailsUrl" VARCHAR(512),
    "entityType" VARCHAR(64),
    "entityId" VARCHAR(64),
    "payload" JSONB,
    "consecutiveHits" INTEGER NOT NULL DEFAULT 0,
    "consecutiveMisses" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "attentionChangedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" "SignalResolution",
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectorRun" (
    "id" TEXT NOT NULL,
    "detector" VARCHAR(64) NOT NULL,
    "status" "DetectorRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "error" TEXT,
    "workerId" VARCHAR(64),
    "signalsOpened" INTEGER NOT NULL DEFAULT 0,
    "signalsResolved" INTEGER NOT NULL DEFAULT 0,
    "samplesWritten" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DetectorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationsSnapshot" (
    "id" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "OperationsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationsViewState" (
    "userId" TEXT NOT NULL,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationsViewState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ReleaseEvent" (
    "id" TEXT NOT NULL,
    "kind" "ReleaseEventKind" NOT NULL,
    "buildId" VARCHAR(64) NOT NULL,
    "gitSha" VARCHAR(64),
    "processStartedAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricSample_metric_dimKey_collectedAt_idx" ON "MetricSample"("metric", "dimKey", "collectedAt" DESC);

-- CreateIndex
CREATE INDEX "MetricSample_collectedAt_idx" ON "MetricSample"("collectedAt");

-- CreateIndex
CREATE INDEX "OperationalSignal_status_severity_openedAt_idx" ON "OperationalSignal"("status", "severity", "openedAt");

-- CreateIndex
CREATE INDEX "OperationalSignal_status_attentionChangedAt_idx" ON "OperationalSignal"("status", "attentionChangedAt" DESC);

-- CreateIndex
CREATE INDEX "OperationalSignal_detector_status_idx" ON "OperationalSignal"("detector", "status");

-- CreateIndex
CREATE INDEX "OperationalSignal_fingerprint_createdAt_idx" ON "OperationalSignal"("fingerprint", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DetectorRun_detector_status_finishedAt_idx" ON "DetectorRun"("detector", "status", "finishedAt" DESC);

-- CreateIndex
CREATE INDEX "DetectorRun_startedAt_idx" ON "DetectorRun"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "ReleaseEvent_detectedAt_idx" ON "ReleaseEvent"("detectedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseEvent_buildId_processStartedAt_key" ON "ReleaseEvent"("buildId", "processStartedAt");

-- AddForeignKey
ALTER TABLE "OperationsViewState" ADD CONSTRAINT "OperationsViewState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Manual PostgreSQL-level guarantees (Phase C).
-- Prisma cannot express these; they are the actual point of Step 1.
-- ─────────────────────────────────────────────────────────────

-- 1. Only one LIVE (unresolved) OperationalSignal per fingerprint.
-- PENDING/OPEN participate (resolvedAt IS NULL); ABORTED/RESOLVED never do
-- (resolvedAt is required for them, enforced by guarantee #2 below), so
-- resolved historical incidents with the same fingerprint keep coexisting.
CREATE UNIQUE INDEX "OperationalSignal_live_fingerprint_key"
  ON "OperationalSignal" ("fingerprint")
  WHERE "resolvedAt" IS NULL;

-- 2. status <-> resolvedAt consistency.
ALTER TABLE "OperationalSignal"
  ADD CONSTRAINT operational_signal_status_resolved_at_consistency
  CHECK (
    ("status" IN ('PENDING', 'OPEN') AND "resolvedAt" IS NULL)
    OR
    ("status" IN ('ABORTED', 'RESOLVED') AND "resolvedAt" IS NOT NULL)
  );

-- 3. OPEN must always carry openedAt + attentionChangedAt.
ALTER TABLE "OperationalSignal"
  ADD CONSTRAINT operational_signal_open_requires_timestamps
  CHECK (
    "status" <> 'OPEN'
    OR ("openedAt" IS NOT NULL AND "attentionChangedAt" IS NOT NULL)
  );

-- 4. OperationsSnapshot is a true singleton: the only legal id is 'current'.
ALTER TABLE "OperationsSnapshot"
  ADD CONSTRAINT operations_snapshot_singleton_id
  CHECK ("id" = 'current');

-- 5. ReleaseEvent runtime uniqueness (buildId, processStartedAt) is already
-- enforced by the Prisma-generated unique index above
-- ("ReleaseEvent_buildId_processStartedAt_key"); no additional SQL needed.
