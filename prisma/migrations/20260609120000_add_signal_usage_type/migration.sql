-- CreateEnum
CREATE TYPE "SignalUsageType" AS ENUM ('PLAN_ADULT_PREFERENCE', 'PLAN_LEISURE_FORMAT');

-- AlterTable
ALTER TABLE "SignalDefinition" ADD COLUMN "usageType" "SignalUsageType";

-- CreateIndex
CREATE INDEX "SignalDefinition_usageType_idx" ON "SignalDefinition"("usageType");
