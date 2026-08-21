INSERT INTO "StoryIntentConfig" ("id", "intent", "title", "enabled", "order", "itemLimit", "allowedTypes", "createdAt", "updatedAt")
VALUES
  ('story-intent-running', 'running', 'Идёт сейчас', TRUE, 1, 5, ARRAY['events']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('story-intent-lastchance', 'lastchance', 'Успеть', TRUE, 3, 5, ARRAY['offers']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("intent") DO UPDATE SET "title" = EXCLUDED."title", "order" = EXCLUDED."order", "allowedTypes" = EXCLUDED."allowedTypes", "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "StoryIntentConfig" SET "order" = 0, "updatedAt" = CURRENT_TIMESTAMP WHERE "intent" = 'today';
UPDATE "StoryIntentConfig" SET "order" = 2, "allowedTypes" = ARRAY['events', 'offers']::TEXT[], "updatedAt" = CURRENT_TIMESTAMP WHERE "intent" = 'free';
UPDATE "StoryIntentConfig" SET "order" = 4, "updatedAt" = CURRENT_TIMESTAMP WHERE "intent" = 'breaking_news';
UPDATE "StoryIntentConfig" SET "enabled" = FALSE, "updatedAt" = CURRENT_TIMESTAMP WHERE "intent" IN ('tomorrow', 'weekend', 'nextweek');
