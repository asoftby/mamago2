-- Nullable idempotency columns keep all historical and generic bookings intact.
ALTER TABLE "BookingRequest"
  ADD COLUMN "slotIdempotencyKey" TEXT,
  ADD COLUMN "slotRequestHash" TEXT;

-- PostgreSQL permits multiple NULL values: only requests carrying a key are unique.
CREATE UNIQUE INDEX "BookingRequest_offerId_slotIdempotencyKey_key"
  ON "BookingRequest"("offerId", "slotIdempotencyKey");
