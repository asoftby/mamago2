ALTER TABLE "PartyOrderItem"
  ADD COLUMN "packageComponentChange" JSONB,
  ADD COLUMN "packageComponentChangeHistory" JSONB,
  ADD COLUMN "draftPriceModeSnapshot" TEXT;
