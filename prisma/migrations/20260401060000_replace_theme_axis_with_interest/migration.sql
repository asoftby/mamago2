-- Unify semantic taxonomy axis: THEME -> INTEREST
-- Keep existing rows and only rename enum value.
ALTER TYPE "DiscoveryTaxonomyAxis" RENAME VALUE 'THEME' TO 'INTEREST';
