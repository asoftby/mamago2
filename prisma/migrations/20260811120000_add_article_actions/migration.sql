-- AlterTable
ALTER TABLE "PlanItem" ADD COLUMN "articleId" TEXT;

-- CreateTable
CREATE TABLE "ArticleIdea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanItem_articleId_idx" ON "PlanItem"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleIdea_userId_articleId_key" ON "ArticleIdea"("userId", "articleId");

-- CreateIndex
CREATE INDEX "ArticleIdea_userId_idx" ON "ArticleIdea"("userId");

-- CreateIndex
CREATE INDEX "ArticleIdea_articleId_idx" ON "ArticleIdea"("articleId");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleIdea" ADD CONSTRAINT "ArticleIdea_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleIdea" ADD CONSTRAINT "ArticleIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
