-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoH1" TEXT,
ADD COLUMN     "seoJsonLdOverride" JSONB,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgImage" TEXT,
ADD COLUMN     "seoOgTitle" TEXT,
ADD COLUMN     "seoRobots" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "slugUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RouteSlugHistory" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "slugUpdatedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "excerpt" TEXT,
    "contentJson" JSONB,
    "heroImage" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoH1" TEXT,
    "seoCanonicalUrl" TEXT,
    "seoOgTitle" TEXT,
    "seoOgDescription" TEXT,
    "seoOgImage" TEXT,
    "seoRobots" TEXT,
    "seoJsonLdOverride" JSONB,
    "publishedAt" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleSlugHistory" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteSlugHistory_slug_key" ON "RouteSlugHistory"("slug");

-- CreateIndex
CREATE INDEX "RouteSlugHistory_routeId_idx" ON "RouteSlugHistory"("routeId");

-- CreateIndex
CREATE INDEX "RouteSlugHistory_slug_idx" ON "RouteSlugHistory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_slug_idx" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "Article"("status");

-- CreateIndex
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleSlugHistory_slug_key" ON "ArticleSlugHistory"("slug");

-- CreateIndex
CREATE INDEX "ArticleSlugHistory_articleId_idx" ON "ArticleSlugHistory"("articleId");

-- CreateIndex
CREATE INDEX "ArticleSlugHistory_slug_idx" ON "ArticleSlugHistory"("slug");

-- AddForeignKey
ALTER TABLE "RouteSlugHistory" ADD CONSTRAINT "RouteSlugHistory_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSlugHistory" ADD CONSTRAINT "ArticleSlugHistory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

