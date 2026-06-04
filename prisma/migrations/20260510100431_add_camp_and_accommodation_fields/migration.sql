/*
  Warnings:

  - The `galleryImages` column on the `Offer` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropIndex
DROP INDEX "SeoLlmsTxt_updatedAt_idx";

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "accommodationConditions" TEXT,
ADD COLUMN     "accommodationProvided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "accommodationType" TEXT,
ADD COLUMN     "campCanSelectDays" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "campDaySchedule" TEXT,
ADD COLUMN     "campGroupSize" INTEGER,
ADD COLUMN     "campHasExtendedCare" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "campPlacesCount" INTEGER,
ADD COLUMN     "campSessionDuration" TEXT,
ADD COLUMN     "campSessions" JSONB,
ADD COLUMN     "campStayDuration" TEXT,
ADD COLUMN     "mealInfo" TEXT,
ADD COLUMN     "transferInfo" TEXT,
ADD COLUMN     "whatToBring" TEXT,
DROP COLUMN "galleryImages",
ADD COLUMN     "galleryImages" JSONB DEFAULT '[]';

-- CreateIndex
CREATE INDEX "SeoLlmsTxt_citySlug_idx" ON "SeoLlmsTxt"("citySlug");
