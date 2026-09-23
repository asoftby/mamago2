-- OSM import historically created a second MetroStation row named
-- "<canonical name> (OSM)" when Overpass returned the same physical station
-- as another OSM object (node/way/relation) and @@unique([cityId, name])
-- rejected the duplicate.
--
-- Merge those technical duplicates back into the canonical station before
-- removing the suffix. Preserve every reference first.

WITH duplicates AS (
  SELECT
    duplicate."id" AS duplicate_id,
    canonical."id" AS canonical_id
  FROM "MetroStation" AS duplicate
  JOIN "MetroStation" AS canonical
    ON canonical."cityId" = duplicate."cityId"
   AND canonical."name" = regexp_replace(duplicate."name", '\s*\(OSM\)\s*$', '', 'i')
   AND canonical."id" <> duplicate."id"
  WHERE duplicate."name" ~* '\s*\(OSM\)\s*$'
)
UPDATE "Place" AS place
SET "metroAutoId" = duplicates.canonical_id
FROM duplicates
WHERE place."metroAutoId" = duplicates.duplicate_id;

WITH duplicates AS (
  SELECT
    duplicate."id" AS duplicate_id,
    canonical."id" AS canonical_id
  FROM "MetroStation" AS duplicate
  JOIN "MetroStation" AS canonical
    ON canonical."cityId" = duplicate."cityId"
   AND canonical."name" = regexp_replace(duplicate."name", '\s*\(OSM\)\s*$', '', 'i')
   AND canonical."id" <> duplicate."id"
  WHERE duplicate."name" ~* '\s*\(OSM\)\s*$'
)
UPDATE "Place" AS place
SET "metroManualId" = duplicates.canonical_id
FROM duplicates
WHERE place."metroManualId" = duplicates.duplicate_id;

WITH duplicates AS (
  SELECT
    duplicate."id" AS duplicate_id,
    canonical."id" AS canonical_id
  FROM "MetroStation" AS duplicate
  JOIN "MetroStation" AS canonical
    ON canonical."cityId" = duplicate."cityId"
   AND canonical."name" = regexp_replace(duplicate."name", '\s*\(OSM\)\s*$', '', 'i')
   AND canonical."id" <> duplicate."id"
  WHERE duplicate."name" ~* '\s*\(OSM\)\s*$'
)
UPDATE "Activity" AS activity
SET "metroStationId" = duplicates.canonical_id
FROM duplicates
WHERE activity."metroStationId" = duplicates.duplicate_id;

-- PlaceRevision keeps snapshot metro ids as scalar fields (no relation), so
-- update them too to avoid stale ids after the duplicate row is removed.
WITH duplicates AS (
  SELECT
    duplicate."id" AS duplicate_id,
    canonical."id" AS canonical_id
  FROM "MetroStation" AS duplicate
  JOIN "MetroStation" AS canonical
    ON canonical."cityId" = duplicate."cityId"
   AND canonical."name" = regexp_replace(duplicate."name", '\s*\(OSM\)\s*$', '', 'i')
   AND canonical."id" <> duplicate."id"
  WHERE duplicate."name" ~* '\s*\(OSM\)\s*$'
)
UPDATE "PlaceRevision" AS revision
SET "metroAutoId" = duplicates.canonical_id
FROM duplicates
WHERE revision."metroAutoId" = duplicates.duplicate_id;

WITH duplicates AS (
  SELECT
    duplicate."id" AS duplicate_id,
    canonical."id" AS canonical_id
  FROM "MetroStation" AS duplicate
  JOIN "MetroStation" AS canonical
    ON canonical."cityId" = duplicate."cityId"
   AND canonical."name" = regexp_replace(duplicate."name", '\s*\(OSM\)\s*$', '', 'i')
   AND canonical."id" <> duplicate."id"
  WHERE duplicate."name" ~* '\s*\(OSM\)\s*$'
)
UPDATE "PlaceRevision" AS revision
SET "metroManualId" = duplicates.canonical_id
FROM duplicates
WHERE revision."metroManualId" = duplicates.duplicate_id;

WITH duplicates AS (
  SELECT
    duplicate."id" AS duplicate_id,
    canonical."id" AS canonical_id
  FROM "MetroStation" AS duplicate
  JOIN "MetroStation" AS canonical
    ON canonical."cityId" = duplicate."cityId"
   AND canonical."name" = regexp_replace(duplicate."name", '\s*\(OSM\)\s*$', '', 'i')
   AND canonical."id" <> duplicate."id"
  WHERE duplicate."name" ~* '\s*\(OSM\)\s*$'
)
DELETE FROM "MetroStation" AS duplicate
USING duplicates
WHERE duplicate."id" = duplicates.duplicate_id;

-- Defensive cleanup: if an old "(OSM)" row has no canonical partner anymore,
-- make its public name canonical now that conflicting duplicates are gone.
UPDATE "MetroStation" AS station
SET
  "name" = regexp_replace(station."name", '\s*\(OSM\)\s*$', '', 'i'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE station."name" ~* '\s*\(OSM\)\s*$'
  AND NOT EXISTS (
    SELECT 1
    FROM "MetroStation" AS other
    WHERE other."cityId" = station."cityId"
      AND other."id" <> station."id"
      AND other."name" = regexp_replace(station."name", '\s*\(OSM\)\s*$', '', 'i')
  );
