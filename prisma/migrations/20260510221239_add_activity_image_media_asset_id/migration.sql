-- AlterTable
ALTER TABLE "ActivityImage" ADD COLUMN     "mediaAssetId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_coverImageId_idx" ON "Activity"("coverImageId");

-- CreateIndex
CREATE INDEX "ActivityImage_mediaAssetId_idx" ON "ActivityImage"("mediaAssetId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityImage" ADD CONSTRAINT "ActivityImage_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
