-- Idempotent safety backfill: ArticleSlugHistory.cityId from parent Article.
-- Primary backfill lives in 20260609180000_article_city_scoped; this catches
-- any rows still NULL (e.g. history rows created before cityId was set).

UPDATE "ArticleSlugHistory"
SET "cityId" = (
  SELECT "Article"."cityId"
  FROM "Article"
  WHERE "Article"."id" = "ArticleSlugHistory"."articleId"
)
WHERE "cityId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "Article"
    WHERE "Article"."id" = "ArticleSlugHistory"."articleId"
      AND "Article"."cityId" IS NOT NULL
  );
