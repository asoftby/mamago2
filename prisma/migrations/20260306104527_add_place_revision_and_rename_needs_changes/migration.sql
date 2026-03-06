/*
  Warnings:

  - The values [NEEDS_CHANGES] on the enum `ContentStatus` will be removed. If these variants are still used in the database, this will fail.

*/

-- CreateEnum
CREATE TYPE "PlaceRevisionStatus" AS ENUM ('DRAFT', 'PENDING', 'NEEDS_REVISION', 'APPROVED', 'REJECTED');

-- AlterEnum: Rename NEEDS_CHANGES to NEEDS_REVISION
-- This is done by creating a new enum type and migrating data
BEGIN;
-- First, update any existing NEEDS_CHANGES values to a temporary value
UPDATE "Place" SET "status" = 'DRAFT' WHERE "status" = 'NEEDS_CHANGES';
UPDATE "Activity" SET "status" = 'DRAFT' WHERE "status" = 'NEEDS_CHANGES';

-- Now create the new enum and migrate
CREATE TYPE "ContentStatus_new" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'NEEDS_REVISION', 'REJECTED');
ALTER TABLE "public"."Activity" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Place" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Activity" ALTER COLUMN "status" TYPE "ContentStatus_new" USING ("status"::text::"ContentStatus_new");
ALTER TABLE "Place" ALTER COLUMN "status" TYPE "ContentStatus_new" USING ("status"::text::"ContentStatus_new");
ALTER TYPE "ContentStatus" RENAME TO "ContentStatus_old";
ALTER TYPE "ContentStatus_new" RENAME TO "ContentStatus";
DROP TYPE "public"."ContentStatus_old";
ALTER TABLE "Activity" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "Place" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- CreateTable
CREATE TABLE "PlaceRevision" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "status" "PlaceRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "moderatorComment" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "revisionRequestedAt" TIMESTAMP(3),
    "revisionResubmittedAt" TIMESTAMP(3),
    "title" TEXT,
    "category" TEXT,
    "shortDesc" TEXT,
    "description" TEXT,
    "logoImageId" TEXT,
    "googlePlaceId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "formattedAddr" TEXT,
    "addressJson" JSONB,
    "countryCode" TEXT,
    "cityId" TEXT,
    "locationSource" "LocationSource",
    "customAddress" TEXT,
    "districtAutoId" TEXT,
    "districtManualId" TEXT,
    "metroAutoId" TEXT,
    "metroAutoDistanceM" INTEGER,
    "metroManualId" TEXT,
    "metroManualDistanceM" INTEGER,
    "placeKind" "PlaceKind",
    "parentPlaceId" TEXT,
    "unitLabel" TEXT,
    "floor" TEXT,
    "unit" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "instagramHandle" TEXT,
    "instagramUrl" TEXT,
    "ageTags" TEXT[],
    "visitFormats" TEXT[],
    "activityTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceRevisionImage" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "kind" "PlaceImageKind" NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceRevisionImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaceRevision_placeId_status_idx" ON "PlaceRevision"("placeId", "status");

-- CreateIndex
CREATE INDEX "PlaceRevision_status_idx" ON "PlaceRevision"("status");

-- CreateIndex
CREATE INDEX "PlaceRevision_reviewedByUserId_idx" ON "PlaceRevision"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "PlaceRevision_status_revisionRequestedAt_idx" ON "PlaceRevision"("status", "revisionRequestedAt");

-- CreateIndex
CREATE INDEX "PlaceRevision_placeId_createdAt_idx" ON "PlaceRevision"("placeId", "createdAt");

-- CreateIndex
CREATE INDEX "PlaceRevisionImage_revisionId_kind_sortOrder_idx" ON "PlaceRevisionImage"("revisionId", "kind", "sortOrder");

-- AddForeignKey
ALTER TABLE "PlaceRevision" ADD CONSTRAINT "PlaceRevision_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceRevision" ADD CONSTRAINT "PlaceRevision_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceRevision" ADD CONSTRAINT "PlaceRevision_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceRevisionImage" ADD CONSTRAINT "PlaceRevisionImage_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "PlaceRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
