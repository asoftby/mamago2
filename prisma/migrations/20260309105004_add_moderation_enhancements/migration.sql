-- CreateEnum
CREATE TYPE "ContentEditType" AS ENUM ('TYPO', 'PUNCTUATION', 'FORMATTING', 'CAPITALIZATION', 'PHONE_NORMALIZATION', 'LINK_NORMALIZATION', 'WHITESPACE_CLEANUP', 'OTHER');

-- CreateEnum
CREATE TYPE "ImprovementRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImprovementSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "hasActiveImprovementRequests" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlaceRevision" ADD COLUMN     "improvementRequestId" TEXT;

-- CreateTable
CREATE TABLE "ContentEditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "editType" "ContentEditType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentEditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementRequest" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdByModeratorId" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "status" "ImprovementRequestStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "ImprovementSeverity" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestedChanges" JSONB,
    "dueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentEditLog_entityType_entityId_createdAt_idx" ON "ContentEditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentEditLog_moderatorId_createdAt_idx" ON "ContentEditLog"("moderatorId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentEditLog_editType_idx" ON "ContentEditLog"("editType");

-- CreateIndex
CREATE INDEX "ImprovementRequest_entityType_entityId_status_idx" ON "ImprovementRequest"("entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX "ImprovementRequest_assignedToUserId_status_createdAt_idx" ON "ImprovementRequest"("assignedToUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ImprovementRequest_createdByModeratorId_createdAt_idx" ON "ImprovementRequest"("createdByModeratorId", "createdAt");

-- CreateIndex
CREATE INDEX "ImprovementRequest_status_severity_idx" ON "ImprovementRequest"("status", "severity");

-- CreateIndex
CREATE INDEX "ImprovementRequest_dueAt_idx" ON "ImprovementRequest"("dueAt");

-- AddForeignKey
ALTER TABLE "ContentEditLog" ADD CONSTRAINT "ContentEditLog_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementRequest" ADD CONSTRAINT "ImprovementRequest_createdByModeratorId_fkey" FOREIGN KEY ("createdByModeratorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementRequest" ADD CONSTRAINT "ImprovementRequest_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
