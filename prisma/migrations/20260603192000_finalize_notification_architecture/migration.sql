DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationActionMode') THEN
    CREATE TYPE "NotificationActionMode" AS ENUM ('NONE', 'MODAL', 'PAGE', 'EXTERNAL_URL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationEntityType') THEN
    CREATE TYPE "NotificationEntityType" AS ENUM (
      'ACTIVITY',
      'PLACE',
      'OFFER',
      'EVENT',
      'ROUTE',
      'PLAN_DAY',
      'PLAN_ITEM',
      'PLAN_DIGEST',
      'BOOKING',
      'LEAD',
      'BUSINESS',
      'BUSINESS_PROFILE',
      'ARTICLE',
      'USER',
      'SYSTEM',
      'BROADCAST',
      'MODERATION_ITEM'
    );
  END IF;
END $$;

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "actionMode" "NotificationActionMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "actionUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "modalTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "modalBody" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "Notification"
  ALTER COLUMN "entityType" TYPE "NotificationEntityType"
  USING (
    CASE
      WHEN "entityType" IS NULL THEN NULL
      WHEN "entityType" IN (
        'ACTIVITY',
        'PLACE',
        'OFFER',
        'EVENT',
        'ROUTE',
        'PLAN_DAY',
        'PLAN_ITEM',
        'PLAN_DIGEST',
        'BOOKING',
        'LEAD',
        'BUSINESS',
        'BUSINESS_PROFILE',
        'ARTICLE',
        'USER',
        'SYSTEM',
        'BROADCAST',
        'MODERATION_ITEM'
      ) THEN "entityType"::"NotificationEntityType"
      ELSE NULL
    END
  );

UPDATE "Notification"
SET
  "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP),
  "actionUrl" = COALESCE("actionUrl", "ctaAction"),
  "modalTitle" = COALESCE("modalTitle", "title"),
  "modalBody" = COALESCE("modalBody", "body"),
  "actionMode" = CASE
    WHEN COALESCE("actionUrl", "ctaAction") IS NULL OR BTRIM(COALESCE("actionUrl", "ctaAction")) = '' THEN
      CASE
        WHEN "type" IN ('NEWS', 'ANNOUNCEMENT', 'SYSTEM', 'WELCOME', 'SYSTEM_INFO', 'FEATURE_UPDATE', 'BUSINESS_NEWS', 'SECURITY_ALERT', 'PAYMENT_INFO')
          THEN 'MODAL'::"NotificationActionMode"
        ELSE 'NONE'::"NotificationActionMode"
      END
    WHEN COALESCE("actionUrl", "ctaAction") ~* '^https?://' THEN 'EXTERNAL_URL'::"NotificationActionMode"
    ELSE 'PAGE'::"NotificationActionMode"
  END
WHERE
  "actionUrl" IS NULL
  OR "modalTitle" IS NULL
  OR "modalBody" IS NULL
  OR "actionMode" = 'NONE';

CREATE INDEX IF NOT EXISTS "Notification_userId_archivedAt_createdAt_idx"
  ON "Notification"("userId", "archivedAt", "createdAt");
