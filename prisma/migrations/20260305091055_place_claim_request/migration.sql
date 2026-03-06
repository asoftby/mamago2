-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "ageTags" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PlaceClaimRequest" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceClaimRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaceClaimRequest_placeId_status_idx" ON "PlaceClaimRequest"("placeId", "status");

-- CreateIndex
CREATE INDEX "PlaceClaimRequest_userId_createdAt_idx" ON "PlaceClaimRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PlaceClaimRequest_status_idx" ON "PlaceClaimRequest"("status");

-- AddForeignKey
ALTER TABLE "PlaceClaimRequest" ADD CONSTRAINT "PlaceClaimRequest_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceClaimRequest" ADD CONSTRAINT "PlaceClaimRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceClaimRequest" ADD CONSTRAINT "PlaceClaimRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
