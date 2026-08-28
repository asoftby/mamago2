-- Existing users who explicitly linked Telegram before the plan-notification
-- opt-in bootstrap was introduced should receive the same defaults as newly
-- linked users. Explicit per-type preferences always win: ON CONFLICT leaves
-- every existing row (including telegramEnabled = false) untouched.

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
  md5('telegram-plan-pref:' || connections."userId" || ':' || types.notification_type::text),
  connections."userId",
  'USER'::"NotificationAudience",
  types.notification_type,
  NULL,
  NULL,
  TRUE,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "userId"
  FROM "TelegramConnection"
  WHERE "isActive" = TRUE
) AS connections
CROSS JOIN (
  VALUES
    ('REMINDER'::"NotificationType"),
    ('PLAN_TOMORROW_DIGEST'::"NotificationType")
) AS types(notification_type)
ON CONFLICT ("userId", "notificationType") DO NOTHING;
