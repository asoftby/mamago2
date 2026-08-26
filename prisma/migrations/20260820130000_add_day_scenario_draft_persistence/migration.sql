-- AlterTable
ALTER TABLE "DayScenario"
ADD COLUMN "acceptedConflictKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "lastSaveIdempotencyKey" TEXT,
ADD COLUMN "lastSaveRequestHash" JSONB,
ADD COLUMN "lastSaveResponse" JSONB;
