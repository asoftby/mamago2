-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('MASTER', 'ADDENDUM', 'OFFER', 'APPENDIX');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'EXPIRED', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PlacementSourceType" AS ENUM ('SUBSCRIPTION', 'MANUAL', 'PROMO_PACKAGE', 'BONUS');

-- CreateEnum
CREATE TYPE "ServiceEntityType" AS ENUM ('PLACE', 'EVENT', 'OFFER', 'STORY', 'PROMO');

-- CreateEnum
CREATE TYPE "CommercialNotificationType" AS ENUM ('CONTRACT_EXPIRING', 'CONTRACT_EXPIRED', 'PLACEMENT_EXPIRING', 'PLACEMENT_EXPIRED', 'SERVICE_EXPIRING', 'SERVICE_EXPIRED');

-- CreateEnum
CREATE TYPE "CommercialNotificationStatus" AS ENUM ('PENDING', 'SENT', 'READ', 'DISMISSED');

-- CreateTable
CREATE TABLE "BusinessContract" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewalTerms" TEXT,
    "renewalPeriod" INTEGER,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPlacement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sourceType" "PlacementSourceType" NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "planId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "graceUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessServicePlacement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entityType" "ServiceEntityType" NOT NULL,
    "entityId" TEXT,
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessServicePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialNotification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "CommercialNotificationType" NOT NULL,
    "status" "CommercialNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedContractId" TEXT,
    "relatedPlacementId" TEXT,
    "relatedServicePlacementId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessContract_contractNumber_key" ON "BusinessContract"("contractNumber");

-- CreateIndex
CREATE INDEX "BusinessContract_businessId_idx" ON "BusinessContract"("businessId");

-- CreateIndex
CREATE INDEX "BusinessContract_status_idx" ON "BusinessContract"("status");

-- CreateIndex
CREATE INDEX "BusinessContract_endsAt_idx" ON "BusinessContract"("endsAt");

-- CreateIndex
CREATE INDEX "BusinessContract_status_endsAt_idx" ON "BusinessContract"("status", "endsAt");

-- CreateIndex
CREATE INDEX "BusinessPlacement_businessId_idx" ON "BusinessPlacement"("businessId");

-- CreateIndex
CREATE INDEX "BusinessPlacement_status_idx" ON "BusinessPlacement"("status");

-- CreateIndex
CREATE INDEX "BusinessPlacement_endsAt_idx" ON "BusinessPlacement"("endsAt");

-- CreateIndex
CREATE INDEX "BusinessPlacement_businessId_status_idx" ON "BusinessPlacement"("businessId", "status");

-- CreateIndex
CREATE INDEX "BusinessServicePlacement_businessId_idx" ON "BusinessServicePlacement"("businessId");

-- CreateIndex
CREATE INDEX "BusinessServicePlacement_entityType_entityId_idx" ON "BusinessServicePlacement"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BusinessServicePlacement_endsAt_idx" ON "BusinessServicePlacement"("endsAt");

-- CreateIndex
CREATE INDEX "BusinessServicePlacement_status_idx" ON "BusinessServicePlacement"("status");

-- CreateIndex
CREATE INDEX "BusinessServicePlacement_businessId_status_idx" ON "BusinessServicePlacement"("businessId", "status");

-- CreateIndex
CREATE INDEX "CommercialNotification_businessId_idx" ON "CommercialNotification"("businessId");

-- CreateIndex
CREATE INDEX "CommercialNotification_type_idx" ON "CommercialNotification"("type");

-- CreateIndex
CREATE INDEX "CommercialNotification_scheduledFor_idx" ON "CommercialNotification"("scheduledFor");

-- CreateIndex
CREATE INDEX "CommercialNotification_status_idx" ON "CommercialNotification"("status");

-- CreateIndex
CREATE INDEX "CommercialNotification_businessId_status_idx" ON "CommercialNotification"("businessId", "status");

-- AddForeignKey
ALTER TABLE "BusinessContract" ADD CONSTRAINT "BusinessContract_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlacement" ADD CONSTRAINT "BusinessPlacement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlacement" ADD CONSTRAINT "BusinessPlacement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessServicePlacement" ADD CONSTRAINT "BusinessServicePlacement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialNotification" ADD CONSTRAINT "CommercialNotification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialNotification" ADD CONSTRAINT "CommercialNotification_relatedContractId_fkey" FOREIGN KEY ("relatedContractId") REFERENCES "BusinessContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialNotification" ADD CONSTRAINT "CommercialNotification_relatedPlacementId_fkey" FOREIGN KEY ("relatedPlacementId") REFERENCES "BusinessPlacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialNotification" ADD CONSTRAINT "CommercialNotification_relatedServicePlacementId_fkey" FOREIGN KEY ("relatedServicePlacementId") REFERENCES "BusinessServicePlacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
