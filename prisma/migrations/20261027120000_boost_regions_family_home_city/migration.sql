-- Cross-region Boost targeting and explicitly selected family home city.
-- Empty targetRegionIds keeps the publication in its normal local geography.
-- ["*"] targets every Belarusian region; other entries are Region.id values.
ALTER TABLE "Boost" ADD COLUMN "targetRegionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Family" ADD COLUMN "homeCityId" TEXT;
CREATE INDEX "PlanItem_activityId_cancelledAt_status_familyId_idx" ON "PlanItem" ("activityId", "cancelledAt", "status", "familyId");
CREATE INDEX "Family_homeCityId_idx" ON "Family" ("homeCityId");
CREATE INDEX "Boost_targetRegionIds_gin_idx" ON "Boost" USING GIN ("targetRegionIds");
