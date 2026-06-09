-- Migration: article_country_slug_unique
--
-- Adds partial unique indexes that prevent two COUNTRY-scope articles (cityId IS NULL)
-- from sharing the same slug, closing a DB-level gap that existed since the
-- city-scoped article migration.
--
-- Safe-guards:
--   Each index creation is preceded by a DO block that raises EXCEPTION if duplicates
--   are found, making the migration non-destructive and operator-friendly.

-- ── Article: COUNTRY slug uniqueness ─────────────────────────────────────

DO $$
DECLARE
  dup_count INT;
  dup_slugs TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(slug, ', ' ORDER BY slug)
  INTO dup_count, dup_slugs
  FROM (
    SELECT slug
    FROM "Article"
    WHERE "cityId" IS NULL AND slug IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
  ) t;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      E'Cannot add COUNTRY-slug unique index: % duplicate slug(s) found in Article WHERE cityId IS NULL.\nDuplicate slugs: %\nResolve duplicates manually (e.g. rename or delete), then re-run the migration.',
      dup_count, dup_slugs;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Article_country_slug_unique"
  ON "Article"("slug")
  WHERE "cityId" IS NULL AND "slug" IS NOT NULL;

-- ── ArticleSlugHistory: COUNTRY slug uniqueness ───────────────────────────

DO $$
DECLARE
  dup_count INT;
  dup_slugs TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(slug, ', ' ORDER BY slug)
  INTO dup_count, dup_slugs
  FROM (
    SELECT slug
    FROM "ArticleSlugHistory"
    WHERE "cityId" IS NULL AND slug IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
  ) t;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      E'Cannot add COUNTRY-slug unique index: % duplicate slug(s) found in ArticleSlugHistory WHERE cityId IS NULL.\nDuplicate slugs: %\nResolve duplicates manually, then re-run the migration.',
      dup_count, dup_slugs;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ArticleSlugHistory_country_slug_unique"
  ON "ArticleSlugHistory"("slug")
  WHERE "cityId" IS NULL AND "slug" IS NOT NULL;
