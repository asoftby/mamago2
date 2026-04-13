-- Create enums
CREATE TYPE "TelegramEnvironment" AS ENUM ('DEV', 'PROD');
CREATE TYPE "NotificationAudience" AS ENUM ('USER', 'BUSINESS', 'ADMIN');
CREATE TYPE "DevTelegramBusinessApplicationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- Alter NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUSINESS_APPLICATION_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_MODERATION_ITEM_CREATED';

-- Alter Notification table
ALTER TABLE "Notification"
ADD COLUMN "audience" "NotificationAudience";

-- Alter TelegramLinkToken table
ALTER TABLE "TelegramLinkToken"
ADD COLUMN "environment" "TelegramEnvironment" NOT NULL DEFAULT 'DEV';

-- Alter UserNotificationPreference table
ALTER TABLE "UserNotificationPreference"
ADD COLUMN "audience" "NotificationAudience";

-- Create TelegramConnection table
CREATE TABLE "TelegramConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "environment" "TelegramEnvironment" NOT NULL,
  "botUsername" TEXT NOT NULL,
  "telegramUserId" TEXT NOT NULL,
  "telegramChatId" TEXT NOT NULL,
  "telegramUsername" TEXT,
  "telegramFirstName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastInteractionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TelegramConnection_pkey" PRIMARY KEY ("id")
);

-- Create DevTelegramBusinessApplication table
CREATE TABLE "DevTelegramBusinessApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "applicationNumber" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "DevTelegramBusinessApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "confirmedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DevTelegramBusinessApplication_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Notification_userId_audience_createdAt_idx" ON "Notification"("userId", "audience", "createdAt");
CREATE INDEX "TelegramLinkToken_userId_environment_expiresAt_idx" ON "TelegramLinkToken"("userId", "environment", "expiresAt");
CREATE UNIQUE INDEX "TelegramConnection_userId_environment_key" ON "TelegramConnection"("userId", "environment");
CREATE UNIQUE INDEX "TelegramConnection_environment_telegramChatId_key" ON "TelegramConnection"("environment", "telegramChatId");
CREATE INDEX "TelegramConnection_userId_isActive_idx" ON "TelegramConnection"("userId", "isActive");
CREATE INDEX "TelegramConnection_environment_telegramUserId_idx" ON "TelegramConnection"("environment", "telegramUserId");
CREATE INDEX "TelegramConnection_environment_isActive_idx" ON "TelegramConnection"("environment", "isActive");
CREATE INDEX "UserNotificationPreference_userId_audience_idx" ON "UserNotificationPreference"("userId", "audience");
CREATE INDEX "DevTelegramBusinessApplication_userId_createdAt_idx" ON "DevTelegramBusinessApplication"("userId", "createdAt");
CREATE INDEX "DevTelegramBusinessApplication_status_createdAt_idx" ON "DevTelegramBusinessApplication"("status", "createdAt");

-- Foreign keys
ALTER TABLE "TelegramConnection"
ADD CONSTRAINT "TelegramConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DevTelegramBusinessApplication"
ADD CONSTRAINT "DevTelegramBusinessApplication_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
