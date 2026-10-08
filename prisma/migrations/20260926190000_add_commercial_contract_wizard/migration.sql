-- CreateEnum
CREATE TYPE "ContractTemplateSource" AS ENUM ('MAMAGO', 'CLIENT');

-- CreateTable
CREATE TABLE "CommercialCounterparty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unp" TEXT,
    "contactName" TEXT,
    "phoneE164" TEXT,
    "businessId" TEXT,
    "egrVerifiedAt" TIMESTAMP(3),
    "egrSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialCounterparty_pkey" PRIMARY KEY ("id")
);

-- Existing business-linked contracts remain valid; new commercial contracts
-- may be created for a standalone counterparty without a mamaGo Business.
ALTER TABLE "BusinessContract"
  ALTER COLUMN "businessId" DROP NOT NULL,
  ALTER COLUMN "startsAt" DROP NOT NULL,
  ALTER COLUMN "endsAt" DROP NOT NULL,
  ADD COLUMN "counterpartyId" TEXT,
  ADD COLUMN "templateSource" "ContractTemplateSource" NOT NULL DEFAULT 'MAMAGO',
  ADD COLUMN "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BYN',
  ADD COLUMN "prepaymentPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "prepaymentDueAt" TIMESTAMP(3),
  ADD COLUMN "postpaymentDueAt" TIMESTAMP(3),
  ADD COLUMN "paymentComment" TEXT,
  ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'MAMAGO_BY';

-- CreateTable
CREATE TABLE "BusinessContractItem" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialCounterparty_unp_key" ON "CommercialCounterparty"("unp");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialCounterparty_businessId_key" ON "CommercialCounterparty"("businessId");

-- CreateIndex
CREATE INDEX "CommercialCounterparty_name_idx" ON "CommercialCounterparty"("name");

-- CreateIndex
CREATE INDEX "BusinessContract_counterpartyId_idx" ON "BusinessContract"("counterpartyId");

-- CreateIndex
CREATE INDEX "BusinessContractItem_contractId_idx" ON "BusinessContractItem"("contractId");

-- AddForeignKey
ALTER TABLE "CommercialCounterparty" ADD CONSTRAINT "CommercialCounterparty_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContract" ADD CONSTRAINT "BusinessContract_counterpartyId_fkey"
  FOREIGN KEY ("counterpartyId") REFERENCES "CommercialCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContractItem" ADD CONSTRAINT "BusinessContractItem_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "BusinessContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
