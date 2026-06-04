-- Migration: place_subcategories
-- Adds primaryCategoryId to Place and creates PlaceSubcategory join table.
-- The legacy `category` string field is kept for backward compatibility.

-- Add primaryCategoryId to Place
ALTER TABLE "Place" ADD COLUMN "primaryCategoryId" TEXT;

-- Add index on primaryCategoryId
CREATE INDEX "Place_primaryCategoryId_idx" ON "Place"("primaryCategoryId");

-- Add foreign key constraint
ALTER TABLE "Place"
  ADD CONSTRAINT "Place_primaryCategoryId_fkey"
  FOREIGN KEY ("primaryCategoryId")
  REFERENCES "EventCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Create PlaceSubcategory join table
CREATE TABLE "PlaceSubcategory" (
  "placeId"    TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "position"   INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "PlaceSubcategory_pkey" PRIMARY KEY ("placeId", "categoryId")
);

-- Indexes
CREATE INDEX "PlaceSubcategory_placeId_position_idx" ON "PlaceSubcategory"("placeId", "position");
CREATE INDEX "PlaceSubcategory_categoryId_idx" ON "PlaceSubcategory"("categoryId");

-- Foreign keys
ALTER TABLE "PlaceSubcategory"
  ADD CONSTRAINT "PlaceSubcategory_placeId_fkey"
  FOREIGN KEY ("placeId")
  REFERENCES "Place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaceSubcategory"
  ADD CONSTRAINT "PlaceSubcategory_categoryId_fkey"
  FOREIGN KEY ("categoryId")
  REFERENCES "EventCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
