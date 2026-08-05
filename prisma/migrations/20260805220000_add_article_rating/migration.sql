-- CreateTable
CREATE TABLE "ArticleRating" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "ratingType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleRating_articleId_idx" ON "ArticleRating"("articleId");

-- CreateIndex
CREATE INDEX "ArticleRating_articleId_ratingType_idx" ON "ArticleRating"("articleId", "ratingType");

-- CreateIndex
CREATE INDEX "ArticleRating_identifier_idx" ON "ArticleRating"("identifier");

-- CreateIndex
CREATE INDEX "ArticleRating_userId_idx" ON "ArticleRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleRating_articleId_identifier_key" ON "ArticleRating"("articleId", "identifier");

-- AddForeignKey
ALTER TABLE "ArticleRating" ADD CONSTRAINT "ArticleRating_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRating" ADD CONSTRAINT "ArticleRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
