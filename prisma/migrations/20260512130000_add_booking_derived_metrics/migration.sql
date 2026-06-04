-- AlterTable: add derived metric fields to BookingRequest
-- firstResponseAt: when business first confirmed (NEW → CONFIRMED)
-- completedAt:     when booking was completed (CONFIRMED → COMPLETED)
-- rejectedAt:      when booking was rejected (NEW|CONFIRMED → REJECTED)
-- responseTimeMinutes: diff(firstResponseAt, createdAt) in minutes

ALTER TABLE "BookingRequest"
  ADD COLUMN IF NOT EXISTS "firstResponseAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt"            TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "responseTimeMinutes"   INTEGER;

-- Index for analytics queries (last 30 days, per business)
CREATE INDEX IF NOT EXISTS "BookingRequest_businessId_createdAt_idx"
  ON "BookingRequest"("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "BookingRequest_businessId_firstResponseAt_idx"
  ON "BookingRequest"("businessId", "firstResponseAt");
