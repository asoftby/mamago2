-- CreateEnum
CREATE TYPE "PromotionPublicationType" AS ENUM ('EVENT', 'OFFER');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PromotionActionType" AS ENUM ('SAVE_TO_PLAN', 'SEND_LEAD');

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "publicationType" "PromotionPublicationType" NOT NULL,
    "publicationId" TEXT NOT NULL,
    "publicationTitle" TEXT NOT NULL,
    "budget" DECIMAL(10,2) NOT NULL,
    "spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionAction" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "userEventId" TEXT NOT NULL,
    "actionType" "PromotionActionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Promotion_businessId_status_idx" ON "Promotion"("businessId", "status");

-- CreateIndex
CREATE INDEX "Promotion_publicationType_publicationId_status_idx" ON "Promotion"("publicationType", "publicationId", "status");

-- CreateIndex
CREATE INDEX "Promotion_createdAt_idx" ON "Promotion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionAction_userEventId_key" ON "PromotionAction"("userEventId");

-- CreateIndex
CREATE INDEX "PromotionAction_promotionId_actionType_createdAt_idx" ON "PromotionAction"("promotionId", "actionType", "createdAt");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionAction" ADD CONSTRAINT "PromotionAction_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionAction" ADD CONSTRAINT "PromotionAction_userEventId_fkey" FOREIGN KEY ("userEventId") REFERENCES "UserEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
