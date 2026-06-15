-- CreateTable DiscoveryTag
CREATE TABLE "DiscoveryTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable _ArticleDiscoveryTag (implicit many-to-many join table)
CREATE TABLE "_ArticleDiscoveryTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleDiscoveryTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex on DiscoveryTag.slug
CREATE UNIQUE INDEX "DiscoveryTag_slug_key" ON "DiscoveryTag"("slug");

-- CreateIndex for DiscoveryTag filtering
CREATE INDEX "DiscoveryTag_slug_idx" ON "DiscoveryTag"("slug");
CREATE INDEX "DiscoveryTag_isActive_sortOrder_idx" ON "DiscoveryTag"("isActive", "sortOrder");

-- CreateIndex on _ArticleDiscoveryTag join table
CREATE INDEX "_ArticleDiscoveryTag_B_index" ON "_ArticleDiscoveryTag"("B");

-- AddForeignKey for _ArticleDiscoveryTag
ALTER TABLE "_ArticleDiscoveryTag" ADD CONSTRAINT "_ArticleDiscoveryTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ArticleDiscoveryTag" ADD CONSTRAINT "_ArticleDiscoveryTag_B_fkey" FOREIGN KEY ("B") REFERENCES "DiscoveryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
