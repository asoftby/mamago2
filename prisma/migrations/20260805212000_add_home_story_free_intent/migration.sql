ALTER TABLE "HomeStoryItem"
ADD COLUMN "isFree" BOOLEAN NOT NULL DEFAULT false;

UPDATE "HomeStoryItem" AS item
SET "isFree" = true,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Activity" AS activity
WHERE item."sourceType" = 'EVENT'
  AND item."sourceId" = activity."id"
  AND activity."priceFrom" = 0;

CREATE INDEX "HomeStoryItem_cityId_status_isFree_startsAt_idx"
ON "HomeStoryItem"("cityId", "status", "isFree", "startsAt");

INSERT INTO "StoryIntentConfig" ("id", "intent", "title", "enabled", "order", "itemLimit", "allowedTypes", "createdAt", "updatedAt")
VALUES ('story-intent-free', 'free', 'Бесплатно', true, 4, 10, ARRAY['events']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("intent") DO UPDATE
SET "title" = 'Бесплатно',
    "enabled" = true,
    "allowedTypes" = ARRAY['events']::TEXT[],
    "updatedAt" = CURRENT_TIMESTAMP;
