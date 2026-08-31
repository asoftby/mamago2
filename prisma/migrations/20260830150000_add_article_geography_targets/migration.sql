CREATE TYPE "ArticleGeographyTargetType" AS ENUM ('CITY', 'REGION');

CREATE TABLE "ArticleGeographyTarget" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "type" "ArticleGeographyTargetType" NOT NULL,
    "cityId" TEXT,
    "regionId" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "ArticleGeographyTarget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArticleGeographyTarget_shape_check" CHECK (
      ("type" = 'CITY' AND "cityId" IS NOT NULL AND "regionId" IS NULL)
      OR
      ("type" = 'REGION' AND "regionId" IS NOT NULL AND "cityId" IS NULL)
    )
);

CREATE UNIQUE INDEX "ArticleGeographyTarget_articleId_position_key"
ON "ArticleGeographyTarget"("articleId", "position");
CREATE UNIQUE INDEX "ArticleGeographyTarget_article_city_key"
ON "ArticleGeographyTarget"("articleId", "cityId") WHERE "type" = 'CITY';
CREATE UNIQUE INDEX "ArticleGeographyTarget_article_region_key"
ON "ArticleGeographyTarget"("articleId", "regionId") WHERE "type" = 'REGION';
CREATE INDEX "ArticleGeographyTarget_cityId_articleId_idx"
ON "ArticleGeographyTarget"("cityId", "articleId");
CREATE INDEX "ArticleGeographyTarget_regionId_articleId_idx"
ON "ArticleGeographyTarget"("regionId", "articleId");

ALTER TABLE "ArticleGeographyTarget" ADD CONSTRAINT "ArticleGeographyTarget_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleGeographyTarget" ADD CONSTRAINT "ArticleGeographyTarget_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleGeographyTarget" ADD CONSTRAINT "ArticleGeographyTarget_regionId_fkey"
FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
