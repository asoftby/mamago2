-- CreateEnum
CREATE TYPE "SearchIndexEntityType" AS ENUM ('EVENT', 'PLACE', 'OFFER', 'ROUTE', 'ARTICLE');

-- CreateEnum
CREATE TYPE "SearchIndexStatus" AS ENUM ('INDEXED', 'PENDING', 'FAILED', 'EXCLUDED');

-- CreateTable
CREATE TABLE "SearchIndexRecord" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" "SearchIndexEntityType" NOT NULL,
    "status" "SearchIndexStatus" NOT NULL DEFAULT 'PENDING',
    "searchable" BOOLEAN NOT NULL DEFAULT true,
    "indexedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchIndexRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchIndexRecord_entityType_idx" ON "SearchIndexRecord"("entityType");

-- CreateIndex
CREATE INDEX "SearchIndexRecord_status_idx" ON "SearchIndexRecord"("status");

-- CreateIndex
CREATE INDEX "SearchIndexRecord_searchable_idx" ON "SearchIndexRecord"("searchable");

-- CreateIndex
CREATE INDEX "SearchIndexRecord_indexedAt_idx" ON "SearchIndexRecord"("indexedAt");

-- CreateIndex
CREATE INDEX "SearchIndexRecord_entityType_status_idx" ON "SearchIndexRecord"("entityType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIndexRecord_entityId_entityType_key" ON "SearchIndexRecord"("entityId", "entityType");
