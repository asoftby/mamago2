-- Extend the existing ranking Boost for one free Business publication boost
-- per Europe/Minsk calendar day. Existing paid Offer boosts remain valid.
ALTER TABLE "Boost"
  ALTER COLUMN "offerId" DROP NOT NULL,
  ADD COLUMN "activityId" TEXT,
  ADD COLUMN "businessId" TEXT,
  ADD COLUMN "isFreeDaily" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "freeDailyDateKey" TEXT;

UPDATE "Boost" AS boost
SET "businessId" = place."ownerBusinessId"
FROM "Offer" AS offer
JOIN "Place" AS place ON place."id" = offer."placeId"
WHERE boost."offerId" = offer."id"
  AND boost."businessId" IS NULL;

CREATE INDEX "Boost_activityId_idx" ON "Boost"("activityId");
CREATE INDEX "Boost_businessId_createdAt_idx" ON "Boost"("businessId", "createdAt");
CREATE UNIQUE INDEX "Boost_businessId_freeDailyDateKey_key"
  ON "Boost"("businessId", "freeDailyDateKey");

ALTER TABLE "Boost"
  ADD CONSTRAINT "Boost_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Boost_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Boost_single_publication_target_check"
  CHECK (("offerId" IS NOT NULL)::int + ("activityId" IS NOT NULL)::int = 1),
  ADD CONSTRAINT "Boost_free_daily_metadata_check"
  CHECK (
    ("isFreeDaily" = false AND "freeDailyDateKey" IS NULL)
    OR
    ("isFreeDaily" = true AND "freeDailyDateKey" IS NOT NULL AND "businessId" IS NOT NULL)
  );
