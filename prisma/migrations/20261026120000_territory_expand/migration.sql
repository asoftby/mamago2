-- Territory EXPAND phase (1/4: expand -> dual write -> switch read -> contract).
-- Adds Territory + TerritoryLegacyMap and nullable territoryId columns; backfills them.
-- No behaviour change: nothing reads the new columns yet. Rollback: ./down.sql.txt (manual, not run by Prisma).

-- CreateEnum
CREATE TYPE "TerritoryType" AS ENUM ('COUNTRY', 'REGION', 'CITY');

-- CreateEnum
CREATE TYPE "TerritoryLegacyKind" AS ENUM ('COUNTRY', 'REGION', 'CITY');

-- AlterTable
ALTER TABLE "RecommendationRun" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "UserEvent" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "District" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "MetroStation" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "ActivitySlugHistory" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "EventVenue" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "PlaceRevision" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "PlaceSlugHistory" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "HomeStoryItem" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "OfferSlugHistory" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "regionTerritoryId" TEXT,
ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "ArticleGeographyTarget" ADD COLUMN     "regionTerritoryId" TEXT,
ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "ArticleSlugHistory" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "EditorialRequest" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "SearchDocument" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "ImportSource" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "SearchQuickTag" ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "SeoContentPlanItem" ADD COLUMN     "regionTerritoryId" TEXT,
ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "SearchQueryLog" ADD COLUMN     "territoryId" TEXT;

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "type" "TerritoryType" NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameIn" TEXT,
    "isoCode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isVisibleInCityFilter" BOOLEAN NOT NULL DEFAULT true,
    "isLegacyNonCity" BOOLEAN NOT NULL DEFAULT false,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "radiusKm" DOUBLE PRECISION,
    "hasMetro" BOOLEAN NOT NULL DEFAULT false,
    "metroMaxDistanceM" INTEGER,
    "googlePlaceId" TEXT,
    "googleName" TEXT,
    "googleNames" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryLegacyMap" (
    "legacyKind" "TerritoryLegacyKind" NOT NULL,
    "legacyId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerritoryLegacyMap_pkey" PRIMARY KEY ("legacyKind","legacyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Territory_isoCode_key" ON "Territory"("isoCode");

-- CreateIndex
CREATE INDEX "Territory_type_slug_idx" ON "Territory"("type", "slug");

-- CreateIndex
CREATE INDEX "Territory_parentId_idx" ON "Territory"("parentId");

-- CreateIndex
CREATE INDEX "Territory_type_isActive_priority_idx" ON "Territory"("type", "isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_parentId_slug_key" ON "Territory"("parentId", "slug");

-- CreateIndex
CREATE INDEX "TerritoryLegacyMap_territoryId_idx" ON "TerritoryLegacyMap"("territoryId");

-- CreateIndex
CREATE INDEX "RecommendationRun_territoryId_idx" ON "RecommendationRun"("territoryId");

-- CreateIndex
CREATE INDEX "UserEvent_territoryId_idx" ON "UserEvent"("territoryId");

-- CreateIndex
CREATE INDEX "District_territoryId_idx" ON "District"("territoryId");

-- CreateIndex
CREATE INDEX "MetroStation_territoryId_idx" ON "MetroStation"("territoryId");

-- CreateIndex
CREATE INDEX "Activity_territoryId_idx" ON "Activity"("territoryId");

-- CreateIndex
CREATE INDEX "ActivitySlugHistory_territoryId_idx" ON "ActivitySlugHistory"("territoryId");

-- CreateIndex
CREATE INDEX "EventVenue_territoryId_idx" ON "EventVenue"("territoryId");

-- CreateIndex
CREATE INDEX "Place_territoryId_idx" ON "Place"("territoryId");

-- CreateIndex
CREATE INDEX "PlaceRevision_territoryId_idx" ON "PlaceRevision"("territoryId");

-- CreateIndex
CREATE INDEX "PlaceSlugHistory_territoryId_idx" ON "PlaceSlugHistory"("territoryId");

-- CreateIndex
CREATE INDEX "HomeStoryItem_territoryId_idx" ON "HomeStoryItem"("territoryId");

-- CreateIndex
CREATE INDEX "Offer_territoryId_idx" ON "Offer"("territoryId");

-- CreateIndex
CREATE INDEX "OfferSlugHistory_territoryId_idx" ON "OfferSlugHistory"("territoryId");

-- CreateIndex
CREATE INDEX "Route_territoryId_idx" ON "Route"("territoryId");

-- CreateIndex
CREATE INDEX "Article_territoryId_idx" ON "Article"("territoryId");

-- CreateIndex
CREATE INDEX "Article_regionTerritoryId_idx" ON "Article"("regionTerritoryId");

-- CreateIndex
CREATE INDEX "ArticleGeographyTarget_territoryId_idx" ON "ArticleGeographyTarget"("territoryId");

-- CreateIndex
CREATE INDEX "ArticleGeographyTarget_regionTerritoryId_idx" ON "ArticleGeographyTarget"("regionTerritoryId");

-- CreateIndex
CREATE INDEX "ArticleSlugHistory_territoryId_idx" ON "ArticleSlugHistory"("territoryId");

-- CreateIndex
CREATE INDEX "EditorialRequest_territoryId_idx" ON "EditorialRequest"("territoryId");

-- CreateIndex
CREATE INDEX "SearchDocument_territoryId_idx" ON "SearchDocument"("territoryId");

-- CreateIndex
CREATE INDEX "ImportSource_territoryId_idx" ON "ImportSource"("territoryId");

-- CreateIndex
CREATE INDEX "SearchQuickTag_territoryId_idx" ON "SearchQuickTag"("territoryId");

-- CreateIndex
CREATE INDEX "SeoContentPlanItem_territoryId_idx" ON "SeoContentPlanItem"("territoryId");

-- CreateIndex
CREATE INDEX "SeoContentPlanItem_regionTerritoryId_idx" ON "SeoContentPlanItem"("regionTerritoryId");

-- CreateIndex
CREATE INDEX "SearchQueryLog_territoryId_idx" ON "SearchQueryLog"("territoryId");

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryLegacyMap" ADD CONSTRAINT "TerritoryLegacyMap_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetroStation" ADD CONSTRAINT "MetroStation_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySlugHistory" ADD CONSTRAINT "ActivitySlugHistory_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceRevision" ADD CONSTRAINT "PlaceRevision_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceSlugHistory" ADD CONSTRAINT "PlaceSlugHistory_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferSlugHistory" ADD CONSTRAINT "OfferSlugHistory_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_regionTerritoryId_fkey" FOREIGN KEY ("regionTerritoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleGeographyTarget" ADD CONSTRAINT "ArticleGeographyTarget_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleGeographyTarget" ADD CONSTRAINT "ArticleGeographyTarget_regionTerritoryId_fkey" FOREIGN KEY ("regionTerritoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSlugHistory" ADD CONSTRAINT "ArticleSlugHistory_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialRequest" ADD CONSTRAINT "EditorialRequest_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchDocument" ADD CONSTRAINT "SearchDocument_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSource" ADD CONSTRAINT "ImportSource_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchQuickTag" ADD CONSTRAINT "SearchQuickTag_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentPlanItem" ADD CONSTRAINT "SeoContentPlanItem_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentPlanItem" ADD CONSTRAINT "SeoContentPlanItem_regionTerritoryId_fkey" FOREIGN KEY ("regionTerritoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchQueryLog" ADD CONSTRAINT "SearchQueryLog_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================================
-- Data migration: Country / Region / City -> Territory (+ TerritoryLegacyMap)
-- Idempotent ids: ter_country_<id>, ter_region_<centre slug> (Belarus oblasts) / ter_region_<id> (others), ter_city_<id>.
-- ============================================================================

-- Reference: the six "city + oblast" regions. Region slug = slug of the centre city.
CREATE TEMP TABLE "_territory_region_ref" (
    "centreSlug" TEXT PRIMARY KEY,
    "oblastSlug" TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "nameIn"     TEXT NOT NULL,
    "cityNameIn" TEXT NOT NULL,
    "priority"   INTEGER NOT NULL,
    "lat"        DOUBLE PRECISION NOT NULL,
    "lng"        DOUBLE PRECISION NOT NULL
);
INSERT INTO "_territory_region_ref" VALUES
    ('minsk',   'minskaya-oblast',     'Минск и область',   'в Минске и области',   'в Минске',   100, 53.9006, 27.5590),
    ('brest',   'brestskaya-oblast',   'Брест и область',   'в Бресте и области',   'в Бресте',    90, 52.0976, 23.7341),
    ('vitebsk', 'vitebskaya-oblast',   'Витебск и область', 'в Витебске и области', 'в Витебске',  90, 55.1904, 30.2049),
    ('gomel',   'gomelskaya-oblast',   'Гомель и область',  'в Гомеле и области',   'в Гомеле',    90, 52.4345, 30.9754),
    ('grodno',  'grodnenskaya-oblast', 'Гродно и область',  'в Гродно и области',   'в Гродно',    90, 53.6693, 23.8131),
    ('mogilev', 'mogilevskaya-oblast', 'Могилёв и область', 'в Могилёве и области', 'в Могилёве',  90, 53.9007, 30.3313);

-- 1. Countries
INSERT INTO "Territory" ("id","type","parentId","slug","name","isoCode","isActive","priority","createdAt","updatedAt")
SELECT 'ter_country_' || c."id", 'COUNTRY', NULL, c."slug", c."name", c."isoCode", c."isActive", c."priority", c."createdAt", CURRENT_TIMESTAMP
FROM "Country" c
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TerritoryLegacyMap" ("legacyKind","legacyId","territoryId")
SELECT 'COUNTRY', c."id", 'ter_country_' || c."id" FROM "Country" c
ON CONFLICT DO NOTHING;

-- 2a. Known oblasts -> REGION named after the centre city (parent = the oblast's country,
--     or the country of the only/first Country row when the oblast row is absent).
INSERT INTO "Territory" ("id","type","parentId","slug","name","nameIn","lat","lng","centerLat","centerLng","isActive","priority","createdAt","updatedAt")
SELECT 'ter_region_' || ref."centreSlug", 'REGION',
       COALESCE(
         (SELECT 'ter_country_' || r."countryId" FROM "Region" r WHERE r."slug" = ref."oblastSlug" AND r."countryId" = (SELECT c."id" FROM "Country" c WHERE c."slug" = 'belarus')),
         (SELECT 'ter_country_' || c."id" FROM "Country" c WHERE c."slug" = 'belarus')
       ),
       ref."centreSlug", ref."name", ref."nameIn", ref."lat", ref."lng", ref."lat", ref."lng",
       COALESCE((SELECT r."isActive" FROM "Region" r WHERE r."slug" = ref."oblastSlug" AND r."countryId" = (SELECT c."id" FROM "Country" c WHERE c."slug" = 'belarus')), true),
       ref."priority", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "_territory_region_ref" ref
WHERE EXISTS (SELECT 1 FROM "Country" c WHERE c."slug" = 'belarus')
ON CONFLICT ("id") DO NOTHING;

-- 2b. Any other legacy Region keeps its own slug; the id comes from the legacy id so the same slug
--     in different countries never collides.
INSERT INTO "Territory" ("id","type","parentId","slug","name","isActive","priority","createdAt","updatedAt")
SELECT 'ter_region_' || r."id", 'REGION', 'ter_country_' || r."countryId", r."slug", r."name", r."isActive", r."priority", r."createdAt", CURRENT_TIMESTAMP
FROM "Region" r
WHERE NOT (r."slug" IN (SELECT "oblastSlug" FROM "_territory_region_ref") AND r."countryId" = (SELECT c."id" FROM "Country" c WHERE c."slug" = 'belarus'))
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TerritoryLegacyMap" ("legacyKind","legacyId","territoryId")
SELECT 'REGION', r."id",
       COALESCE(
         (SELECT 'ter_region_' || ref."centreSlug" FROM "_territory_region_ref" ref WHERE ref."oblastSlug" = r."slug" AND r."countryId" = (SELECT c."id" FROM "Country" c WHERE c."slug" = 'belarus')),
         'ter_region_' || r."id"
       )
FROM "Region" r
ON CONFLICT DO NOTHING;

-- 3. Cities. Parent: legacy region -> centre-slug region -> country.
INSERT INTO "Territory" (
    "id","type","parentId","slug","name","nameIn","lat","lng","isActive","priority","isVisibleInCityFilter",
    "isLegacyNonCity","centerLat","centerLng","radiusKm","hasMetro","metroMaxDistanceM",
    "googlePlaceId","googleName","googleNames","createdAt","updatedAt"
)
SELECT
    'ter_city_' || c."id", 'CITY',
    COALESCE(
        (SELECT m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'REGION' AND m."legacyId" = c."regionId"),
        (SELECT 'ter_region_' || ref."centreSlug" FROM "_territory_region_ref" ref
          WHERE ref."centreSlug" = c."slug" AND EXISTS (SELECT 1 FROM "Territory" t WHERE t."id" = 'ter_region_' || ref."centreSlug")),
        'ter_country_' || c."countryId"
    ),
    c."slug", c."name",
    (SELECT ref."cityNameIn" FROM "_territory_region_ref" ref WHERE ref."centreSlug" = c."slug"),
    c."lat", c."lng", c."isActive", c."priority", c."isVisibleInCityFilter",
    c."isLegacyNonCity", c."centerLat", c."centerLng", c."radiusKm", c."hasMetro", c."metroMaxDistanceM",
    c."googlePlaceId", c."googleName", c."googleNames", c."createdAt", CURRENT_TIMESTAMP
FROM "City" c
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TerritoryLegacyMap" ("legacyKind","legacyId","territoryId")
SELECT 'CITY', c."id", 'ter_city_' || c."id" FROM "City" c
ON CONFLICT DO NOTHING;

-- 4. Cities that had no legacy region but belong to a known region (by slug).
--    Only touches cities still parented directly by a COUNTRY.
UPDATE "Territory" c
SET "parentId" = r."id"
FROM (VALUES ('kopishche', 'minsk'), ('ratomka', 'minsk'), ('mir', 'grodno')) AS fix("citySlug", "regionSlug")
JOIN "Territory" r ON r."type" = 'REGION' AND r."slug" = fix."regionSlug"
JOIN "Territory" country ON country."type" = 'COUNTRY' AND country."id" = r."parentId"
WHERE c."type" = 'CITY' AND c."slug" = fix."citySlug" AND c."parentId" = country."id";

-- Country slugs are roots (parentId NULL), which @@unique([parentId, slug]) cannot cover.
-- Partial index, not expressible in schema.prisma (same convention as other raw indexes).
CREATE UNIQUE INDEX "Territory_country_slug_key" ON "Territory"("slug") WHERE "type" = 'COUNTRY';

-- 5. Backfill territoryId / regionTerritoryId from legacy ids.
UPDATE "District" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "MetroStation" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "Activity" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "ActivitySlugHistory" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "EventVenue" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "Place" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "PlaceRevision" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "PlaceSlugHistory" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "HomeStoryItem" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "Offer" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "OfferSlugHistory" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "Route" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "Article" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "Article" t SET "regionTerritoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'REGION' AND m."legacyId" = t."regionId";
UPDATE "ArticleGeographyTarget" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "ArticleGeographyTarget" t SET "regionTerritoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'REGION' AND m."legacyId" = t."regionId";
UPDATE "ArticleSlugHistory" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "EditorialRequest" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "SearchDocument" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "ImportSource" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "SearchQuickTag" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "SeoContentPlanItem" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "SeoContentPlanItem" t SET "regionTerritoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'REGION' AND m."legacyId" = t."regionId";
UPDATE "SearchQueryLog" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "UserEvent" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";
UPDATE "RecommendationRun" t SET "territoryId" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = 'CITY' AND m."legacyId" = t."cityId";

DROP TABLE "_territory_region_ref";
