-- CreateTable
CREATE TABLE "BrandingConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "logoAssetId" TEXT,
    "faviconAssetId" TEXT,
    "colorPrimary" TEXT,
    "colorAccent" TEXT,
    "colorBackground" TEXT,
    "colorSurface" TEXT,
    "colorText" TEXT,
    "fontHeading" TEXT,
    "fontBody" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BrandingConfig" ADD CONSTRAINT "BrandingConfig_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandingConfig" ADD CONSTRAINT "BrandingConfig_faviconAssetId_fkey" FOREIGN KEY ("faviconAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToDiscoveryTag" ADD CONSTRAINT "_ArticleToDiscoveryTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToDiscoveryTag" ADD CONSTRAINT "_ArticleToDiscoveryTag_B_fkey" FOREIGN KEY ("B") REFERENCES "DiscoveryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

