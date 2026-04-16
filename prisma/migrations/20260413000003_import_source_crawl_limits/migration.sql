-- AlterTable: add crawl limit fields to ImportSource
ALTER TABLE "ImportSource"
  ADD COLUMN IF NOT EXISTS "crawlMaxPages" INTEGER,
  ADD COLUMN IF NOT EXISTS "crawlMaxDetailLinks" INTEGER,
  ADD COLUMN IF NOT EXISTS "crawlMaxRecords" INTEGER;
