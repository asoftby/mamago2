-- Migration: add_notification_template
--
-- Канальные шаблоны уведомлений per-сценарий.
-- Запись в таблице — это override; дефолтные шаблоны живут в коде
-- (NOTIFICATION_SCENARIO_REGISTRY в src/lib/notifications/notificationRegistry.ts).

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "scenarioKey" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationTemplate_scenarioKey_idx" ON "NotificationTemplate"("scenarioKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_scenarioKey_channel_key" ON "NotificationTemplate"("scenarioKey", "channel");

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
