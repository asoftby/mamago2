-- Phase 3b-1: party schema — rename ComponentCategory → PartyCategory, add OccasionType, party-filter columns on Offer

-- 1. Rename ComponentCategory → PartyCategory
--    PackageComponent.category column auto-follows (no DROP/ADD needed on the column).
ALTER TYPE "ComponentCategory" RENAME TO "PartyCategory";

-- 2. Add MASTER_CLASS (present in BirthdayRole but missing from ComponentCategory; needed for Фаза 4 backfill)
ALTER TYPE "PartyCategory" ADD VALUE 'MASTER_CLASS';

-- 3. New enum for party occasions.
--    Named PartyOccasion (not OccasionType) — existing OccasionType is reserved for discovery taxonomy (HOLIDAY/SEASON/EVENT/FAMILY).
CREATE TYPE "PartyOccasion" AS ENUM ('BIRTHDAY', 'GRADUATION');

-- 4. New nullable party-filter columns on Offer (write-path wired in Phase 3b-2; all columns start empty)
ALTER TABLE "Offer"
  ADD COLUMN "category"          "PartyCategory",
  ADD COLUMN "partyLocationType" "BirthdayLocationType",
  ADD COLUMN "minChildren"       INTEGER,
  ADD COLUMN "maxChildren"       INTEGER,
  ADD COLUMN "occasions"         "PartyOccasion"[] NOT NULL DEFAULT '{}';

-- 5. Indexes for party-filter queries
CREATE INDEX "Offer_category_idx"                ON "Offer"("category");
CREATE INDEX "Offer_minChildren_maxChildren_idx" ON "Offer"("minChildren", "maxChildren");
