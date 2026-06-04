-- CreateEnum
CREATE TYPE "PlaceReviewSource" AS ENUM ('MAMAGO', 'GOOGLE');

-- CreateEnum
CREATE TYPE "PlaceReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- CreateTable
CREATE TABLE "PlaceReview" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "source" "PlaceReviewSource" NOT NULL,
    "sourceReviewId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorAvatarUrl" TEXT,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "language" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "relativeTimeDescription" TEXT,
    "status" "PlaceReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaceReview_placeId_idx" ON "PlaceReview"("placeId");

-- CreateIndex
CREATE INDEX "PlaceReview_placeId_source_idx" ON "PlaceReview"("placeId", "source");

-- CreateIndex
CREATE INDEX "PlaceReview_status_idx" ON "PlaceReview"("status");

-- CreateIndex
CREATE INDEX "PlaceReview_publishedAt_idx" ON "PlaceReview"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceReview_placeId_source_sourceReviewId_key" ON "PlaceReview"("placeId", "source", "sourceReviewId");

-- AddForeignKey
ALTER TABLE "PlaceReview" ADD CONSTRAINT "PlaceReview_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
