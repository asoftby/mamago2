-- Additive: the day scenario's saved day (BACKLOG-230, PR 3a). Nothing is rewritten or backfilled:
-- every existing PlanItem keeps scenarioId/timeType NULL and pinned false, every existing DayScenario
-- keeps groupId/source/legsJson NULL.
CREATE TYPE "PlanItemTimeType" AS ENUM ('CONFIRMED', 'SUGGESTED');

ALTER TABLE "DayScenario"
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "legsJson" JSONB;

ALTER TABLE "PlanItem"
  ADD COLUMN "scenarioId" TEXT,
  ADD COLUMN "timeType" "PlanItemTimeType",
  ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "DayScenario_groupId_idx" ON "DayScenario"("groupId");
CREATE INDEX "PlanItem_scenarioId_idx" ON "PlanItem"("scenarioId");

ALTER TABLE "PlanItem"
  ADD CONSTRAINT "PlanItem_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DayScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
