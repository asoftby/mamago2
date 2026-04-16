-- AlterTable: add archivedAt to ImportSource for soft delete
ALTER TABLE "ImportSource" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportSource_archivedAt_idx" ON "ImportSource"("archivedAt");
