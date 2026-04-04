-- CreateEnum
CREATE TYPE "OccasionType" AS ENUM ('HOLIDAY', 'SEASON', 'EVENT', 'FAMILY');

-- CreateTable
CREATE TABLE "Occasion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OccasionType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occasion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Occasion_slug_key" ON "Occasion"("slug");
CREATE INDEX "Occasion_sortOrder_idx" ON "Occasion"("sortOrder");
CREATE INDEX "Occasion_type_sortOrder_idx" ON "Occasion"("type", "sortOrder");

-- Migrate legacy DiscoveryTaxonomyEntry rows (axis OCCASION) into Occasion; default type HOLIDAY
INSERT INTO "Occasion" ("id", "name", "slug", "type", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT
    d."id",
    d."title",
    d."slug",
    'HOLIDAY'::"OccasionType",
    d."isActive",
    d."sortOrder",
    d."createdAt",
    d."updatedAt"
FROM "DiscoveryTaxonomyEntry" d
WHERE d."axis" = 'OCCASION';

DELETE FROM "DiscoveryTaxonomyEntry" WHERE "axis" = 'OCCASION';
