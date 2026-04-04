/*
  Warnings:

  - You are about to drop the column `ownerUserId` on the `Place` table. All the data in the column will be lost.
  - The `status` column on the `PlaceClaimRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `ownerUserId` on the `PlaceGroup` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[createdByUserId,createRequestId]` on the table `Place` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdByUserId` to the `Place` table without a default value. This is not possible if the table is not empty.
  - Made the column `businessId` on table `PlaceClaimRequest` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `createdByUserId` to the `PlaceGroup` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlaceClaimRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- DropForeignKey
ALTER TABLE "Place" DROP CONSTRAINT "Place_ownerUserId_fkey";

-- DropIndex
DROP INDEX "Place_ownerUserId_createRequestId_key";

-- DropIndex
DROP INDEX "Place_ownerUserId_idx";

-- DropIndex
DROP INDEX "PlaceGroup_ownerUserId_idx";

-- DropIndex
DROP INDEX "UserBehaviorProfile_segmentKeys_gin_idx";

-- AlterTable
ALTER TABLE "Place" DROP COLUMN "ownerUserId",
ADD COLUMN     "createdByUserId" TEXT NOT NULL,
ADD COLUMN     "ownerBusinessId" TEXT;

-- AlterTable
ALTER TABLE "PlaceClaimRequest" ALTER COLUMN "businessId" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "PlaceClaimRequestStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "PlaceGroup" DROP COLUMN "ownerUserId",
ADD COLUMN     "createdByUserId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Place_createdByUserId_idx" ON "Place"("createdByUserId");

-- CreateIndex
CREATE INDEX "Place_ownerBusinessId_idx" ON "Place"("ownerBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_createdByUserId_createRequestId_key" ON "Place"("createdByUserId", "createRequestId");

-- CreateIndex
CREATE INDEX "PlaceClaimRequest_placeId_status_idx" ON "PlaceClaimRequest"("placeId", "status");

-- CreateIndex
CREATE INDEX "PlaceClaimRequest_businessId_status_idx" ON "PlaceClaimRequest"("businessId", "status");

-- CreateIndex
CREATE INDEX "PlaceClaimRequest_status_idx" ON "PlaceClaimRequest"("status");

-- CreateIndex
CREATE INDEX "PlaceGroup_createdByUserId_idx" ON "PlaceGroup"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_ownerBusinessId_fkey" FOREIGN KEY ("ownerBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceClaimRequest" ADD CONSTRAINT "PlaceClaimRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
