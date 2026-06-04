-- Migration: event_category_slug_scoped_by_type
-- 
-- Changes slug uniqueness from global to scoped by publicationType.
-- Before: slug is globally unique across all EventCategory rows.
-- After:  slug is unique within each publicationType (EVENT, PLACE, OFFER, ROUTE, ARTICLE).
--
-- This allows having e.g. "education" for both EVENT and PLACE categories.

-- Step 1: Drop the old global unique index on slug
DROP INDEX IF EXISTS "EventCategory_slug_key";

-- Step 2: Create the new composite unique index on (publicationType, slug)
CREATE UNIQUE INDEX "EventCategory_publicationType_slug_key"
  ON "EventCategory"("publicationType", "slug");
