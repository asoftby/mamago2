-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "ageMaxMonths" INTEGER,
ADD COLUMN     "ageMinMonths" INTEGER;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "ageMaxMonths" INTEGER,
ADD COLUMN     "ageMinMonths" INTEGER;

-- CreateIndex
CREATE INDEX "Activity_ageMinMonths_ageMaxMonths_idx" ON "Activity"("ageMinMonths", "ageMaxMonths");

-- CreateIndex
CREATE INDEX "Place_ageMinMonths_ageMaxMonths_idx" ON "Place"("ageMinMonths", "ageMaxMonths");
