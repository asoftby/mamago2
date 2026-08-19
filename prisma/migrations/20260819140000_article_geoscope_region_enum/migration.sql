-- Add REGION to GeoScope enum.
--
-- Split into its own migration (separate from the Article.regionId column /
-- constraint changes in the next migration) because PostgreSQL does not allow
-- a newly added enum value to be referenced by a CHECK constraint added in
-- the same transaction as the ALTER TYPE ... ADD VALUE statement.

ALTER TYPE "GeoScope" ADD VALUE IF NOT EXISTS 'REGION';
