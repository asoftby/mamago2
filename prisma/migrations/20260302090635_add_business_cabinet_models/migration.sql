-- CreateEnum
CREATE TYPE "OfferKind" AS ENUM ('EVENT', 'SERVICE');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "metroId" TEXT,
    "districtId" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "coverImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "kind" "OfferKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "priceFrom" DOUBLE PRECISION,
    "priceText" TEXT,
    "ageMinMonths" INTEGER,
    "ageMaxMonths" INTEGER,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "promoTitle" TEXT,
    "promoDescription" TEXT,
    "promoUntil" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boost" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_ownerUserId_key" ON "Business"("ownerUserId");

-- CreateIndex
CREATE INDEX "Business_ownerUserId_idx" ON "Business"("ownerUserId");

-- CreateIndex
CREATE INDEX "Place_businessId_idx" ON "Place"("businessId");

-- CreateIndex
CREATE INDEX "Place_cityId_idx" ON "Place"("cityId");

-- CreateIndex
CREATE INDEX "Offer_placeId_idx" ON "Offer"("placeId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "Offer_kind_idx" ON "Offer"("kind");

-- CreateIndex
CREATE INDEX "Offer_dateFrom_idx" ON "Offer"("dateFrom");

-- CreateIndex
CREATE INDEX "Offer_ageMinMonths_ageMaxMonths_idx" ON "Offer"("ageMinMonths", "ageMaxMonths");

-- CreateIndex
CREATE INDEX "Boost_offerId_idx" ON "Boost"("offerId");

-- CreateIndex
CREATE INDEX "Boost_startAt_endAt_idx" ON "Boost"("startAt", "endAt");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_metroId_fkey" FOREIGN KEY ("metroId") REFERENCES "MetroStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boost" ADD CONSTRAINT "Boost_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
