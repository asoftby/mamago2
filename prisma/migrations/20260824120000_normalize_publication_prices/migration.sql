-- CreateEnum
CREATE TYPE "PublicationPriceMode" AS ENUM ('FREE', 'EXACT', 'FROM', 'RANGE', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "priceMode" "PublicationPriceMode" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "Offer"
ADD COLUMN "priceTo" DOUBLE PRECISION,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BYN',
ADD COLUMN "priceMode" "PublicationPriceMode" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "priceItems" JSONB;

-- AlterTable
ALTER TABLE "Place"
ADD COLUMN "priceFrom" DOUBLE PRECISION,
ADD COLUMN "priceTo" DOUBLE PRECISION,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BYN',
ADD COLUMN "priceMode" "PublicationPriceMode" NOT NULL DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE INDEX "Activity_priceFrom_idx" ON "Activity"("priceFrom");
CREATE INDEX "Offer_priceFrom_idx" ON "Offer"("priceFrom");
CREATE INDEX "Place_priceFrom_idx" ON "Place"("priceFrom");
