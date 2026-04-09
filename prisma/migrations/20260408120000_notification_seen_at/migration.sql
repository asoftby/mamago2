-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "seenAt" TIMESTAMP(3);

-- Backfill: просмотренные ранее (isRead) → seenAt из readAt или createdAt
UPDATE "Notification"
SET "seenAt" = COALESCE("readAt", "createdAt")
WHERE "isRead" = true;

-- CreateIndex
CREATE INDEX "Notification_userId_seenAt_idx" ON "Notification"("userId", "seenAt");
