-- Offer.interestSlugs: child interests (up to 5, slugs from SYSTEM_INTERESTS). Additive, default empty.
ALTER TABLE "Offer" ADD COLUMN "interestSlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
