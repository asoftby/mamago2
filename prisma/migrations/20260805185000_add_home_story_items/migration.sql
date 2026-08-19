CREATE TYPE "HomeStorySourceType" AS ENUM ('EVENT', 'OFFER');
CREATE TYPE "HomeStoryPlacementType" AS ENUM ('AUTO', 'FORCE_INCLUDE', 'EXCLUDE');
CREATE TYPE "HomeStoryItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "HomeStoryItem" (
  "id" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "storyDate" TIMESTAMP(3) NOT NULL,
  "sourceType" "HomeStorySourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "occurrenceKey" TEXT NOT NULL,
  "placementType" "HomeStoryPlacementType" NOT NULL,
  "status" "HomeStoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "inactiveReason" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "manualOrder" INTEGER,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "titleSnapshot" TEXT NOT NULL,
  "subtitleSnapshot" TEXT,
  "hrefSnapshot" TEXT NOT NULL,
  "coverUrlSnapshot" TEXT,
  "displayFrom" TIMESTAMP(3),
  "displayUntil" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeStoryItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomeStoryItem_cityId_sourceType_sourceId_occurrenceKey_storyDate_key" ON "HomeStoryItem"("cityId", "sourceType", "sourceId", "occurrenceKey", "storyDate");
CREATE INDEX "HomeStoryItem_cityId_storyDate_status_pinned_manualOrder_startsAt_idx" ON "HomeStoryItem"("cityId", "storyDate", "status", "pinned", "manualOrder", "startsAt");
CREATE INDEX "HomeStoryItem_sourceType_sourceId_idx" ON "HomeStoryItem"("sourceType", "sourceId");

-- One-time projection of already-published Event occurrences. This is deploy-time
-- work, not part of the public request path. Europe/Minsk is the current project
-- timezone convention used by the Stories domain.
INSERT INTO "HomeStoryItem" (
  "id", "cityId", "storyDate", "sourceType", "sourceId", "occurrenceKey",
  "placementType", "status", "startsAt", "titleSnapshot", "subtitleSnapshot",
  "hrefSnapshot", "coverUrlSnapshot", "createdAt", "updatedAt"
)
SELECT
  'home-story-event-' || s."id",
  COALESCE(a."cityId", p."cityId"),
  date_trunc('day', s."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Minsk')
    AT TIME ZONE 'Europe/Minsk' AT TIME ZONE 'UTC',
  'EVENT'::"HomeStorySourceType",
  a."id",
  'startsAt:' || to_char(s."startsAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'AUTO'::"HomeStoryPlacementType",
  'ACTIVE'::"HomeStoryItemStatus",
  s."startsAt",
  a."title",
  a."shortDesc",
  '/' || c."slug" || '/events/' || COALESCE(a."slug", a."id"),
  a."coverImageUrl",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ActivitySession" s
JOIN "Activity" a ON a."id" = s."activityId"
LEFT JOIN "Place" p ON p."id" = a."placeId"
JOIN "City" c ON c."id" = COALESCE(a."cityId", p."cityId")
WHERE a."type" = 'EVENT'
  AND a."status" = 'PUBLISHED'
  AND s."startsAt" >= CURRENT_TIMESTAMP
ON CONFLICT DO NOTHING;
