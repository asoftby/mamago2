-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'NotificationPolicySurface'
  ) THEN
    CREATE TYPE "NotificationPolicySurface" AS ENUM ('USER', 'BUSINESS', 'ADMIN', 'SYSTEM');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationPolicy" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "surface" "NotificationPolicySurface" NOT NULL,
  "notificationType" "NotificationType",
  "scenario" "NotificationScenario",
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "allowedInApp" BOOLEAN NOT NULL DEFAULT true,
  "allowedEmail" BOOLEAN NOT NULL DEFAULT true,
  "allowedTelegram" BOOLEAN NOT NULL DEFAULT true,
  "defaultInApp" BOOLEAN NOT NULL DEFAULT true,
  "defaultEmail" BOOLEAN NOT NULL DEFAULT false,
  "defaultTelegram" BOOLEAN NOT NULL DEFAULT false,
  "minCooldownMinutes" INTEGER,
  "maxPerDay" INTEGER,
  "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "digestTime" TEXT,
  "defaultReminderOffsetMinutes" INTEGER,
  "availableReminderOffsets" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "isSystemLocked" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPolicy_key_key"
ON "NotificationPolicy"("key");

CREATE INDEX IF NOT EXISTS "NotificationPolicy_surface_idx"
ON "NotificationPolicy"("surface");

CREATE INDEX IF NOT EXISTS "NotificationPolicy_notificationType_idx"
ON "NotificationPolicy"("notificationType");

CREATE INDEX IF NOT EXISTS "NotificationPolicy_scenario_idx"
ON "NotificationPolicy"("scenario");
