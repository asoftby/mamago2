-- CreateEnum
CREATE TYPE "BusinessOperationalStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN "operationalStatus" "BusinessOperationalStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Business_operationalStatus_idx" ON "Business"("operationalStatus");
