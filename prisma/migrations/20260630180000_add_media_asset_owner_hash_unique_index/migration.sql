-- Phase E2: per-owner media dedup uniqueness, applied on clean tables (post Phase D wipe).
-- Partial unique index — nullable contentHash is allowed (rows without a hash
-- don't collide). Single per-owner index per the finalized E2 decision.

CREATE UNIQUE INDEX "MediaAsset_uploadedBy_hash_uq" ON "MediaAsset" ("uploadedById","contentHash") WHERE "contentHash" IS NOT NULL;
