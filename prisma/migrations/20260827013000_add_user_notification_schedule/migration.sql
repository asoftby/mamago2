-- Personalized notification schedule. One row per user; channel preferences
-- remain in UserNotificationPreference.
CREATE TABLE "UserNotificationSchedule" (
  "userId" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
  "timeZoneMode" TEXT NOT NULL DEFAULT 'AUTO',
  "planEveningEnabled" BOOLEAN NOT NULL DEFAULT true,
  "planEveningTime" TEXT NOT NULL DEFAULT '19:00',
  "planEveningNextRunAt" TIMESTAMP(3) NOT NULL,
  "planReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "planReminderOffsetMinutes" INTEGER NOT NULL DEFAULT 120,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserNotificationSchedule_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "UserNotificationSchedule_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserNotificationSchedule_timeZoneMode_check"
    CHECK ("timeZoneMode" IN ('AUTO', 'MANUAL')),
  CONSTRAINT "UserNotificationSchedule_planEveningTime_check"
    CHECK ("planEveningTime" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "UserNotificationSchedule_planReminderOffsetMinutes_check"
    CHECK ("planReminderOffsetMinutes" IN (5, 30, 60, 120, 180))
);

CREATE INDEX "UserNotificationSchedule_planEveningEnabled_planEveningNextRunAt_idx"
  ON "UserNotificationSchedule"("planEveningEnabled", "planEveningNextRunAt");

CREATE INDEX "PlanItem_startsAt_idx" ON "PlanItem"("startsAt");

WITH local_clock AS (
  SELECT
    "id",
    date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Minsk')
      + interval '19 hours' AS local_19
  FROM "User"
)
INSERT INTO "UserNotificationSchedule" (
  "userId",
  "timeZone",
  "timeZoneMode",
  "planEveningEnabled",
  "planEveningTime",
  "planEveningNextRunAt",
  "planReminderEnabled",
  "planReminderOffsetMinutes",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  'Europe/Minsk',
  'AUTO',
  true,
  '19:00',
  (
    CASE
      WHEN local_19 > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Minsk')
        THEN local_19 AT TIME ZONE 'Europe/Minsk'
      ELSE (local_19 + interval '1 day') AT TIME ZONE 'Europe/Minsk'
    END
  ) AT TIME ZONE 'UTC',
  true,
  120,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM local_clock;

-- Fold the old hidden tomorrow-digest channel override into the single
-- user-facing Plan preference only when the user has no Plan override yet.
INSERT INTO "UserNotificationPreference" (
  "id",
  "userId",
  "audience",
  "notificationType",
  "inAppEnabled",
  "emailEnabled",
  "telegramEnabled",
  "createdAt",
  "updatedAt"
)
SELECT
  old."id" || '_plan',
  old."userId",
  old."audience",
  'REMINDER'::"NotificationType",
  old."inAppEnabled",
  old."emailEnabled",
  old."telegramEnabled",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "UserNotificationPreference" old
WHERE old."notificationType" = 'PLAN_TOMORROW_DIGEST'::"NotificationType"
  AND NOT EXISTS (
    SELECT 1
    FROM "UserNotificationPreference" current_pref
    WHERE current_pref."userId" = old."userId"
      AND current_pref."notificationType" = 'REMINDER'::"NotificationType"
  )
ON CONFLICT ("userId", "notificationType") DO NOTHING;
