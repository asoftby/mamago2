-- Журнал: тип публикации (ARTICLE / COLLECTION / BREAKING_NEWS), featured, pinned
-- и упорядоченные связанные объекты публикации. Миграция аддитивная.
--
-- Backfill: все существующие строки получают ARTICLE (DEFAULT), КРОМЕ уже
-- существующих breaking news (маркер subtitle = '__breaking_news__',
-- src/lib/publications/breakingNewsArticle.ts) — они становятся BREAKING_NEWS,
-- чтобы тип не расходился с тем, как материал уже показывается на сайте.
-- expiresAt для них = COALESCE(expiresAt, publishedAt + 7 дней, createdAt + 7 дней).
-- URL статей не меняются (тип не участвует в маршрутах).

-- CreateEnum
CREATE TYPE "ArticlePublicationType" AS ENUM ('ARTICLE', 'COLLECTION', 'BREAKING_NEWS');

-- CreateEnum
CREATE TYPE "ArticleLinkedItemKind" AS ENUM ('EVENT', 'OFFER', 'ARTICLE');

-- AlterTable
ALTER TABLE "Article"
  ADD COLUMN "publicationType" "ArticlePublicationType" NOT NULL DEFAULT 'ARTICLE',
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing breaking news (marker in subtitle)
UPDATE "Article"
SET "publicationType" = 'BREAKING_NEWS',
    "expiresAt" = COALESCE("expiresAt", "publishedAt" + INTERVAL '7 days', "createdAt" + INTERVAL '7 days')
WHERE "subtitle" = '__breaking_news__';

-- CreateIndex
CREATE INDEX "Article_publicationType_status_publishedAt_idx" ON "Article"("publicationType", "status", "publishedAt");

-- CreateTable
CREATE TABLE "ArticleLinkedItem" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "kind" "ArticleLinkedItemKind" NOT NULL,
    "activityId" TEXT,
    "offerId" TEXT,
    "linkedArticleId" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleLinkedItem_pkey" PRIMARY KEY ("id"),
    -- Ровно один целевой FK, и он соответствует kind
    CONSTRAINT "ArticleLinkedItem_target_matches_kind" CHECK (
      ("kind" = 'EVENT'   AND "activityId" IS NOT NULL AND "offerId" IS NULL AND "linkedArticleId" IS NULL) OR
      ("kind" = 'OFFER'   AND "offerId" IS NOT NULL AND "activityId" IS NULL AND "linkedArticleId" IS NULL) OR
      ("kind" = 'ARTICLE' AND "linkedArticleId" IS NOT NULL AND "activityId" IS NULL AND "offerId" IS NULL)
    ),
    CONSTRAINT "ArticleLinkedItem_not_self" CHECK ("linkedArticleId" IS NULL OR "linkedArticleId" <> "articleId"),
    CONSTRAINT "ArticleLinkedItem_position_nonnegative" CHECK ("position" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleLinkedItem_articleId_position_key" ON "ArticleLinkedItem"("articleId", "position");
CREATE INDEX "ArticleLinkedItem_activityId_idx" ON "ArticleLinkedItem"("activityId");
CREATE INDEX "ArticleLinkedItem_offerId_idx" ON "ArticleLinkedItem"("offerId");
CREATE INDEX "ArticleLinkedItem_linkedArticleId_idx" ON "ArticleLinkedItem"("linkedArticleId");

-- Partial unique indexes (не выражаются в schema.prisma): объект входит в публикацию один раз
CREATE UNIQUE INDEX "ArticleLinkedItem_articleId_activityId_key" ON "ArticleLinkedItem"("articleId", "activityId") WHERE "activityId" IS NOT NULL;
CREATE UNIQUE INDEX "ArticleLinkedItem_articleId_offerId_key" ON "ArticleLinkedItem"("articleId", "offerId") WHERE "offerId" IS NOT NULL;
CREATE UNIQUE INDEX "ArticleLinkedItem_articleId_linkedArticleId_key" ON "ArticleLinkedItem"("articleId", "linkedArticleId") WHERE "linkedArticleId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "ArticleLinkedItem" ADD CONSTRAINT "ArticleLinkedItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleLinkedItem" ADD CONSTRAINT "ArticleLinkedItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleLinkedItem" ADD CONSTRAINT "ArticleLinkedItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleLinkedItem" ADD CONSTRAINT "ArticleLinkedItem_linkedArticleId_fkey" FOREIGN KEY ("linkedArticleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
