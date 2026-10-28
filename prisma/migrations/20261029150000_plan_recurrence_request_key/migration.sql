-- Idempotency key for recurring-series creation. Nullable for series created before this version.
ALTER TABLE "PlanRecurrenceSeries" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "PlanRecurrenceSeries_requestKey_key" ON "PlanRecurrenceSeries"("requestKey");
