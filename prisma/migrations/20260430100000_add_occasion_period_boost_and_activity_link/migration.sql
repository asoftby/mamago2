-- AlterTable: add period/boost/autoSuggest fields to Occasion
ALTER TABLE "Occasion"
  ADD COLUMN IF NOT EXISTS "startsAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endsAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "boostScore"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "autoSuggest" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex for active period queries
CREATE INDEX IF NOT EXISTS "Occasion_isActive_startsAt_endsAt_idx"
  ON "Occasion"("isActive", "startsAt", "endsAt");

-- CreateTable: ActivityOccasion join table
CREATE TABLE IF NOT EXISTS "ActivityOccasion" (
  "activityId" TEXT NOT NULL,
  "occasionId" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActivityOccasion_pkey" PRIMARY KEY ("activityId", "occasionId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityOccasion_occasionId_idx" ON "ActivityOccasion"("occasionId");
CREATE INDEX IF NOT EXISTS "ActivityOccasion_activityId_idx" ON "ActivityOccasion"("activityId");

-- AddForeignKey
ALTER TABLE "ActivityOccasion"
  ADD CONSTRAINT "ActivityOccasion_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityOccasion"
  ADD CONSTRAINT "ActivityOccasion_occasionId_fkey"
  FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
