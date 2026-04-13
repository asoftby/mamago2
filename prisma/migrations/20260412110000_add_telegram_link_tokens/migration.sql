ALTER TABLE "User"
ADD COLUMN "telegramId" TEXT,
ADD COLUMN "telegramUsername" TEXT;

CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramLinkToken_token_key" ON "TelegramLinkToken"("token");
CREATE INDEX "TelegramLinkToken_userId_expiresAt_idx" ON "TelegramLinkToken"("userId", "expiresAt");
CREATE INDEX "TelegramLinkToken_expiresAt_idx" ON "TelegramLinkToken"("expiresAt");

ALTER TABLE "TelegramLinkToken"
ADD CONSTRAINT "TelegramLinkToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
