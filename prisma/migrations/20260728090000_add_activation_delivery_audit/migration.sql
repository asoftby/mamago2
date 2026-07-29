-- CreateEnum
CREATE TYPE "ActivationDeliveryStatus" AS ENUM ('BLOCKED_ENVIRONMENT', 'BLOCKED_KILL_SWITCH', 'QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ActivationDeliverySource" AS ENUM ('LOGIN_FLOW', 'MANUAL_REQUEST', 'PRODUCTION_BATCH');

-- CreateTable
CREATE TABLE "ActivationDeliveryAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceRecordKey" TEXT,
    "provider" TEXT NOT NULL,
    "recipientMask" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "status" "ActivationDeliveryStatus" NOT NULL,
    "errorCode" TEXT,
    "activationTokenId" TEXT,
    "source" "ActivationDeliverySource" NOT NULL,

    CONSTRAINT "ActivationDeliveryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivationDeliveryAudit_userId_idx" ON "ActivationDeliveryAudit"("userId");

-- CreateIndex
CREATE INDEX "ActivationDeliveryAudit_status_idx" ON "ActivationDeliveryAudit"("status");

-- CreateIndex
CREATE INDEX "ActivationDeliveryAudit_requestedAt_idx" ON "ActivationDeliveryAudit"("requestedAt");

-- AddForeignKey
ALTER TABLE "ActivationDeliveryAudit" ADD CONSTRAINT "ActivationDeliveryAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationDeliveryAudit" ADD CONSTRAINT "ActivationDeliveryAudit_activationTokenId_fkey" FOREIGN KEY ("activationTokenId") REFERENCES "UserActionToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
