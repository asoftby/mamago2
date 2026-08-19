INSERT INTO "StoryIntentConfig" ("id", "intent", "title", "enabled", "order", "itemLimit", "allowedTypes", "createdAt", "updatedAt")
VALUES
  ('story-intent-tomorrow', 'tomorrow', 'Завтра', true, 1, 5, ARRAY['events']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('story-intent-breaking-news', 'breaking_news', 'Breaking news', true, 3, 6, ARRAY['articles']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("intent") DO NOTHING;

UPDATE "StoryIntentConfig" SET "title" = 'Сегодня', "order" = 0, "allowedTypes" = ARRAY['events']::TEXT[], "updatedAt" = CURRENT_TIMESTAMP WHERE "intent" = 'today';
UPDATE "StoryIntentConfig" SET "title" = 'Завтра', "order" = 1, "allowedTypes" = ARRAY['events']::TEXT[], "updatedAt" = CURRENT_TIMESTAMP WHERE "intent" = 'tomorrow';
UPDATE "StoryIntentConfig" SET "title" = 'Выходные', "order" = 2, "allowedTypes" = ARRAY['events']::TEXT[], "updatedAt" = CURRENT_TIMESTAMP WHERE "intent" = 'weekend';
UPDATE "StoryIntentConfig" SET "title" = 'Breaking news', "order" = 3, "allowedTypes" = ARRAY['articles']::TEXT[], "updatedAt" = CURRENT_TIMESTAMP WHERE "intent" = 'breaking_news';
UPDATE "StoryIntentConfig" SET "enabled" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "intent" NOT IN ('today', 'tomorrow', 'weekend', 'breaking_news');
