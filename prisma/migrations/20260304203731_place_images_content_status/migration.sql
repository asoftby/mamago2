/*
  Warnings:

  - You are about to drop the column `address` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `ageMaxMonths` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `ageMinMonths` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `coverImage` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `districtId` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `metroId` on the `Place` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[googlePlaceId]` on the table `Place` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category` to the `Place` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerUserId` to the `Place` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shortDesc` to the `Place` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'NEEDS_CHANGES', 'REJECTED');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GOOGLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlaceImageKind" AS ENUM ('LOGO', 'GALLERY');

-- DropForeignKey
ALTER TABLE "Place" DROP CONSTRAINT "Place_businessId_fkey";

-- DropForeignKey
ALTER TABLE "Place" DROP CONSTRAINT "Place_cityId_fkey";

-- DropForeignKey
ALTER TABLE "Place" DROP CONSTRAINT "Place_districtId_fkey";

-- DropForeignKey
ALTER TABLE "Place" DROP CONSTRAINT "Place_metroId_fkey";

-- DropIndex
DROP INDEX "Place_ageMinMonths_ageMaxMonths_idx";

-- DropIndex
DROP INDEX "Place_businessId_idx";

-- AlterTable
ALTER TABLE "Place" DROP COLUMN "address",
DROP COLUMN "ageMaxMonths",
DROP COLUMN "ageMinMonths",
DROP COLUMN "businessId",
DROP COLUMN "coverImage",
DROP COLUMN "districtId",
DROP COLUMN "metroId",
ADD COLUMN     "activityTypes" TEXT[],
ADD COLUMN     "addressJson" JSONB,
ADD COLUMN     "ageTags" TEXT[],
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "customAddress" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "formattedAddr" TEXT,
ADD COLUMN     "googlePlaceId" TEXT,
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "locationSource" "LocationSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "logoImageId" TEXT,
ADD COLUMN     "ownerUserId" TEXT NOT NULL,
ADD COLUMN     "shortDesc" TEXT NOT NULL,
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "visitFormats" TEXT[],
ALTER COLUMN "cityId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PlaceImage" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "kind" "PlaceImageKind" NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaceImage_placeId_kind_sortOrder_idx" ON "PlaceImage"("placeId", "kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Place_googlePlaceId_key" ON "Place"("googlePlaceId");

-- CreateIndex
CREATE INDEX "Place_ownerUserId_idx" ON "Place"("ownerUserId");

-- CreateIndex
CREATE INDEX "Place_status_idx" ON "Place"("status");

-- CreateIndex
CREATE INDEX "Place_googlePlaceId_idx" ON "Place"("googlePlaceId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceImage" ADD CONSTRAINT "PlaceImage_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
