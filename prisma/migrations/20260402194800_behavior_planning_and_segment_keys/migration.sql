-- Split legacy `segments` JSON into planningBuckets + segmentKeys.

ALTER TABLE "UserBehaviorProfile" ADD COLUMN "planningBuckets" JSONB;
ALTER TABLE "UserBehaviorProfile" ADD COLUMN "segmentKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "UserBehaviorProfile"
SET "planningBuckets" = (segments::jsonb->'planningBuckets')
WHERE segments IS NOT NULL
  AND jsonb_typeof(segments::jsonb) = 'object'
  AND (segments::jsonb ? 'planningBuckets');

UPDATE "UserBehaviorProfile"
SET "segmentKeys" = (
  SELECT COALESCE(array_agg(elem ORDER BY ord), ARRAY[]::TEXT[])
  FROM jsonb_array_elements_text(segments::jsonb) WITH ORDINALITY AS t(elem, ord)
)
WHERE segments IS NOT NULL
  AND jsonb_typeof(segments::jsonb) = 'array';

ALTER TABLE "UserBehaviorProfile" DROP COLUMN "segments";

CREATE INDEX "UserBehaviorProfile_segmentKeys_gin_idx"
  ON "UserBehaviorProfile" USING GIN ("segmentKeys");
