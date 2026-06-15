-- Бэкфилл: isRead=true без readAt → считаем прочитанным на момент последнего обновления
UPDATE "Notification"
SET "readAt" = COALESCE("readAt", "updatedAt", now())
WHERE "isRead" = true AND "readAt" IS NULL;

-- DropIndex
DROP INDEX IF EXISTS "Notification_userId_isRead_createdAt_idx";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "isRead";

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
