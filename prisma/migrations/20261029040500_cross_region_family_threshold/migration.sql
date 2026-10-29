ALTER TABLE "Region" ADD COLUMN "crossRegionFamilyThreshold" INTEGER;

ALTER TABLE "Region" ADD CONSTRAINT "Region_crossRegionFamilyThreshold_check"
  CHECK ("crossRegionFamilyThreshold" IS NULL OR "crossRegionFamilyThreshold" BETWEEN 1 AND 1000000);
