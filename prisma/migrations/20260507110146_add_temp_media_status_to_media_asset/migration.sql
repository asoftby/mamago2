-- AlterEnum
ALTER TYPE "MediaAssetStatus" ADD VALUE 'TEMP';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "draftEntityId" TEXT,
ADD COLUMN     "draftEntityType" TEXT,
ADD COLUMN     "wizardSessionId" TEXT;

-- CreateIndex
CREATE INDEX "MediaAsset_wizardSessionId_status_idx" ON "MediaAsset"("wizardSessionId", "status");

-- CreateIndex
CREATE INDEX "MediaAsset_draftEntityId_draftEntityType_status_idx" ON "MediaAsset"("draftEntityId", "draftEntityType", "status");

-- CreateIndex
CREATE INDEX "MediaAsset_status_createdAt_idx" ON "MediaAsset"("status", "createdAt");
