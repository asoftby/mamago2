-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "googleMapsUri" TEXT,
ADD COLUMN     "googleRating" DOUBLE PRECISION,
ADD COLUMN     "googleReviewsJson" JSONB,
ADD COLUMN     "googleReviewsSyncedAt" TIMESTAMP(3),
ADD COLUMN     "googleUserRatingsTotal" INTEGER;
