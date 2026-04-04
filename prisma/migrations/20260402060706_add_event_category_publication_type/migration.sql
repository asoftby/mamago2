-- CreateEnum
CREATE TYPE "EventCategoryPublicationType" AS ENUM ('EVENT', 'PLACE', 'OFFER', 'ROUTE', 'ARTICLE');

-- AlterTable
ALTER TABLE "EventCategory" ADD COLUMN     "publicationType" "EventCategoryPublicationType" NOT NULL DEFAULT 'EVENT';

-- CreateIndex
CREATE INDEX "EventCategory_publicationType_idx" ON "EventCategory"("publicationType");

-- CreateIndex
CREATE INDEX "EventCategory_publicationType_sortOrder_idx" ON "EventCategory"("publicationType", "sortOrder");
