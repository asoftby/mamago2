-- CreateEnum
CREATE TYPE "AgePolicy" AS ENUM ('UNKNOWN', 'UNRESTRICTED', 'SPECIFIC', 'ADULT_ONLY');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "agePolicy" "AgePolicy" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Offer" ADD COLUMN "agePolicy" "AgePolicy" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Place" ADD COLUMN "agePolicy" "AgePolicy" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "PlaceRevision" ADD COLUMN "agePolicy" "AgePolicy" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Route" ADD COLUMN "agePolicy" "AgePolicy" NOT NULL DEFAULT 'UNKNOWN';

-- Backfill only trustworthy structured suitability. Empty/null legacy data
-- intentionally remains UNKNOWN; no text-derived UNRESTRICTED or ADULT_ONLY.
UPDATE "Activity"
SET "agePolicy" = 'SPECIFIC'
WHERE (cardinality("ageTags") > 0 AND "ageTags" <@ ARRAY['0-1','1-3','3-5','5-7','7-9','9-12','12-14','14-16','16-18','18+']::text[])
   OR (("ageMinMonths" IS NOT NULL OR "ageMaxMonths" IS NOT NULL)
       AND coalesce("ageMinMonths", 0) >= 0
       AND coalesce("ageMaxMonths", "ageMinMonths", 0) >= coalesce("ageMinMonths", 0));

UPDATE "Offer"
SET "agePolicy" = 'SPECIFIC'
WHERE ("ageMinMonths" IS NOT NULL OR "ageMaxMonths" IS NOT NULL)
  AND coalesce("ageMinMonths", 0) >= 0
  AND coalesce("ageMaxMonths", "ageMinMonths", 0) >= coalesce("ageMinMonths", 0);

UPDATE "Place"
SET "agePolicy" = 'SPECIFIC'
WHERE cardinality("ageTags") > 0
  AND "ageTags" <@ ARRAY['0-1','1-3','3-5','5-7','7-9','9-12','12-14','14-16','16-18','18+']::text[];

UPDATE "PlaceRevision"
SET "agePolicy" = 'SPECIFIC'
WHERE cardinality("ageTags") > 0
  AND "ageTags" <@ ARRAY['0-1','1-3','3-5','5-7','7-9','9-12','12-14','14-16','16-18','18+']::text[];

UPDATE "Route"
SET "agePolicy" = 'SPECIFIC'
WHERE cardinality("ageTags") > 0
  AND "ageTags" <@ ARRAY['0-1','1-3','3-5','5-7','7-9','9-12','12-14','14-16','16-18','18+']::text[];

-- Register the code-owned public filter in the existing Admin presentation
-- layer. Stable ids and NOT EXISTS keep this deterministic if a definition
-- was already created by the system seed before migration deployment.
INSERT INTO "FilterDefinition" (
  "id", "slug", "title", "type", "ui", "order", "isActive",
  "createdAt", "updatedAt", "orderIndex", "placement", "isSystem", "showTitle"
)
VALUES (
  'system_filter_adult_only', 'adult_only', 'Только 18+', 'boolean', 'switcher',
  1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, 'PRIMARY', true, false
)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "type" = EXCLUDED."type",
  "ui" = EXCLUDED."ui",
  "isActive" = true,
  "isSystem" = true,
  "showTitle" = false,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "FilterOption" (
  "id", "filterId", "label", "value", "order", "isActive", "orderIndex"
)
SELECT
  'system_filter_adult_only_true', "id", 'Только 18+', 'true', 0, true, 0
FROM "FilterDefinition"
WHERE "slug" = 'adult_only'
ON CONFLICT ("filterId", "value") DO UPDATE SET
  "label" = EXCLUDED."label",
  "isActive" = true,
  "orderIndex" = 0;

INSERT INTO "DiscoveryFilterPlacement" (
  "id", "filterId", "intent", "categoryId", "isActive", "sortOrder",
  "createdAt", "updatedAt"
)
SELECT
  'system_placement_kuda_adult_only', "id", 'kuda', NULL, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "FilterDefinition" definition
WHERE definition."slug" = 'adult_only'
  AND NOT EXISTS (
    SELECT 1
    FROM "DiscoveryFilterPlacement" placement
    WHERE placement."filterId" = definition."id"
      AND placement."intent" = 'kuda'
      AND placement."categoryId" IS NULL
  );
