-- CreateEnum
CREATE TYPE "DiscoveryTaxonomyAxis" AS ENUM ('OCCASION', 'THEME', 'GENRE');

-- CreateTable
CREATE TABLE "DiscoveryTaxonomyEntry" (
    "id" TEXT NOT NULL,
    "axis" "DiscoveryTaxonomyAxis" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryTaxonomyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryTaxonomyEntry_axis_slug_key" ON "DiscoveryTaxonomyEntry"("axis", "slug");

-- CreateIndex
CREATE INDEX "DiscoveryTaxonomyEntry_axis_sortOrder_idx" ON "DiscoveryTaxonomyEntry"("axis", "sortOrder");
