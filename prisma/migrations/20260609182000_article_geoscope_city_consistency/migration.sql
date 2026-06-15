-- Enforce Article.geoScope ↔ cityId invariant at DB level.
-- Pre-flight: fail on COUNTRY rows with cityId (needs manual review).
-- CITY rows with NULL cityId are backfilled from Minsk (safe interim; all legacy articles were Minsk).

DO $$
DECLARE
  bad_country INTEGER;
  bad_city INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_country
  FROM "Article"
  WHERE "geoScope" = 'COUNTRY' AND "cityId" IS NOT NULL;

  IF bad_country > 0 THEN
    RAISE EXCEPTION
      'article_geoscope_city_consistency: % COUNTRY article(s) have cityId set — fix manually before applying constraint',
      bad_country;
  END IF;

  SELECT COUNT(*) INTO bad_city
  FROM "Article"
  WHERE "geoScope" = 'CITY' AND "cityId" IS NULL;

  IF bad_city > 0 THEN
    UPDATE "Article"
    SET "cityId" = (SELECT id FROM "City" WHERE slug = 'minsk' LIMIT 1)
    WHERE "geoScope" = 'CITY' AND "cityId" IS NULL;
  END IF;
END $$;

-- Drafts may have geoScope unset (NULL); publish flow requires explicit choice in app layer.
ALTER TABLE "Article" ALTER COLUMN "geoScope" DROP DEFAULT;
ALTER TABLE "Article" ALTER COLUMN "geoScope" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'article_geoscope_city_consistency'
  ) THEN
    ALTER TABLE "Article"
    ADD CONSTRAINT article_geoscope_city_consistency
    CHECK (
      ("geoScope" IS NULL AND "cityId" IS NULL)
      OR
      ("geoScope" = 'CITY' AND "cityId" IS NOT NULL)
      OR
      ("geoScope" = 'COUNTRY' AND "cityId" IS NULL)
    );
  END IF;
END $$;
