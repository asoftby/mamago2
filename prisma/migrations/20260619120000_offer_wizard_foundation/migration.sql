-- Offer Wizard Foundation — Fase 1
-- Purely additive: CREATE TABLE, ADD COLUMN, CREATE INDEX only.
-- Pre-existing drift (OfferBirthdayDetails/OfferPlacement drops, Place column drops)
-- is NOT included — requires a separate decision by the team.
-- OfferProductType enum and productType column already exist in DB (not re-created).

-- CreateEnum
CREATE TYPE "ComponentCategory" AS ENUM ('ANIMATOR', 'SHOW', 'CAKE', 'DECOR', 'PHOTO', 'FOOD', 'VENUE', 'PROGRAM', 'OTHER');

-- AlterTable: Offer.details — отображаемый хвост деталей по типу предложения
ALTER TABLE "Offer" ADD COLUMN "details" JSONB;

-- CreateTable: OfferSession — queryable строки смен (date/budget фильтры в ленте)
CREATE TABLE "OfferSession" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "price" DECIMAL(10,2),

    CONSTRAINT "OfferSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PackageComponent — состав пакета (реляционный, не JSON)
CREATE TABLE "PackageComponent" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "refOfferId" TEXT,
    "category" "ComponentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(10,2),
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "priceDelta" DECIMAL(10,2),
    "position" INTEGER NOT NULL,

    CONSTRAINT "PackageComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferSession_offerId_idx" ON "OfferSession"("offerId");

-- CreateIndex
CREATE INDEX "OfferSession_startAt_endAt_idx" ON "OfferSession"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "OfferSession_price_idx" ON "OfferSession"("price");

-- CreateIndex
CREATE INDEX "PackageComponent_packageId_position_idx" ON "PackageComponent"("packageId", "position");

-- AddForeignKey
ALTER TABLE "OfferSession" ADD CONSTRAINT "OfferSession_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_refOfferId_fkey" FOREIGN KEY ("refOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
