-- Additive pricing foundation for Booking Core #830.
-- Existing party quotes, class tariffs and booking requests remain unchanged.
ALTER TABLE "OfferBooking"
  ADD COLUMN "basePriceByn" DECIMAL(10,2);

CREATE TYPE "OfferBookingOptionMode" AS ENUM ('INCLUDED', 'OPTIONAL', 'STANDALONE');

CREATE TABLE "OfferBookingOption" (
  "id" TEXT NOT NULL,
  "offerBookingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mode" "OfferBookingOptionMode" NOT NULL DEFAULT 'OPTIONAL',
  "priceByn" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "bookingUnitId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OfferBookingOption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OfferBookingOption_non_negative_price" CHECK ("priceByn" >= 0)
);

CREATE INDEX "OfferBookingOption_offerBookingId_active_position_idx"
  ON "OfferBookingOption"("offerBookingId", "active", "position");
CREATE INDEX "OfferBookingOption_bookingUnitId_idx"
  ON "OfferBookingOption"("bookingUnitId");

ALTER TABLE "OfferBookingOption" ADD CONSTRAINT "OfferBookingOption_offerBookingId_fkey"
  FOREIGN KEY ("offerBookingId") REFERENCES "OfferBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferBookingOption" ADD CONSTRAINT "OfferBookingOption_bookingUnitId_fkey"
  FOREIGN KEY ("bookingUnitId") REFERENCES "BookingUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OfferBooking"
  ADD CONSTRAINT "OfferBooking_non_negative_base_price" CHECK ("basePriceByn" IS NULL OR "basePriceByn" >= 0);

ALTER TABLE "BookingRequest"
  ADD COLUMN "bookingPriceSnapshot" JSONB,
  ADD COLUMN "bookingTotalByn" DECIMAL(10,2);

ALTER TABLE "BookingRequest"
  ADD CONSTRAINT "BookingRequest_non_negative_total" CHECK ("bookingTotalByn" IS NULL OR "bookingTotalByn" >= 0);
