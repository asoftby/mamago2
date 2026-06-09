-- Migration: article_city_scoped
-- Adds cityId + geoScope to Article and ArticleSlugHistory,
-- drops global @unique on slug, creates partial unique indices,
-- backfills ALL existing rows to Minsk + CITY.

-- 1. Add GeoScope enum type
DO $$ BEGIN
  CREATE TYPE "GeoScope" AS ENUM ('CITY', 'COUNTRY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add cityId + geoScope to Article
ALTER TABLE "Article"
  ADD COLUMN IF NOT EXISTS "cityId" TEXT,
  ADD COLUMN IF NOT EXISTS "geoScope" "GeoScope" NOT NULL DEFAULT 'COUNTRY';

-- 3. Backfill ALL existing articles → Minsk + CITY
--    (old site was 100% Minsk; national promotion done manually later)
UPDATE "Article"
SET
  "cityId" = c.id,
  "geoScope" = 'CITY'
FROM "City" c
WHERE c.slug = 'minsk'
  AND "Article"."cityId" IS NULL;

-- 4. Drop old global unique index on Article.slug
DROP INDEX IF EXISTS "Article_slug_key";

-- 5. Create partial unique index for Article (cityId+slug, WHERE both NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "Article_cityId_slug_key"
  ON "Article"("cityId", "slug")
  WHERE "cityId" IS NOT NULL AND "slug" IS NOT NULL;

-- 6. Regular indices
CREATE INDEX IF NOT EXISTS "Article_cityId_idx"  ON "Article"("cityId");
CREATE INDEX IF NOT EXISTS "Article_geoScope_idx" ON "Article"("geoScope");

-- 7. FK: Article.cityId → City.id ON DELETE SET NULL
ALTER TABLE "Article"
  ADD CONSTRAINT "Article_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"(id) ON DELETE SET NULL
  NOT VALID;
ALTER TABLE "Article" VALIDATE CONSTRAINT "Article_cityId_fkey";

-- ────────────────────────────────────────────────────────────
-- ArticleSlugHistory
-- ────────────────────────────────────────────────────────────

-- 8. Add cityId to ArticleSlugHistory
ALTER TABLE "ArticleSlugHistory"
  ADD COLUMN IF NOT EXISTS "cityId" TEXT;

-- 9. Backfill: copy cityId from parent Article
UPDATE "ArticleSlugHistory" h
SET "cityId" = a."cityId"
FROM "Article" a
WHERE h."articleId" = a.id
  AND h."cityId" IS NULL;

-- 10. Drop old global unique index on ArticleSlugHistory.slug
DROP INDEX IF EXISTS "ArticleSlugHistory_slug_key";

-- 11. Create partial unique index (cityId+slug, WHERE both NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "ArticleSlugHistory_cityId_slug_key"
  ON "ArticleSlugHistory"("cityId", "slug")
  WHERE "cityId" IS NOT NULL AND "slug" IS NOT NULL;

-- 12. Regular index
CREATE INDEX IF NOT EXISTS "ArticleSlugHistory_cityId_idx" ON "ArticleSlugHistory"("cityId");

-- 13. FK: ArticleSlugHistory.cityId → City.id ON DELETE SET NULL
ALTER TABLE "ArticleSlugHistory"
  ADD CONSTRAINT "ArticleSlugHistory_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"(id) ON DELETE SET NULL
  NOT VALID;
ALTER TABLE "ArticleSlugHistory" VALIDATE CONSTRAINT "ArticleSlugHistory_cityId_fkey";
