-- Additive editor-specific revision: never rewrites existing prices or bookings.
ALTER TABLE "OfferBooking" ADD COLUMN "pricingRevision" INTEGER NOT NULL DEFAULT 0;
