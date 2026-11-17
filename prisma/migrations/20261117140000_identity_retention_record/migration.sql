-- CreateTable
CREATE TABLE "IdentityRetentionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "envelope" TEXT NOT NULL,
    "accountCreatedAt" TIMESTAMP(3) NOT NULL,
    "agreementEndedAt" TIMESTAMP(3) NOT NULL,
    "purgeAfter" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityRetentionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentityRetentionRecord_userId_key" ON "IdentityRetentionRecord"("userId");

-- CreateIndex
CREATE INDEX "IdentityRetentionRecord_purgeAfter_idx" ON "IdentityRetentionRecord"("purgeAfter");
