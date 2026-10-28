-- Optional exact-time reminder; existing notifications remain unchanged.
ALTER TABLE "PlanItem" ADD COLUMN "reminderAt" TIMESTAMP(3);
CREATE INDEX "PlanItem_reminderAt_idx" ON "PlanItem"("reminderAt");
