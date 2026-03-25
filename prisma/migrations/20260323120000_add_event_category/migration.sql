-- CreateTable
CREATE TABLE "EventCategory" (
    "id" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_slug_key" ON "EventCategory"("slug");

-- CreateIndex
CREATE INDEX "EventCategory_sortOrder_idx" ON "EventCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "EventCategory_isActive_sortOrder_idx" ON "EventCategory"("isActive", "sortOrder");

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "eventCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_eventCategoryId_idx" ON "Activity"("eventCategoryId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_eventCategoryId_fkey" FOREIGN KEY ("eventCategoryId") REFERENCES "EventCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
