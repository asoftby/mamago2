-- CreateEnum
CREATE TYPE "OfferProductType" AS ENUM (
  'PLACE_VISIT',
  'ONE_TIME_ACTIVITY',
  'REGULAR_ACTIVITY',
  'CAMP',
  'PARTY_SERVICE',
  'PARTY_PACKAGE'
);

-- CreateEnum
CREATE TYPE "OfferPlacementKey" AS ENUM (
  'WHERE_TO_GO',
  'CLASSES',
  'CAMPS',
  'BIRTHDAY'
);

-- CreateEnum
CREATE TYPE "OfferPlacementStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'REJECTED'
);

-- CreateEnum
CREATE TYPE "BirthdayRole" AS ENUM (
  'VENUE',
  'ANIMATOR',
  'SHOW',
  'MASTER_CLASS',
  'CAKE',
  'CATERING',
  'DECOR',
  'PHOTO_VIDEO',
  'PACKAGE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "BirthdayLocationType" AS ENUM (
  'ON_SITE',
  'OFF_SITE',
  'BOTH'
);

-- AlterTable
ALTER TABLE "Offer"
ADD COLUMN "productType" "OfferProductType";

-- CreateTable
CREATE TABLE "OfferPlacement" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "key" "OfferPlacementKey" NOT NULL,
  "status" "OfferPlacementStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OfferPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferBirthdayDetails" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "role" "BirthdayRole" NOT NULL,
  "locationType" "BirthdayLocationType",
  "durationMinutes" INTEGER,
  "minChildren" INTEGER,
  "maxChildren" INTEGER,
  "priceFrom" DECIMAL(10,2),
  "included" TEXT,
  "program" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OfferBirthdayDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_productType_idx" ON "Offer"("productType");

-- CreateIndex
CREATE UNIQUE INDEX "OfferPlacement_offerId_key_key" ON "OfferPlacement"("offerId", "key");

-- CreateIndex
CREATE INDEX "OfferPlacement_key_status_idx" ON "OfferPlacement"("key", "status");

-- CreateIndex
CREATE INDEX "OfferPlacement_offerId_status_idx" ON "OfferPlacement"("offerId", "status");

-- CreateIndex
CREATE INDEX "OfferPlacement_reviewedById_status_idx" ON "OfferPlacement"("reviewedById", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OfferBirthdayDetails_offerId_key" ON "OfferBirthdayDetails"("offerId");

-- AddForeignKey
ALTER TABLE "OfferPlacement"
ADD CONSTRAINT "OfferPlacement_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPlacement"
ADD CONSTRAINT "OfferPlacement_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPlacement"
ADD CONSTRAINT "OfferPlacement_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferBirthdayDetails"
ADD CONSTRAINT "OfferBirthdayDetails_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill productType conservatively from reliable legacy data.
UPDATE "Offer"
SET "productType" = CASE
  WHEN "campProgramType" IS NOT NULL THEN 'CAMP'::"OfferProductType"
  WHEN "kind" = 'EVENT' THEN 'ONE_TIME_ACTIVITY'::"OfferProductType"
  WHEN "kind" = 'SERVICE' THEN 'PLACE_VISIT'::"OfferProductType"
  ELSE "productType"
END
WHERE "productType" IS NULL;

-- Backfill approved CAMP placement from reliable camp offers.
INSERT INTO "OfferPlacement" (
  "id",
  "offerId",
  "key",
  "status",
  "requestedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'op_' || substr(md5("id" || ':CAMPS'), 1, 24),
  "id",
  'CAMPS'::"OfferPlacementKey",
  'APPROVED'::"OfferPlacementStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Offer"
WHERE "productType" = 'CAMP'::"OfferProductType"
ON CONFLICT ("offerId", "key") DO NOTHING;

-- Backfill approved WHERE_TO_GO placement for legacy EVENT offers.
INSERT INTO "OfferPlacement" (
  "id",
  "offerId",
  "key",
  "status",
  "requestedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'op_' || substr(md5("id" || ':WHERE_TO_GO:APPROVED'), 1, 24),
  "id",
  'WHERE_TO_GO'::"OfferPlacementKey",
  'APPROVED'::"OfferPlacementStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Offer"
WHERE "productType" = 'ONE_TIME_ACTIVITY'::"OfferProductType"
ON CONFLICT ("offerId", "key") DO NOTHING;

-- Backfill REQUESTED WHERE_TO_GO placement for legacy SERVICE offers.
INSERT INTO "OfferPlacement" (
  "id",
  "offerId",
  "key",
  "status",
  "requestedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'op_' || substr(md5("id" || ':WHERE_TO_GO:REQUESTED'), 1, 24),
  "id",
  'WHERE_TO_GO'::"OfferPlacementKey",
  'REQUESTED'::"OfferPlacementStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Offer"
WHERE "productType" = 'PLACE_VISIT'::"OfferProductType"
ON CONFLICT ("offerId", "key") DO NOTHING;
