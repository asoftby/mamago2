ALTER TABLE "City"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isVisibleInCityFilter" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "City_isActive_isVisibleInCityFilter_priority_idx"
ON "City"("isActive", "isVisibleInCityFilter", "priority");
