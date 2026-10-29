CREATE TABLE "CrossRegionEditorialOverride" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrossRegionEditorialOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrossRegionEditorialOverride_activityId_regionId_key" ON "CrossRegionEditorialOverride"("activityId", "regionId");
CREATE INDEX "CrossRegionEditorialOverride_regionId_expiresAt_idx" ON "CrossRegionEditorialOverride"("regionId", "expiresAt");
ALTER TABLE "CrossRegionEditorialOverride" ADD CONSTRAINT "CrossRegionEditorialOverride_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrossRegionEditorialOverride" ADD CONSTRAINT "CrossRegionEditorialOverride_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
