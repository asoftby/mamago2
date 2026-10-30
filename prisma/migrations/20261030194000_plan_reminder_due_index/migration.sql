-- Populate explicit reminder instants for pre-existing manual entries.
UPDATE "PlanItem"
SET "reminderAt" = "startsAt" - ("reminderLeadMinutes" * INTERVAL '1 minute')
WHERE "reminderAt" IS NULL
  AND "startsAt" IS NOT NULL
  AND "reminderEnabled" = TRUE
  AND "reminderLeadMinutes" IS NOT NULL
  AND "cancelledAt" IS NULL;

CREATE INDEX IF NOT EXISTS "PlanItem_reminderAt_idx" ON "PlanItem"("reminderAt");
