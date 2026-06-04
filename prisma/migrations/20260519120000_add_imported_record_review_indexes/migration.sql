-- Add indexes for Admin Import page query patterns (Phase 6G-1)

-- Linked-record count: WHERE "publishedPlaceId" IS NOT NULL OR "publishedActivityId" IS NOT NULL
CREATE INDEX IF NOT EXISTS "ImportedRecord_publishedPlaceId_idx" ON "public"."ImportedRecord" ("publishedPlaceId");
CREATE INDEX IF NOT EXISTS "ImportedRecord_publishedActivityId_idx" ON "public"."ImportedRecord" ("publishedActivityId");

-- Per-run pending-review groupBy: WHERE "runId" IN (...) AND "reviewStatus" = 'PENDING'
-- Supersedes the single-column "ImportedRecord_runId_idx" for this query pattern.
CREATE INDEX IF NOT EXISTS "ImportedRecord_runId_reviewStatus_idx" ON "public"."ImportedRecord" ("runId", "reviewStatus");
