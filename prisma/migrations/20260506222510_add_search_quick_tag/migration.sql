-- CreateTable
CREATE TABLE "SearchQuickTag" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB,
    "cityId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchQuickTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchQuickTag_slug_key" ON "SearchQuickTag"("slug");

-- CreateIndex
CREATE INDEX "SearchQuickTag_isActive_idx" ON "SearchQuickTag"("isActive");

-- CreateIndex
CREATE INDEX "SearchQuickTag_sortOrder_idx" ON "SearchQuickTag"("sortOrder");

-- CreateIndex
CREATE INDEX "SearchQuickTag_cityId_idx" ON "SearchQuickTag"("cityId");

-- AddForeignKey
ALTER TABLE "SearchQuickTag" ADD CONSTRAINT "SearchQuickTag_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
