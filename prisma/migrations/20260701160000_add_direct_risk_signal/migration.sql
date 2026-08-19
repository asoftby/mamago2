-- CreateEnum
CREATE TYPE "DirectRiskSignalType" AS ENUM ('CONTACT_PHONE', 'CONTACT_EMAIL', 'CONTACT_LINK', 'CONTACT_TELEGRAM', 'CONTACT_WHATSAPP', 'CONTACT_INSTAGRAM', 'FLOOD_LOCK_TRIGGERED', 'NO_REPLY_CAP_TRIGGERED', 'REPEATED_LIMIT_TRIGGERED', 'COMPLAINT_OPENED', 'MESSAGE_HIDDEN', 'THREAD_BLOCKED');

-- CreateEnum
CREATE TYPE "DirectRiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "DirectRiskSignal" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "messageId" TEXT,
    "businessId" TEXT,
    "customerUserId" TEXT,
    "signalType" "DirectRiskSignalType" NOT NULL,
    "severity" "DirectRiskSeverity" NOT NULL,
    "score" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectRiskSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectRiskSignal_threadId_idx" ON "DirectRiskSignal"("threadId");

-- CreateIndex
CREATE INDEX "DirectRiskSignal_messageId_idx" ON "DirectRiskSignal"("messageId");

-- CreateIndex
CREATE INDEX "DirectRiskSignal_businessId_idx" ON "DirectRiskSignal"("businessId");

-- CreateIndex
CREATE INDEX "DirectRiskSignal_customerUserId_idx" ON "DirectRiskSignal"("customerUserId");

-- CreateIndex
CREATE INDEX "DirectRiskSignal_signalType_idx" ON "DirectRiskSignal"("signalType");

-- CreateIndex
CREATE INDEX "DirectRiskSignal_severity_idx" ON "DirectRiskSignal"("severity");

-- CreateIndex
CREATE INDEX "DirectRiskSignal_createdAt_idx" ON "DirectRiskSignal"("createdAt");

-- AddForeignKey
ALTER TABLE "DirectRiskSignal" ADD CONSTRAINT "DirectRiskSignal_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DirectThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectRiskSignal" ADD CONSTRAINT "DirectRiskSignal_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectRiskSignal" ADD CONSTRAINT "DirectRiskSignal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectRiskSignal" ADD CONSTRAINT "DirectRiskSignal_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
