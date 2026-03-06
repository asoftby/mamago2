-- AlterTable
ALTER TABLE "City" ADD COLUMN     "centerLat" DOUBLE PRECISION,
ADD COLUMN     "centerLng" DOUBLE PRECISION,
ADD COLUMN     "googleName" TEXT,
ADD COLUMN     "googleNames" JSONB,
ADD COLUMN     "hasMetro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metroMaxDistanceM" INTEGER;

-- CreateIndex
CREATE INDEX "City_googleName_idx" ON "City"("googleName");
