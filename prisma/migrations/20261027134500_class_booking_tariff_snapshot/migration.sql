-- Preserve the selected public offer tariff as an immutable booking snapshot.
-- Nullable for legacy bookings and classes without configured tariffs.
ALTER TABLE "BookingRequest"
  ADD COLUMN "classTariffId" TEXT,
  ADD COLUMN "classTariffTitle" TEXT,
  ADD COLUMN "classTariffPrice" TEXT,
  ADD COLUMN "classTariffUnit" TEXT;
