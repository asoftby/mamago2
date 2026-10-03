CREATE TYPE "PlanVisibility" AS ENUM ('PRIVATE', 'FAMILY');

ALTER TABLE "UserEvent"
ADD COLUMN "familyId" TEXT,
ADD COLUMN "planVisibility" "PlanVisibility";
