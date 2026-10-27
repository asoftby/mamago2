-- Additive class group/tariff model; legacy schedule rules and bookings remain valid.
CREATE TABLE "OfferClassGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "offerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OfferClassGroup_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OfferClassGroup_id_offerId_key" ON "OfferClassGroup"("id", "offerId");
CREATE INDEX "OfferClassGroup_offerId_position_idx" ON "OfferClassGroup"("offerId", "position");

CREATE TABLE "OfferClassTariff" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "price" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "periodDays" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OfferClassTariff_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OfferClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OfferClassTariff_groupId_position_idx" ON "OfferClassTariff"("groupId", "position");

ALTER TABLE "OfferScheduleRule" ADD COLUMN "classGroupId" TEXT;
CREATE INDEX "OfferScheduleRule_classGroupId_idx" ON "OfferScheduleRule"("classGroupId");
ALTER TABLE "OfferScheduleRule" ADD CONSTRAINT "OfferScheduleRule_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "OfferClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingRequest" ADD COLUMN "classGroupId" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN "classGroupTitle" TEXT;

-- Group-scoped schedule rules can share the same weekday and clock time.
DROP INDEX IF EXISTS "OfferScheduleRule_offerBookingId_weekday_startMinutes_endMinutes_validFrom_key";
CREATE INDEX "OfferScheduleRule_offerBookingId_weekday_startMinutes_endMinutes_validFrom_idx"
  ON "OfferScheduleRule"("offerBookingId", "weekday", "startMinutes", "endMinutes", "validFrom");
