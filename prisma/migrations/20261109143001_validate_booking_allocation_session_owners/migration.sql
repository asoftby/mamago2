-- Validation scans existing rows while allowing normal reads and writes.
BEGIN;
SET LOCAL lock_timeout = '3s';

ALTER TABLE "BookingAllocation"
  VALIDATE CONSTRAINT "BookingAllocation_exactly_one_owner",
  VALIDATE CONSTRAINT "BookingAllocation_quote_requires_request",
  VALIDATE CONSTRAINT "BookingAllocation_offerSessionId_fkey",
  VALIDATE CONSTRAINT "BookingAllocation_activitySessionId_fkey";

COMMIT;
