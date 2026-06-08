-- Migration: city_scoped_slugs
-- Converts global slug @unique to city-scoped @@unique([cityId, slug]).
-- Order: (1) add cityId columns, (2) backfill from parent entities, (3) drop old
-- constraints, (4) add composite unique constraints.
-- Safe because there is currently one city (Minsk), so no cross-city slug
-- collisions exist.

-- ─────────────────────────────────────────────────────────────
-- 1. ADD cityId COLUMNS (nullable)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "Offer" ADD COLUMN "cityId" TEXT;

ALTER TABLE "ActivitySlugHistory" ADD COLUMN "cityId" TEXT;

ALTER TABLE "PlaceSlugHistory" ADD COLUMN "cityId" TEXT;

ALTER TABLE "OfferSlugHistory" ADD COLUMN "cityId" TEXT;

-- ─────────────────────────────────────────────────────────────
-- 2. BACKFILL cityId
-- ─────────────────────────────────────────────────────────────

-- Offer.cityId ← place.cityId (source of truth)
UPDATE "Offer" o
SET "cityId" = p."cityId"
FROM "Place" p
WHERE o."placeId" = p."id"
  AND p."cityId" IS NOT NULL;

-- ActivitySlugHistory.cityId ← Activity.cityId
UPDATE "ActivitySlugHistory" h
SET "cityId" = a."cityId"
FROM "Activity" a
WHERE h."activityId" = a."id"
  AND a."cityId" IS NOT NULL;

-- PlaceSlugHistory.cityId ← Place.cityId
UPDATE "PlaceSlugHistory" h
SET "cityId" = p."cityId"
FROM "Place" p
WHERE h."placeId" = p."id"
  AND p."cityId" IS NOT NULL;

-- OfferSlugHistory.cityId ← Offer.cityId (now populated above)
UPDATE "OfferSlugHistory" h
SET "cityId" = o."cityId"
FROM "Offer" o
WHERE h."offerId" = o."id"
  AND o."cityId" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. DROP OLD GLOBAL @unique CONSTRAINTS
-- ─────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS "Activity_slug_key";
DROP INDEX IF EXISTS "Place_slug_key";
DROP INDEX IF EXISTS "Offer_slug_key";
DROP INDEX IF EXISTS "ActivitySlugHistory_slug_key";
DROP INDEX IF EXISTS "PlaceSlugHistory_slug_key";
DROP INDEX IF EXISTS "OfferSlugHistory_slug_key";

-- ─────────────────────────────────────────────────────────────
-- 4. ADD COMPOSITE UNIQUE CONSTRAINTS
-- ─────────────────────────────────────────────────────────────

-- PostgreSQL: UNIQUE on nullable columns — NULL values are considered distinct
-- by the standard, so (NULL, 'foo') does not conflict with (NULL, 'foo').
-- After backfill all rows have non-null cityId (Minsk), so the constraint
-- enforces true uniqueness.

CREATE UNIQUE INDEX "Activity_cityId_slug_key"
  ON "Activity"("cityId", "slug")
  WHERE "cityId" IS NOT NULL AND "slug" IS NOT NULL;

CREATE UNIQUE INDEX "Place_cityId_slug_key"
  ON "Place"("cityId", "slug")
  WHERE "cityId" IS NOT NULL AND "slug" IS NOT NULL;

CREATE UNIQUE INDEX "Offer_cityId_slug_key"
  ON "Offer"("cityId", "slug")
  WHERE "cityId" IS NOT NULL AND "slug" IS NOT NULL;

CREATE UNIQUE INDEX "ActivitySlugHistory_cityId_slug_key"
  ON "ActivitySlugHistory"("cityId", "slug")
  WHERE "cityId" IS NOT NULL AND "slug" IS NOT NULL;

CREATE UNIQUE INDEX "PlaceSlugHistory_cityId_slug_key"
  ON "PlaceSlugHistory"("cityId", "slug")
  WHERE "cityId" IS NOT NULL AND "slug" IS NOT NULL;

CREATE UNIQUE INDEX "OfferSlugHistory_cityId_slug_key"
  ON "OfferSlugHistory"("cityId", "slug")
  WHERE "cityId" IS NOT NULL AND "slug" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 5. ADD FOREIGN KEY CONSTRAINTS FOR cityId
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "Offer"
  ADD CONSTRAINT "Offer_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActivitySlugHistory"
  ADD CONSTRAINT "ActivitySlugHistory_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlaceSlugHistory"
  ADD CONSTRAINT "PlaceSlugHistory_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfferSlugHistory"
  ADD CONSTRAINT "OfferSlugHistory_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 6. ADD INDEX ON Offer.cityId
-- ─────────────────────────────────────────────────────────────

CREATE INDEX "Offer_cityId_idx" ON "Offer"("cityId");
