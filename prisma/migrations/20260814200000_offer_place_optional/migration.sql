-- Offer.placeId becomes nullable: DRAFT Offers may temporarily exist without
-- a Place (e.g. legacy Phoenix imports with no resolvable Place relation).
-- PENDING/PUBLISHED still require a Place, enforced in application code.
-- No existing rows change: all current Offers already have a non-null
-- placeId. The FK constraint and its ON DELETE CASCADE behavior are
-- untouched.

ALTER TABLE "Offer" ALTER COLUMN "placeId" DROP NOT NULL;
