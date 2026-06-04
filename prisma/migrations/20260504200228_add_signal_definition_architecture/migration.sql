/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `ImportFieldOverride` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SignalDomain" AS ENUM ('PROFILE', 'DISCOVERY', 'RECOMMENDATION');

-- CreateEnum
CREATE TYPE "SignalEntityType" AS ENUM ('PLACE', 'EVENT', 'OFFER', 'ROUTE', 'ARTICLE', 'USER');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('ACTIVE', 'DEPRECATED');

-- AlterTable
ALTER TABLE "DevTelegramBusinessApplication" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ImportFieldOverride" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Organizer" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SignalDefinition" ADD COLUMN     "domain" "SignalDomain",
ADD COLUMN     "entityTypes" "SignalEntityType"[],
ADD COLUMN     "replacedById" TEXT,
ADD COLUMN     "status" "SignalStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "TelegramConnection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TelegramLinkToken" ALTER COLUMN "environment" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "SignalDefinition_domain_idx" ON "SignalDefinition"("domain");

-- CreateIndex
CREATE INDEX "SignalDefinition_status_idx" ON "SignalDefinition"("status");

-- AddForeignKey
ALTER TABLE "SignalDefinition" ADD CONSTRAINT "SignalDefinition_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "SignalDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
