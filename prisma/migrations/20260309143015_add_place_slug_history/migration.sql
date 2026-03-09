-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "slugUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlaceSlugHistory" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceSlugHistory_slug_key" ON "PlaceSlugHistory"("slug");

-- CreateIndex
CREATE INDEX "PlaceSlugHistory_placeId_idx" ON "PlaceSlugHistory"("placeId");

-- CreateIndex
CREATE INDEX "PlaceSlugHistory_slug_idx" ON "PlaceSlugHistory"("slug");

-- AddForeignKey
ALTER TABLE "PlaceSlugHistory" ADD CONSTRAINT "PlaceSlugHistory_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
