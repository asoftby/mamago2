-- Add an explicit one-off reminder to any PlanItem.
ALTER TABLE "PlanItem" ADD COLUMN "reminderAt" TIMESTAMP(3);

CREATE INDEX "PlanItem_reminderAt_idx" ON "PlanItem"("reminderAt");

-- Dedicated scenario keeps manual/task reminders semantically separate from
-- the legacy automatic 2-hours-before event reminder.
ALTER TYPE "NotificationScenario" ADD VALUE IF NOT EXISTS 'PLAN_ITEM_REMINDER';
