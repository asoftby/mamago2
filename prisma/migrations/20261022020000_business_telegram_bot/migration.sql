CREATE TABLE "BusinessTelegramConnection" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "environment" "TelegramEnvironment" NOT NULL,
  "botUsername" TEXT NOT NULL,
  "telegramUserId" TEXT NOT NULL,
  "telegramChatId" TEXT NOT NULL,
  "telegramUsername" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessTelegramConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BusinessTelegramConnection_userId_environment_key" ON "BusinessTelegramConnection"("userId","environment");
CREATE UNIQUE INDEX "BusinessTelegramConnection_environment_telegramChatId_key" ON "BusinessTelegramConnection"("environment","telegramChatId");
CREATE INDEX "BusinessTelegramConnection_businessId_environment_isActive_idx" ON "BusinessTelegramConnection"("businessId","environment","isActive");
CREATE TABLE "BusinessTelegramLinkToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "environment" "TelegramEnvironment" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessTelegramLinkToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BusinessTelegramLinkToken_tokenHash_key" ON "BusinessTelegramLinkToken"("tokenHash");
CREATE INDEX "BusinessTelegramLinkToken_userId_environment_expiresAt_idx" ON "BusinessTelegramLinkToken"("userId","environment","expiresAt");
