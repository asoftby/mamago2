-- AlterTable: NotificationDelivery
-- Add attemptCount column for tracking delivery retry attempts.

ALTER TABLE "NotificationDelivery"
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
