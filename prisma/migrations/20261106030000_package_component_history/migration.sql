ALTER TABLE "PackageComponent" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "PartyOrderItem" ADD COLUMN "packageComponentSnapshot" JSONB;

-- The current catalog cannot prove the title or price agreed in an old order.
-- Copy only the still-linked identifier and the category stored on the order.
UPDATE "PartyOrderItem" AS item
SET "packageComponentSnapshot" = jsonb_build_object(
  'id', item."packageComponentId", 'category', item."category",
  'provenance', 'LEGACY_LINK_ONLY'
)
WHERE item."packageComponentId" IS NOT NULL
  AND item."packageComponentSnapshot" IS NULL;
