-- CreateEnum
CREATE TYPE "PublicationType" AS ENUM ('EVENT', 'OFFER', 'PLACE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('NEW', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('REQUEST_ONLY', 'USE_PUBLICATION_DATES', 'USE_PUBLICATION_SLOTS');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "bookingCapacityPerSlot" INTEGER,
ADD COLUMN     "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingMode" "BookingMode",
ADD COLUMN     "bookingNote" TEXT,
ADD COLUMN     "bookingPhone" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingMode" "BookingMode",
ADD COLUMN     "bookingNote" TEXT,
ADD COLUMN     "bookingPhone" TEXT;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingNote" TEXT,
ADD COLUMN     "bookingPhone" TEXT;

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "publicationType" "PublicationType" NOT NULL,
    "activityId" TEXT,
    "offerId" TEXT,
    "placeId" TEXT,
    "selectedSessionId" TEXT,
    "requestedDate" TIMESTAMP(3),
    "requestedTime" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerComment" TEXT,
    "adultsCount" INTEGER NOT NULL DEFAULT 1,
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "status" "BookingStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingRequest_businessId_idx" ON "BookingRequest"("businessId");

-- CreateIndex
CREATE INDEX "BookingRequest_userId_idx" ON "BookingRequest"("userId");

-- CreateIndex
CREATE INDEX "BookingRequest_activityId_idx" ON "BookingRequest"("activityId");

-- CreateIndex
CREATE INDEX "BookingRequest_offerId_idx" ON "BookingRequest"("offerId");

-- CreateIndex
CREATE INDEX "BookingRequest_placeId_idx" ON "BookingRequest"("placeId");

-- CreateIndex
CREATE INDEX "BookingRequest_selectedSessionId_idx" ON "BookingRequest"("selectedSessionId");

-- CreateIndex
CREATE INDEX "BookingRequest_status_idx" ON "BookingRequest"("status");

-- CreateIndex
CREATE INDEX "BookingRequest_requestedDate_idx" ON "BookingRequest"("requestedDate");

-- CreateIndex
CREATE INDEX "BookingRequest_createdAt_idx" ON "BookingRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_selectedSessionId_fkey" FOREIGN KEY ("selectedSessionId") REFERENCES "ActivitySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
