-- CreateEnum
CREATE TYPE "PartyVenueMode" AS ENUM ('VENUE', 'PACKAGE', 'HOME', 'OUTDOOR');

-- CreateEnum
CREATE TYPE "PartyOrderStatus" AS ENUM ('DRAFT', 'ANCHOR_PENDING', 'NEEDS_ALTERNATIVE', 'ANCHOR_CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartyItemRole" AS ENUM ('ANCHOR', 'STANDALONE', 'INCLUDED', 'ADDON');

-- CreateEnum
CREATE TYPE "PartyItemStatus" AS ENUM ('PLANNED', 'REQUESTED', 'NEEDS_DECISION', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingKind" AS ENUM ('STANDARD', 'PARTY');

-- CreateEnum
CREATE TYPE "PartyRequestStage" AS ENUM ('SENT', 'QUOTED', 'AWAITING_RECONFIRM', 'DECLINED', 'EXPIRED', 'NOT_ACCEPTED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartyCloseReason" AS ENUM ('BUSINESS_DECLINED', 'EXPIRED', 'NOT_SELECTED', 'CUSTOMER_CANCELLED', 'BUSINESS_CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteType" AS ENUM ('AS_REQUESTED', 'MODIFIED', 'DECLINED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DeclineReason" AS ENUM ('DATE_BUSY', 'BUDGET', 'FORMAT', 'NOT_ENOUGH_TIME', 'OTHER');

-- CreateEnum
CREATE TYPE "PartyOutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "BookingUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BookingUnitType" AS ENUM ('EXCLUSIVE');

-- CreateEnum
CREATE TYPE "AvailabilityExceptionKind" AS ENUM ('CLOSED', 'OPEN_OVERRIDE');

-- CreateEnum
CREATE TYPE "CalendarBlockSource" AS ENUM ('MANUAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "BookingAllocationStatus" AS ENUM ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingActivityType" ADD VALUE 'QUOTE_SENT';
ALTER TYPE "BookingActivityType" ADD VALUE 'QUOTE_ACCEPTED';
ALTER TYPE "BookingActivityType" ADD VALUE 'QUOTE_REJECTED';
ALTER TYPE "BookingActivityType" ADD VALUE 'REQUEST_EXPIRED';
ALTER TYPE "BookingActivityType" ADD VALUE 'REQUEST_WITHDRAWN';

-- AlterEnum
ALTER TYPE "BookingActivityActorType" ADD VALUE 'CUSTOMER';

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "kind" "BookingKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "partyCloseReason" "PartyCloseReason",
ADD COLUMN     "partyOrderItemId" TEXT,
ADD COLUMN     "partyStage" "PartyRequestStage",
ADD COLUMN     "responseDueAt" TIMESTAMP(3),
ALTER COLUMN "customerName" DROP NOT NULL,
ALTER COLUMN "customerPhone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PartyOrder" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "familyId" TEXT,
    "citySlug" TEXT NOT NULL,
    "venueMode" "PartyVenueMode" NOT NULL,
    "eventDate" DATE,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "childrenCount" INTEGER,
    "adultsCount" INTEGER,
    "childAge" INTEGER,
    "childName" TEXT,
    "budgetByn" DECIMAL(10,2),
    "contactName" TEXT,
    "contactPhone" TEXT,
    "status" "PartyOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "submitKey" TEXT,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "planItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyOrderItem" (
    "id" TEXT NOT NULL,
    "partyOrderId" TEXT NOT NULL,
    "category" "PartyCategory" NOT NULL,
    "offerId" TEXT,
    "businessId" TEXT,
    "packageComponentId" TEXT,
    "role" "PartyItemRole" NOT NULL,
    "parentItemId" TEXT,
    "offerPriceSnapshot" DECIMAL(10,2),
    "note" TEXT,
    "status" "PartyItemStatus" NOT NULL DEFAULT 'PLANNED',
    "confirmedBookingRequestId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyQuote" (
    "id" TEXT NOT NULL,
    "bookingRequestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" "QuoteType" NOT NULL,
    "priceByn" DECIMAL(10,2),
    "includes" TEXT,
    "durationMinutes" INTEGER,
    "prepaymentTerms" TEXT,
    "cancellationTerms" TEXT,
    "changeReason" TEXT,
    "declineReason" "DeclineReason",
    "declineComment" TEXT,
    "validUntil" TIMESTAMP(3),
    "status" "QuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "respondedByUserId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "bookingUnitId" TEXT,
    "serviceStart" TIMESTAMP(3),
    "serviceEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyOutbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "PartyOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingUnit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "placeId" TEXT,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
    "capacity" INTEGER,
    "prepMinutes" INTEGER NOT NULL DEFAULT 0,
    "cleanupMinutes" INTEGER NOT NULL DEFAULT 0,
    "minDurationMinutes" INTEGER,
    "stepMinutes" INTEGER NOT NULL DEFAULT 30,
    "type" "BookingUnitType" NOT NULL DEFAULT 'EXCLUSIVE',
    "status" "BookingUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingUnitOffer" (
    "bookingUnitId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,

    CONSTRAINT "BookingUnitOffer_pkey" PRIMARY KEY ("bookingUnitId","offerId")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "bookingUnitId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "bookingUnitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "AvailabilityExceptionKind" NOT NULL,
    "startMinutes" INTEGER,
    "endMinutes" INTEGER,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarBlock" (
    "id" TEXT NOT NULL,
    "bookingUnitId" TEXT NOT NULL,
    "blockStart" TIMESTAMP(3) NOT NULL,
    "blockEnd" TIMESTAMP(3) NOT NULL,
    "source" "CalendarBlockSource" NOT NULL DEFAULT 'MANUAL',
    "externalRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAllocation" (
    "id" TEXT NOT NULL,
    "bookingUnitId" TEXT NOT NULL,
    "bookingRequestId" TEXT NOT NULL,
    "partyQuoteId" TEXT,
    "blockStart" TIMESTAMP(3) NOT NULL,
    "blockEnd" TIMESTAMP(3) NOT NULL,
    "status" "BookingAllocationStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartyOrder_submitKey_key" ON "PartyOrder"("submitKey");

-- CreateIndex
CREATE INDEX "PartyOrder_ownerUserId_status_idx" ON "PartyOrder"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "PartyOrder_familyId_idx" ON "PartyOrder"("familyId");

-- CreateIndex
CREATE INDEX "PartyOrder_citySlug_eventDate_idx" ON "PartyOrder"("citySlug", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "PartyOrderItem_confirmedBookingRequestId_key" ON "PartyOrderItem"("confirmedBookingRequestId");

-- CreateIndex
CREATE INDEX "PartyOrderItem_partyOrderId_position_idx" ON "PartyOrderItem"("partyOrderId", "position");

-- CreateIndex
CREATE INDEX "PartyOrderItem_offerId_idx" ON "PartyOrderItem"("offerId");

-- CreateIndex
CREATE INDEX "PartyOrderItem_businessId_idx" ON "PartyOrderItem"("businessId");

-- CreateIndex
CREATE INDEX "PartyOrderItem_parentItemId_idx" ON "PartyOrderItem"("parentItemId");

-- CreateIndex
CREATE INDEX "PartyQuote_bookingUnitId_serviceStart_serviceEnd_idx" ON "PartyQuote"("bookingUnitId", "serviceStart", "serviceEnd");

-- CreateIndex
CREATE INDEX "PartyQuote_status_validUntil_idx" ON "PartyQuote"("status", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PartyQuote_bookingRequestId_version_key" ON "PartyQuote"("bookingRequestId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PartyQuote_bookingRequestId_idempotencyKey_key" ON "PartyQuote"("bookingRequestId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PartyOutbox_dedupeKey_key" ON "PartyOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "PartyOutbox_status_nextAttemptAt_idx" ON "PartyOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BookingUnit_businessId_status_idx" ON "BookingUnit"("businessId", "status");

-- CreateIndex
CREATE INDEX "BookingUnit_placeId_idx" ON "BookingUnit"("placeId");

-- CreateIndex
CREATE INDEX "BookingUnitOffer_offerId_idx" ON "BookingUnitOffer"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityRule_bookingUnitId_weekday_startMinutes_endMinu_key" ON "AvailabilityRule"("bookingUnitId", "weekday", "startMinutes", "endMinutes");

-- CreateIndex
CREATE INDEX "AvailabilityException_bookingUnitId_date_idx" ON "AvailabilityException"("bookingUnitId", "date");

-- CreateIndex
CREATE INDEX "CalendarBlock_bookingUnitId_blockStart_blockEnd_idx" ON "CalendarBlock"("bookingUnitId", "blockStart", "blockEnd");

-- CreateIndex
CREATE INDEX "CalendarBlock_source_externalRef_idx" ON "CalendarBlock"("source", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAllocation_partyQuoteId_key" ON "BookingAllocation"("partyQuoteId");

-- CreateIndex
CREATE INDEX "BookingAllocation_bookingUnitId_status_blockStart_blockEnd_idx" ON "BookingAllocation"("bookingUnitId", "status", "blockStart", "blockEnd");

-- CreateIndex
CREATE INDEX "BookingAllocation_bookingRequestId_idx" ON "BookingAllocation"("bookingRequestId");

-- CreateIndex
CREATE INDEX "BookingRequest_kind_businessId_partyStage_idx" ON "BookingRequest"("kind", "businessId", "partyStage");

-- CreateIndex
CREATE INDEX "BookingRequest_partyOrderItemId_idx" ON "BookingRequest"("partyOrderItemId");

-- AddForeignKey
ALTER TABLE "PartyOrder" ADD CONSTRAINT "PartyOrder_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrder" ADD CONSTRAINT "PartyOrder_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrderItem" ADD CONSTRAINT "PartyOrderItem_partyOrderId_fkey" FOREIGN KEY ("partyOrderId") REFERENCES "PartyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrderItem" ADD CONSTRAINT "PartyOrderItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrderItem" ADD CONSTRAINT "PartyOrderItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrderItem" ADD CONSTRAINT "PartyOrderItem_packageComponentId_fkey" FOREIGN KEY ("packageComponentId") REFERENCES "PackageComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrderItem" ADD CONSTRAINT "PartyOrderItem_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "PartyOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrderItem" ADD CONSTRAINT "PartyOrderItem_confirmedBookingRequestId_fkey" FOREIGN KEY ("confirmedBookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyQuote" ADD CONSTRAINT "PartyQuote_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyQuote" ADD CONSTRAINT "PartyQuote_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyQuote" ADD CONSTRAINT "PartyQuote_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyQuote" ADD CONSTRAINT "PartyQuote_bookingUnitId_fkey" FOREIGN KEY ("bookingUnitId") REFERENCES "BookingUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingUnit" ADD CONSTRAINT "BookingUnit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingUnit" ADD CONSTRAINT "BookingUnit_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingUnitOffer" ADD CONSTRAINT "BookingUnitOffer_bookingUnitId_fkey" FOREIGN KEY ("bookingUnitId") REFERENCES "BookingUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingUnitOffer" ADD CONSTRAINT "BookingUnitOffer_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_bookingUnitId_fkey" FOREIGN KEY ("bookingUnitId") REFERENCES "BookingUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_bookingUnitId_fkey" FOREIGN KEY ("bookingUnitId") REFERENCES "BookingUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_bookingUnitId_fkey" FOREIGN KEY ("bookingUnitId") REFERENCES "BookingUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAllocation" ADD CONSTRAINT "BookingAllocation_bookingUnitId_fkey" FOREIGN KEY ("bookingUnitId") REFERENCES "BookingUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAllocation" ADD CONSTRAINT "BookingAllocation_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAllocation" ADD CONSTRAINT "BookingAllocation_partyQuoteId_fkey" FOREIGN KEY ("partyQuoteId") REFERENCES "PartyQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_partyOrderItemId_fkey" FOREIGN KEY ("partyOrderItemId") REFERENCES "PartyOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Preserve the old required-contact invariant for normal bookings.
-- Party requests have no customer contact fields until final confirmation.
ALTER TABLE "BookingRequest"
  ADD CONSTRAINT "BookingRequest_standard_contacts_required"
  CHECK ("kind" <> 'STANDARD' OR ("customerName" IS NOT NULL AND "customerPhone" IS NOT NULL));

-- Domain checks. All business-local schedule minutes are interpreted in BookingUnit.timezone.
ALTER TABLE "BookingUnit"
  ADD CONSTRAINT "BookingUnit_buffers_nonnegative"
  CHECK ("prepMinutes" >= 0 AND "cleanupMinutes" >= 0
         AND "stepMinutes" > 0
         AND ("minDurationMinutes" IS NULL OR "minDurationMinutes" > 0)
         AND ("capacity" IS NULL OR "capacity" > 0));
ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT "AvailabilityRule_valid_interval"
  CHECK ("weekday" BETWEEN 1 AND 7
         AND "startMinutes" BETWEEN 0 AND 1439
         AND "endMinutes" > "startMinutes"
         AND "endMinutes" <= 1440);
ALTER TABLE "AvailabilityException"
  ADD CONSTRAINT "AvailabilityException_valid_interval"
  CHECK (("startMinutes" IS NULL AND "endMinutes" IS NULL) OR
         ("startMinutes" BETWEEN 0 AND 1439 AND
          "endMinutes" > "startMinutes" AND "endMinutes" <= 1440));
ALTER TABLE "CalendarBlock"
  ADD CONSTRAINT "CalendarBlock_valid_interval"
  CHECK ("blockEnd" > "blockStart");
ALTER TABLE "BookingAllocation"
  ADD CONSTRAINT "BookingAllocation_valid_interval"
  CHECK ("blockEnd" > "blockStart" AND
         ("status" <> 'HELD' OR "expiresAt" IS NOT NULL));

-- Even if two application requests race, the database must reject overlapping
-- live reservations for the same exclusive resource. Expired HELD records
-- are moved to EXPIRED by the reservation transaction before insertion.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "BookingAllocation"
  ADD CONSTRAINT "BookingAllocation_no_active_overlap"
  EXCLUDE USING gist (
    "bookingUnitId" WITH =,
    tsrange("blockStart", "blockEnd", '[)') WITH &&
  )
  WHERE ("status" IN ('HELD', 'CONFIRMED'));

-- Exactly one actively negotiated offer per request; older quote versions
-- remain immutable records with SUPERSEDED status.
CREATE UNIQUE INDEX "PartyQuote_one_active_per_request"
  ON "PartyQuote" ("bookingRequestId")
  WHERE "status" = 'ACTIVE';

-- Only one confirmed performer may be attached to a party item.
-- This complements PartyOrderItem.confirmedBookingRequestId @unique.
CREATE UNIQUE INDEX "BookingRequest_one_confirmed_per_party_item"
  ON "BookingRequest" ("partyOrderItemId")
  WHERE "kind" = 'PARTY' AND "partyStage" = 'CONFIRMED';
