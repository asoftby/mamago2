-- AlterTable
ALTER TABLE "SearchDocument" ADD COLUMN     "cityId" TEXT;

-- CreateIndex
CREATE INDEX "SearchDocument_isPublished_cityId_idx" ON "SearchDocument"("isPublished", "cityId");

-- AddForeignKey
ALTER TABLE "SearchDocument" ADD CONSTRAINT "SearchDocument_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
