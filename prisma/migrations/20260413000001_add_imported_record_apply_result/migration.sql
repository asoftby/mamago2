-- AlterTable: add applyResult column to ImportedRecord
ALTER TABLE "ImportedRecord" ADD COLUMN IF NOT EXISTS "applyResult" JSONB;
