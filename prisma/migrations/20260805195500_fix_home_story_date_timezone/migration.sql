-- Prisma DateTime columns are PostgreSQL timestamp-without-time-zone values
-- containing UTC wall-clock values. Convert startsAt UTC -> Minsk civil date ->
-- local midnight -> UTC before storing storyDate.
UPDATE "HomeStoryItem"
SET "storyDate" =
  date_trunc('day', "startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Minsk')
    AT TIME ZONE 'Europe/Minsk' AT TIME ZONE 'UTC',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "startsAt" IS NOT NULL;
