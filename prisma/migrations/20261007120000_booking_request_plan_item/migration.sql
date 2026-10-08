-- Family Core M6: link a booking to the plan item it was made for.
-- Nullable column, no backfill; deleting the plan item keeps the booking.
ALTER TABLE "BookingRequest" ADD COLUMN "planItemId" TEXT;

CREATE INDEX "BookingRequest_planItemId_idx" ON "BookingRequest"("planItemId");

ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "PlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
