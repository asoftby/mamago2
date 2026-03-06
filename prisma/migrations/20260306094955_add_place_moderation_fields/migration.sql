-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "moderatedByUserId" TEXT,
ADD COLUMN     "moderationReviewedAt" TIMESTAMP(3),
ADD COLUMN     "moderatorComment" TEXT,
ADD COLUMN     "revisionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "revisionResubmittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Place_moderatedByUserId_idx" ON "Place"("moderatedByUserId");

-- CreateIndex
CREATE INDEX "Place_status_revisionRequestedAt_idx" ON "Place"("status", "revisionRequestedAt");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_moderatedByUserId_fkey" FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
