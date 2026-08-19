-- CreateTable
CREATE TABLE "RouteStopImage" (
    "id" TEXT NOT NULL,
    "routeStopId" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteStopImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteStopImage_routeStopId_sortOrder_key" ON "RouteStopImage"("routeStopId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStopImage_routeStopId_mediaAssetId_key" ON "RouteStopImage"("routeStopId", "mediaAssetId");

-- CreateIndex
CREATE INDEX "RouteStopImage_mediaAssetId_idx" ON "RouteStopImage"("mediaAssetId");

-- AddForeignKey
ALTER TABLE "RouteStopImage" ADD CONSTRAINT "RouteStopImage_routeStopId_fkey" FOREIGN KEY ("routeStopId") REFERENCES "RouteStop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStopImage" ADD CONSTRAINT "RouteStopImage_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
