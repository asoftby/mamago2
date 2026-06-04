-- AlterTable
ALTER TABLE "ImportSource" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportSource_isActive_idx" ON "ImportSource"("isActive");
