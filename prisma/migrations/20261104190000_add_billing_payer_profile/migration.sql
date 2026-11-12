-- Additive billing payer identity. Does not alter operational balances or existing businesses.
CREATE TABLE "BillingPayerProfile" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "payerType" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "unp" TEXT,
  "legalAddress" TEXT,
  "bankName" TEXT,
  "bankCode" TEXT,
  "bankAccount" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "signatoryName" TEXT,
  "signatoryPosition" TEXT,
  "signatoryBasis" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingPayerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingPayerProfile_businessId_key" ON "BillingPayerProfile"("businessId");
CREATE INDEX "BillingPayerProfile_payerType_idx" ON "BillingPayerProfile"("payerType");
ALTER TABLE "BillingPayerProfile" ADD CONSTRAINT "BillingPayerProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
