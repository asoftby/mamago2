-- Add Article.regionId (REGION geo scope) and extend the geoScope/cityId
-- consistency invariant to a 4-way state machine:
--
--   DRAFT    geoScope IS NULL  AND cityId IS NULL AND regionId IS NULL
--   CITY     geoScope='CITY'    AND cityId IS NOT NULL AND regionId IS NULL
--   REGION   geoScope='REGION'  AND regionId IS NOT NULL AND cityId IS NULL
--   COUNTRY  geoScope='COUNTRY' AND cityId IS NULL AND regionId IS NULL
--
-- No existing Article/ArticleSlugHistory rows are reclassified: regionId is a
-- brand-new nullable column (all NULL on existing rows), and CITY/COUNTRY
-- rows are untouched.

ALTER TABLE "Article" ADD COLUMN "regionId" TEXT;

ALTER TABLE "Article"
  ADD CONSTRAINT "Article_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Article_regionId_idx" ON "Article"("regionId");

-- Replace the 3-way invariant with the 4-way invariant above.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'article_geoscope_city_consistency'
  ) THEN
    ALTER TABLE "Article" DROP CONSTRAINT "article_geoscope_city_consistency";
  END IF;
END $$;

ALTER TABLE "Article"
ADD CONSTRAINT article_geoscope_city_consistency
CHECK (
  ("geoScope" IS NULL AND "cityId" IS NULL AND "regionId" IS NULL)
  OR
  ("geoScope" = 'CITY' AND "cityId" IS NOT NULL AND "regionId" IS NULL)
  OR
  ("geoScope" = 'REGION' AND "regionId" IS NOT NULL AND "cityId" IS NULL)
  OR
  ("geoScope" = 'COUNTRY' AND "cityId" IS NULL AND "regionId" IS NULL)
);
