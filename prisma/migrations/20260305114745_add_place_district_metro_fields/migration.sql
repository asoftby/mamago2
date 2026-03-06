-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "districtAutoId" TEXT,
ADD COLUMN     "districtManualId" TEXT,
ADD COLUMN     "metroAutoId" TEXT,
ADD COLUMN     "metroManualId" TEXT;

-- CreateIndex
CREATE INDEX "Place_districtAutoId_idx" ON "Place"("districtAutoId");

-- CreateIndex
CREATE INDEX "Place_districtManualId_idx" ON "Place"("districtManualId");

-- CreateIndex
CREATE INDEX "Place_metroAutoId_idx" ON "Place"("metroAutoId");

-- CreateIndex
CREATE INDEX "Place_metroManualId_idx" ON "Place"("metroManualId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_districtAutoId_fkey" FOREIGN KEY ("districtAutoId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_districtManualId_fkey" FOREIGN KEY ("districtManualId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_metroAutoId_fkey" FOREIGN KEY ("metroAutoId") REFERENCES "MetroStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_metroManualId_fkey" FOREIGN KEY ("metroManualId") REFERENCES "MetroStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
