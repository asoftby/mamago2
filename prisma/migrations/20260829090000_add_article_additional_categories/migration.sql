CREATE TABLE "ArticleCategoryLink" (
    "articleId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ArticleCategoryLink_pkey" PRIMARY KEY ("articleId", "categoryId")
);

CREATE UNIQUE INDEX "ArticleCategoryLink_articleId_position_key"
ON "ArticleCategoryLink"("articleId", "position");

CREATE INDEX "ArticleCategoryLink_categoryId_articleId_idx"
ON "ArticleCategoryLink"("categoryId", "articleId");

ALTER TABLE "ArticleCategoryLink"
ADD CONSTRAINT "ArticleCategoryLink_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArticleCategoryLink"
ADD CONSTRAINT "ArticleCategoryLink_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
