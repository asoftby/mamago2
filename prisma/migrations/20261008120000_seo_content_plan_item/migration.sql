-- SEO Content OS: plan items for Content Plan + Topics → Plan flow
CREATE TYPE "SeoContentPlanStatus" AS ENUM ('IDEA', 'PLANNED', 'IN_PROGRESS', 'PUBLISHED');
CREATE TYPE "SeoContentPlanSource" AS ENUM ('MANUAL', 'INTERNAL_SEARCH', 'SEO_OPPORTUNITY');
CREATE TYPE "SeoContentPlanPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "SeoContentPlanItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetQuery" TEXT,
    "targetQueryKey" TEXT,
    "geoScope" "GeoScope" NOT NULL,
    "cityId" TEXT,
    "regionId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "status" "SeoContentPlanStatus" NOT NULL DEFAULT 'IDEA',
    "priority" "SeoContentPlanPriority" NOT NULL DEFAULT 'MEDIUM',
    "source" "SeoContentPlanSource" NOT NULL DEFAULT 'MANUAL',
    "sourceQuery" TEXT,
    "articleId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoContentPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SeoContentPlanItem_geoScope_idx" ON "SeoContentPlanItem"("geoScope");
CREATE INDEX "SeoContentPlanItem_cityId_idx" ON "SeoContentPlanItem"("cityId");
CREATE INDEX "SeoContentPlanItem_regionId_idx" ON "SeoContentPlanItem"("regionId");
CREATE INDEX "SeoContentPlanItem_scheduledFor_idx" ON "SeoContentPlanItem"("scheduledFor");
CREATE INDEX "SeoContentPlanItem_status_idx" ON "SeoContentPlanItem"("status");
CREATE INDEX "SeoContentPlanItem_targetQuery_idx" ON "SeoContentPlanItem"("targetQuery");
CREATE INDEX "SeoContentPlanItem_targetQueryKey_idx" ON "SeoContentPlanItem"("targetQueryKey");
CREATE INDEX "SeoContentPlanItem_status_scheduledFor_idx" ON "SeoContentPlanItem"("status", "scheduledFor");
CREATE INDEX "SeoContentPlanItem_cityId_status_scheduledFor_idx" ON "SeoContentPlanItem"("cityId", "status", "scheduledFor");
CREATE INDEX "SeoContentPlanItem_regionId_status_scheduledFor_idx" ON "SeoContentPlanItem"("regionId", "status", "scheduledFor");
CREATE INDEX "SeoContentPlanItem_createdByUserId_idx" ON "SeoContentPlanItem"("createdByUserId");
CREATE INDEX "SeoContentPlanItem_articleId_idx" ON "SeoContentPlanItem"("articleId");

-- Prevent duplicate active plan items for same normalized query + geo
CREATE UNIQUE INDEX "SeoContentPlanItem_active_query_geo_uidx"
ON "SeoContentPlanItem" (
  "targetQueryKey",
  "geoScope",
  (COALESCE("cityId", '')),
  (COALESCE("regionId", ''))
)
WHERE "status" IN ('IDEA', 'PLANNED', 'IN_PROGRESS') AND "targetQueryKey" IS NOT NULL;

ALTER TABLE "SeoContentPlanItem" ADD CONSTRAINT "SeoContentPlanItem_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentPlanItem" ADD CONSTRAINT "SeoContentPlanItem_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentPlanItem" ADD CONSTRAINT "SeoContentPlanItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentPlanItem" ADD CONSTRAINT "SeoContentPlanItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
