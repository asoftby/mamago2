-- Additive financial linkage for explicit first-PROD Boost purchases.
-- Existing ranking-only Boost rows remain valid with NULL purchase metadata.
ALTER TABLE "Boost"
  ADD COLUMN "durationDays" INTEGER,
  ADD COLUMN "price" DECIMAL(10,2),
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "purchaseRequestKey" TEXT,
  ADD COLUMN "billingTransactionId" TEXT;

CREATE UNIQUE INDEX "Boost_purchaseRequestKey_key" ON "Boost"("purchaseRequestKey");
CREATE UNIQUE INDEX "Boost_billingTransactionId_key" ON "Boost"("billingTransactionId");

ALTER TABLE "Boost"
  ADD CONSTRAINT "Boost_billingTransactionId_fkey"
  FOREIGN KEY ("billingTransactionId") REFERENCES "BillingTransaction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
