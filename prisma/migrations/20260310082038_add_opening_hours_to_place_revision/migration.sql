-- AlterTable
ALTER TABLE "PlaceRevision" ADD COLUMN     "openingHoursId" TEXT;

-- AddForeignKey
ALTER TABLE "PlaceRevision" ADD CONSTRAINT "PlaceRevision_openingHoursId_fkey" FOREIGN KEY ("openingHoursId") REFERENCES "OpeningHours"("id") ON DELETE SET NULL ON UPDATE CASCADE;
