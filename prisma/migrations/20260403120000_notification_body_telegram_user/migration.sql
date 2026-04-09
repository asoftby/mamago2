-- User: Telegram onboarding state (источник истины для prompt, не Notification)
ALTER TABLE "User" ADD COLUMN "telegramConnected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "telegramPromptDismissedAt" TIMESTAMP(3);

-- Notification kinds for in-app feed (новые значения — отдельная миграция для backfill данных)
ALTER TYPE "NotificationType" ADD VALUE 'WELCOME';
ALTER TYPE "NotificationType" ADD VALUE 'REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'RECOMMENDATION';

-- Notification: body + optional CTA + pin
ALTER TABLE "Notification" RENAME COLUMN "message" TO "body";
ALTER TABLE "Notification" ADD COLUMN "ctaLabel" TEXT;
ALTER TABLE "Notification" ADD COLUMN "ctaAction" TEXT;
ALTER TABLE "Notification" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Notification_userId_isPinned_createdAt_idx" ON "Notification"("userId", "isPinned", "createdAt");
