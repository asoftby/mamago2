ALTER TABLE "PackageComponent" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "PartyOrderItem" ADD COLUMN "packageComponentSnapshot" JSONB;

-- Preserve the currently linked record before any subsequent edit. Legacy
-- category-only orders already have their own INCLUDED rows and no link.
UPDATE "PartyOrderItem" AS item
SET "packageComponentSnapshot" = jsonb_build_object(
  'id', component."id", 'title', component."title",
  'category', item."category", 'refOfferId', component."refOfferId",
  'isOptional', component."isOptional",
  'priceSnapshot', component."priceSnapshot"::text,
  'priceDelta', component."priceDelta"::text
)
FROM "PackageComponent" AS component
WHERE item."packageComponentId" = component."id";
