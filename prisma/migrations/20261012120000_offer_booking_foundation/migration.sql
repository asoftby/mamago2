-- Offer scheduling is prepared on top of the BookingUnit/BookingAllocation migration.
-- This migration must not be deployed until PR #526 has merged.
CREATE TYPE "ScheduleKind" AS ENUM (
  'OPENING_HOURS', 'RECURRING_SESSIONS', 'DATED_SESSIONS',
  'ON_REQUEST_WINDOWS', 'SHIFTS'
);
CREATE TYPE "ExternalLinkKind" AS ENUM ('WEBSITE', 'TICKETS');
ALTER TYPE "BookingMode" ADD VALUE 'NONE';
ALTER TYPE "BookingMode" ADD VALUE 'EXTERNAL';
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';

CREATE TABLE "OfferBooking" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "scheduleKind" "ScheduleKind",
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
  "durationMin" INTEGER,
  "bufferMin" INTEGER NOT NULL DEFAULT 0,
  "capacity" INTEGER,
  "leadTimeHours" INTEGER NOT NULL DEFAULT 24,
  "horizonDays" INTEGER NOT NULL DEFAULT 60,
  "externalKind" "ExternalLinkKind",
  "externalUrl" TEXT,
  CONSTRAINT "OfferBooking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OfferBooking_offerId_key" ON "OfferBooking"("offerId");
ALTER TABLE "OfferBooking" ADD CONSTRAINT "OfferBooking_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferBooking" ADD CONSTRAINT "OfferBooking_valid_settings"
  CHECK (("durationMin" IS NULL OR "durationMin" > 0)
    AND "bufferMin" >= 0 AND ("capacity" IS NULL OR "capacity" > 0)
    AND "leadTimeHours" >= 0 AND "horizonDays" > 0);

-- Use the existing Offer id as the one-to-one settings row id for a deterministic backfill.
INSERT INTO "OfferBooking" ("id", "offerId", "scheduleKind")
SELECT "id", "id",
  CASE WHEN "productType"::text = 'CAMP' THEN 'SHIFTS'::"ScheduleKind"
       ELSE NULL END
FROM "Offer";

CREATE TABLE "OfferScheduleRule" (
  "id" TEXT NOT NULL,
  "offerBookingId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "endMinutes" INTEGER NOT NULL,
  "validFrom" DATE,
  "validTo" DATE,
  "capacity" INTEGER,
  CONSTRAINT "OfferScheduleRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OfferScheduleRule_offerBookingId_weekday_startMinutes_endMi_key"
  ON "OfferScheduleRule"("offerBookingId", "weekday", "startMinutes", "endMinutes", "validFrom");
ALTER TABLE "OfferScheduleRule" ADD CONSTRAINT "OfferScheduleRule_offerBookingId_fkey"
  FOREIGN KEY ("offerBookingId") REFERENCES "OfferBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferScheduleRule" ADD CONSTRAINT "OfferScheduleRule_valid_interval"
  CHECK ("weekday" BETWEEN 1 AND 7 AND "startMinutes" BETWEEN 0 AND 1439
    AND "endMinutes" > "startMinutes" AND "endMinutes" <= 1440
    AND ("validFrom" IS NULL OR "validTo" IS NULL OR "validTo" >= "validFrom")
    AND ("capacity" IS NULL OR "capacity" > 0));

CREATE TABLE "OfferScheduleException" (
  "id" TEXT NOT NULL,
  "offerBookingId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  CONSTRAINT "OfferScheduleException_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OfferScheduleException_offerBookingId_date_key"
  ON "OfferScheduleException"("offerBookingId", "date");
ALTER TABLE "OfferScheduleException" ADD CONSTRAINT "OfferScheduleException_offerBookingId_fkey"
  FOREIGN KEY ("offerBookingId") REFERENCES "OfferBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferSession"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "isCancelled" BOOLEAN NOT NULL DEFAULT false;

-- Do not silently discard existing CAMP projection rows if two shifts share a start.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "OfferSession" GROUP BY "offerId", "startAt" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'OfferSession has duplicate offerId/startAt; reconcile CAMP projections before this migration';
  END IF;
END $$;
CREATE UNIQUE INDEX "OfferSession_offerId_startAt_key" ON "OfferSession"("offerId", "startAt");

ALTER TABLE "BookingRequest"
  ADD COLUMN "offerSessionId" TEXT,
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "seats" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "holdUntil" TIMESTAMP(3);
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_offerSessionId_fkey"
  FOREIGN KEY ("offerSessionId") REFERENCES "OfferSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_valid_seats_and_interval"
  CHECK ("seats" > 0 AND ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt"));
CREATE INDEX "BookingRequest_offerSessionId_status_holdUntil_idx"
  ON "BookingRequest"("offerSessionId", "status", "holdUntil");
