-- После commit enum WELCOME можно использовать в UPDATE (отдельная миграция)
UPDATE "Notification"
SET
  "type" = 'WELCOME',
  "ctaLabel" = 'Подключить Telegram',
  "ctaAction" = 'connect_telegram',
  "isPinned" = true
WHERE "entityType" = 'WELCOME';

UPDATE "Notification" SET "entityType" = NULL, "entityId" = NULL WHERE "type" = 'WELCOME';
