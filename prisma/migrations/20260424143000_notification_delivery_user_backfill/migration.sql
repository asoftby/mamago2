ALTER TABLE "NotificationDelivery"
ADD COLUMN "userId" TEXT;

UPDATE "NotificationDelivery" AS delivery
SET "userId" = notification."userId"
FROM "Notification" AS notification
WHERE delivery."notificationId" = notification."id"
  AND delivery."userId" IS NULL;

ALTER TABLE "NotificationDelivery"
ALTER COLUMN "notificationId" DROP NOT NULL;

ALTER TABLE "NotificationDelivery"
ALTER COLUMN "userId" SET NOT NULL;

CREATE INDEX "NotificationDelivery_userId_scenario_channel_idx"
ON "NotificationDelivery"("userId", "scenario", "channel");

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
