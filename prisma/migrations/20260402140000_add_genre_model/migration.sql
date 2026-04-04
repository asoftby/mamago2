-- Жанры привязаны к EventCategory; старые плоские записи GENRE в DiscoveryTaxonomyEntry удаляем.
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Genre_categoryId_slug_key" ON "Genre"("categoryId", "slug");
CREATE INDEX "Genre_categoryId_sortOrder_idx" ON "Genre"("categoryId", "sortOrder");
CREATE INDEX "Genre_categoryId_isActive_sortOrder_idx" ON "Genre"("categoryId", "isActive", "sortOrder");

ALTER TABLE "Genre" ADD CONSTRAINT "Genre_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "DiscoveryTaxonomyEntry" WHERE "axis" = 'GENRE';
