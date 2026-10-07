-- My Plan: universal user notes metadata
ALTER TABLE "PlanItem"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "reminderEnabled" BOOLEAN;
