/*
  Warnings:

  - You are about to drop the `MetroStation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "District" DROP CONSTRAINT "District_cityId_fkey";

-- DropForeignKey
ALTER TABLE "MetroStation" DROP CONSTRAINT "MetroStation_cityId_fkey";

-- DropTable
DROP TABLE "MetroStation";

-- CreateIndex
CREATE INDEX "City_slug_idx" ON "City"("slug");

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
