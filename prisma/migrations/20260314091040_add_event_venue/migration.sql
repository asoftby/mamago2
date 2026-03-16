-- CreateEnum
CREATE TYPE "EventVenueKind" AS ENUM ('PLACE', 'MANUAL', 'MOBILE', 'TBD', 'ONLINE');

-- CreateTable
CREATE TABLE "EventVenue" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "kind" "EventVenueKind" NOT NULL,
    "placeId" TEXT,
    "title" TEXT,
    "addressLine" TEXT,
    "cityId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "note" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventVenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventVenue_activityId_key" ON "EventVenue"("activityId");

-- CreateIndex
CREATE INDEX "EventVenue_activityId_idx" ON "EventVenue"("activityId");

-- CreateIndex
CREATE INDEX "EventVenue_placeId_idx" ON "EventVenue"("placeId");

-- CreateIndex
CREATE INDEX "EventVenue_kind_idx" ON "EventVenue"("kind");

-- AddForeignKey
ALTER TABLE "EventVenue" ADD CONSTRAINT "EventVenue_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventVenue" ADD CONSTRAINT "EventVenue_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
