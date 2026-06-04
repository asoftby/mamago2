-- CreateEnum
CREATE TYPE "BillingActionType" AS ENUM ('LEAD_CREATED', 'BOOKING_CONFIRMED', 'CONTACT_OPENED', 'VISIT_CONFIRMED');

-- CreateEnum
CREATE TYPE "BillingRateScopeType" AS ENUM ('GLOBAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BillingActionPricingType" AS ENUM ('FREE', 'FIXED', 'PERCENT', 'PERCENT_WITH_MINIMUM');

-- CreateTable
CREATE TABLE "BillingActionRate" (
    "id" TEXT NOT NULL,
    "actionType" "BillingActionType" NOT NULL,
    "scopeType" "BillingRateScopeType" NOT NULL,
    "scopeId" TEXT,
    "pricingType" "BillingActionPricingType" NOT NULL,
    "fixedAmount" DECIMAL(10,2),
    "percentRate" DECIMAL(5,2),
    "minimumAmount" DECIMAL(10,2),
    "maximumAmount" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'BYN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingActionRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingActionRate_actionType_idx" ON "BillingActionRate"("actionType");

-- CreateIndex
CREATE INDEX "BillingActionRate_scopeType_scopeId_idx" ON "BillingActionRate"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "BillingActionRate_isActive_idx" ON "BillingActionRate"("isActive");

-- CreateIndex
CREATE INDEX "BillingActionRate_startsAt_endsAt_idx" ON "BillingActionRate"("startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "BillingActionRate" ADD CONSTRAINT "BillingActionRate_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
