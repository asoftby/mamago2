-- Phase E1: per-owner media dedup key (SHA-256 of raw original bytes).
-- Nullable column + plain lookup index. The partial UNIQUE index on
-- ("uploadedById", "contentHash") WHERE "contentHash" IS NOT NULL is added
-- later, by hand, on clean data (Phase E2).

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "contentHash" TEXT;

-- CreateIndex
CREATE INDEX "MediaAsset_contentHash_idx" ON "MediaAsset"("contentHash");
