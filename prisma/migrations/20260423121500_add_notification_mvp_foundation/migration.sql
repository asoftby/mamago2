-- CreateEnum
CREATE TYPE "NotificationScenario" AS ENUM ('PLAN_EVENT_2H_BEFORE');

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "scenario" "NotificationScenario";

-- AlterTable
ALTER TABLE "NotificationDelivery"
ADD COLUMN "scenario" "NotificationScenario",
ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "payloadJson" JSONB;

-- CreateIndex
CREATE INDEX "Notification_userId_scenario_createdAt_idx"
ON "Notification"("userId", "scenario", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_dedupeKey_idx"
ON "NotificationDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_scenario_channel_status_idx"
ON "NotificationDelivery"("scenario", "channel", "status");
