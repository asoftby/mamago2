-- CreateEnum
CREATE TYPE "SearchEntityType" AS ENUM ('activity', 'offer', 'place', 'route', 'article');

-- CreateTable
CREATE TABLE "SearchDocument" (
    "id" TEXT NOT NULL,
    "entityType" "SearchEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "metaLine" TEXT NOT NULL,
    "imageUrl" TEXT,
    "urlPath" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "boost" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchDocument_entityType_entityId_key" ON "SearchDocument"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SearchDocument_isPublished_idx" ON "SearchDocument"("isPublished");
