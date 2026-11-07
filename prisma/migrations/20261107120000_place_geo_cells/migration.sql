-- Additive: geohash clusters for the day-scenario engine. Filled by the Prisma
-- place extension on every write and by scripts/data-migrations/backfill-place-geo-cells.ts
-- for existing rows. No index: the engine filters its in-memory pool by cell.
ALTER TABLE "Place"
  ADD COLUMN "geoCell6" VARCHAR(6),
  ADD COLUMN "geoCell5" VARCHAR(5);
