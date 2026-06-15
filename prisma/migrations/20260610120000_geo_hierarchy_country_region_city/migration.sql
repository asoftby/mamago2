-- Geo hierarchy: Country → Region → City
-- Backfill Belarus + Minsk Oblast; deactivate legacy "Минская область" City row.

-- CreateEnum
CREATE TYPE "RegionType" AS ENUM ('REGION', 'OBLAST', 'PROVINCE', 'STATE', 'DISTRICT');

-- CreateTable Country
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isoCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable Region
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "RegionType" NOT NULL DEFAULT 'REGION',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- AlterTable City: new columns (countryId nullable during backfill)
ALTER TABLE "City" ADD COLUMN "countryId" TEXT;
ALTER TABLE "City" ADD COLUMN "regionId" TEXT;
ALTER TABLE "City" ADD COLUMN "googlePlaceId" TEXT;
ALTER TABLE "City" ADD COLUMN "createdFromGoogle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "City" ADD COLUMN "isLegacyNonCity" BOOLEAN NOT NULL DEFAULT false;

-- Seed Belarus
INSERT INTO "Country" ("id", "name", "slug", "isoCode", "isActive", "priority", "createdAt", "updatedAt")
VALUES (
    'country_belarus',
    'Беларусь',
    'belarus',
    'BY',
    true,
    100,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Seed Minsk Oblast region
INSERT INTO "Region" ("id", "countryId", "name", "slug", "type", "isActive", "priority", "createdAt", "updatedAt")
VALUES (
    'region_minskaya_oblast',
    'country_belarus',
    'Минская область',
    'minskaya-oblast',
    'OBLAST',
    true,
    100,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Attach all existing cities to Belarus
UPDATE "City" SET "countryId" = 'country_belarus' WHERE "countryId" IS NULL;

-- Marina Gorka → Minsk Oblast
UPDATE "City"
SET "regionId" = 'region_minskaya_oblast'
WHERE "slug" = 'marina-gorka';

-- Legacy: "Минская область" was incorrectly stored as City — hide, do not delete (FK safety)
UPDATE "City"
SET
    "isLegacyNonCity" = true,
    "isActive" = false,
    "isVisibleInCityFilter" = false,
    "regionId" = NULL
WHERE "slug" = 'minskaya-oblast'
   OR "name" ILIKE '%область%';

-- Minsk stays without regionId (administratively separate city in MVP)

-- countryId required
ALTER TABLE "City" ALTER COLUMN "countryId" SET NOT NULL;

-- Drop global slug unique; scope slug per country
DROP INDEX IF EXISTS "City_slug_key";

CREATE UNIQUE INDEX "City_countryId_slug_key" ON "City"("countryId", "slug");

-- Indexes
CREATE UNIQUE INDEX "Country_slug_key" ON "Country"("slug");
CREATE UNIQUE INDEX "Country_isoCode_key" ON "Country"("isoCode");
CREATE UNIQUE INDEX "Region_countryId_slug_key" ON "Region"("countryId", "slug");
CREATE INDEX "Region_countryId_idx" ON "Region"("countryId");
CREATE INDEX "City_countryId_idx" ON "City"("countryId");
CREATE INDEX "City_regionId_idx" ON "City"("regionId");
CREATE INDEX "City_isLegacyNonCity_idx" ON "City"("isLegacyNonCity");

-- Foreign keys
ALTER TABLE "Region" ADD CONSTRAINT "Region_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "City" ADD CONSTRAINT "City_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "City" ADD CONSTRAINT "City_regionId_fkey"
    FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
