-- Recurring manual plan item foundation: no data backfill or behavior changes.
CREATE TYPE "PlanRecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TABLE "PlanRecurrenceSeries" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "familyId" TEXT,
  "visibility" "PlanVisibility" NOT NULL DEFAULT 'FAMILY',
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
  "frequency" "PlanRecurrenceFrequency" NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1,
  "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "startDate" TEXT NOT NULL,
  "untilDate" TEXT,
  "maxOccurrences" INTEGER,
  "template" JSONB NOT NULL,
  "stoppedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanRecurrenceSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanRecurrenceSeries_interval_check" CHECK ("interval" BETWEEN 1 AND 365),
  CONSTRAINT "PlanRecurrenceSeries_count_check" CHECK ("maxOccurrences" IS NULL OR "maxOccurrences" BETWEEN 1 AND 10000)
);
ALTER TABLE "PlanItem" ADD COLUMN "recurrenceSeriesId" TEXT, ADD COLUMN "recurrenceDate" TEXT;
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_recurrenceSeriesId_fkey" FOREIGN KEY ("recurrenceSeriesId") REFERENCES "PlanRecurrenceSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "PlanItem_recurrenceSeriesId_recurrenceDate_key" ON "PlanItem"("recurrenceSeriesId", "recurrenceDate");
CREATE INDEX "PlanRecurrenceSeries_ownerUserId_stoppedAt_idx" ON "PlanRecurrenceSeries"("ownerUserId", "stoppedAt");
CREATE INDEX "PlanRecurrenceSeries_familyId_stoppedAt_idx" ON "PlanRecurrenceSeries"("familyId", "stoppedAt");
