-- AddColumn: camp shift snapshot fields to BookingRequest
-- These fields store a snapshot of the selected camp shift from Offer.campSessions JSON

ALTER TABLE "BookingRequest"
  ADD COLUMN IF NOT EXISTS "campShiftId"       TEXT,
  ADD COLUMN IF NOT EXISTS "campShiftTitle"    TEXT,
  ADD COLUMN IF NOT EXISTS "campShiftDateFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "campShiftDateTo"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "childName"         TEXT,
  ADD COLUMN IF NOT EXISTS "childAge"          INTEGER;

-- Index for filtering bookings by camp shift
CREATE INDEX IF NOT EXISTS "BookingRequest_campShiftId_idx"
  ON "BookingRequest"("campShiftId");
