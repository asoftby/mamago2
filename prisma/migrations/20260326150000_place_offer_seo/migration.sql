-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoH1" TEXT,
ADD COLUMN     "seoJsonLdOverride" JSONB,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgImage" TEXT,
ADD COLUMN     "seoOgTitle" TEXT,
ADD COLUMN     "seoRobots" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "slugUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoH1" TEXT,
ADD COLUMN     "seoJsonLdOverride" JSONB,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgImage" TEXT,
ADD COLUMN     "seoOgTitle" TEXT,
ADD COLUMN     "seoRobots" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- CreateTable
CREATE TABLE "OfferSlugHistory" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferSlugHistory_slug_key" ON "OfferSlugHistory"("slug");

-- CreateIndex
CREATE INDEX "OfferSlugHistory_offerId_idx" ON "OfferSlugHistory"("offerId");

-- CreateIndex
CREATE INDEX "OfferSlugHistory_slug_idx" ON "OfferSlugHistory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_slug_key" ON "Offer"("slug");

-- CreateIndex
CREATE INDEX "Offer_slug_idx" ON "Offer"("slug");

-- AddForeignKey
ALTER TABLE "OfferSlugHistory" ADD CONSTRAINT "OfferSlugHistory_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

