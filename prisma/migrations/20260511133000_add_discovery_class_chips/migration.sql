-- CreateTable
CREATE TABLE "DiscoveryClassChip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "entityType" TEXT NOT NULL DEFAULT 'OFFER',
    "surfaceKey" TEXT NOT NULL DEFAULT 'CLASSES',
    "signalDefinitionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryClassChip_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Offer"
ADD COLUMN "classChipSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryClassChip_slug_key" ON "DiscoveryClassChip"("slug");

-- CreateIndex
CREATE INDEX "DiscoveryClassChip_surfaceKey_isActive_sortOrder_idx"
ON "DiscoveryClassChip"("surfaceKey", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "DiscoveryClassChip_signalDefinitionId_idx"
ON "DiscoveryClassChip"("signalDefinitionId");

-- Backfill camp offers into camps chip so existing published camps appear under ?chip=camps.
UPDATE "Offer"
SET "classChipSlugs" = array_append(COALESCE("classChipSlugs", ARRAY[]::TEXT[]), 'camps')
WHERE "campProgramType" IS NOT NULL
  AND NOT ('camps' = ANY(COALESCE("classChipSlugs", ARRAY[]::TEXT[])));
