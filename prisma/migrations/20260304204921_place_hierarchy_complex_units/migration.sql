-- CreateEnum
CREATE TYPE "PlaceKind" AS ENUM ('STANDALONE', 'COMPLEX', 'UNIT');

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "floor" TEXT,
ADD COLUMN     "parentPlaceId" TEXT,
ADD COLUMN     "placeKind" "PlaceKind" NOT NULL DEFAULT 'STANDALONE',
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "unitLabel" TEXT;

-- CreateIndex
CREATE INDEX "Place_parentPlaceId_idx" ON "Place"("parentPlaceId");

-- CreateIndex
CREATE INDEX "Place_placeKind_idx" ON "Place"("placeKind");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_parentPlaceId_fkey" FOREIGN KEY ("parentPlaceId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
