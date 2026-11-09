-- Keep the exclusive-lock window independent of the size of BookingAllocation.
BEGIN;
SET LOCAL lock_timeout = '3s';

ALTER TABLE "BookingAllocation"
  ALTER COLUMN "bookingRequestId" DROP NOT NULL,
  ADD COLUMN "offerSessionId" TEXT,
  ADD COLUMN "activitySessionId" TEXT,
  ADD CONSTRAINT "BookingAllocation_exactly_one_owner"
    CHECK (num_nonnulls("bookingRequestId", "offerSessionId", "activitySessionId") = 1) NOT VALID,
  ADD CONSTRAINT "BookingAllocation_quote_requires_request"
    CHECK ("partyQuoteId" IS NULL OR "bookingRequestId" IS NOT NULL) NOT VALID;

ALTER TABLE "BookingAllocation"
  ADD CONSTRAINT "BookingAllocation_offerSessionId_fkey"
    FOREIGN KEY ("offerSessionId") REFERENCES "OfferSession"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "BookingAllocation_activitySessionId_fkey"
    FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

COMMIT;
