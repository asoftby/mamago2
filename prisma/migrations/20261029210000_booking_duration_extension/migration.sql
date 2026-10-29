-- Existing reservations and fixed-duration offers remain unchanged by default.
ALTER TABLE "OfferBooking"
  ADD COLUMN "maxExtensionHours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "extensionHourPriceByn" DECIMAL(10,2),
  ADD COLUMN "extensionDiscountPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OfferBooking"
  ADD CONSTRAINT "OfferBooking_extension_policy_check" CHECK (
    "maxExtensionHours" BETWEEN 0 AND 8
    AND "extensionDiscountPercent" BETWEEN 0 AND 90
    AND ("extensionHourPriceByn" IS NULL OR "extensionHourPriceByn" >= 0)
    AND ("maxExtensionHours" = 0 OR "extensionHourPriceByn" IS NOT NULL)
  );
