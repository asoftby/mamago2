-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill Activity.businessId: prefer Place.ownerBusinessId when linked
UPDATE "Activity" AS a
SET "businessId" = p."ownerBusinessId"
FROM "Place" AS p
WHERE a."placeId" = p.id
  AND p."ownerBusinessId" IS NOT NULL;

-- Remaining rows: MVP one Business per ownerUserId — align denormalized businessId
UPDATE "Activity" AS a
SET "businessId" = b.id
FROM "Business" AS b
WHERE a."businessId" IS NULL
  AND a."ownerUserId" = b."ownerUserId";
