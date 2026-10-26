-- Territory DUAL WRITE (PR 2): keep every legacy-FK -> Territory mirror column in sync on write.
--
-- Until the read switch (PR 3) the application still writes cityId / regionId. A BEFORE trigger fills
-- territoryId / regionTerritoryId from TerritoryLegacyMap, so every writer (app code, scripts, raw SQL,
-- Prisma connect) is covered by one mechanism. If the legacy value has no mapping the mirror is left
-- untouched (never blocks a write); verify-territory-expand.ts reports such rows.
-- Dropped in the contract phase together with the legacy columns.
-- Reversible: see ./down.sql.txt (rename to .sql to run).

CREATE OR REPLACE FUNCTION "territory_sync_from_legacy"() RETURNS trigger AS $$
DECLARE
  legacy_value text;
  mapped text;
BEGIN
  -- TG_ARGV: 0 = legacy column, 1 = mirror column, 2 = legacy kind (CITY | REGION)
  legacy_value := to_jsonb(NEW) ->> TG_ARGV[0];
  IF legacy_value IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[1], NULL));
    END IF;
    RETURN NEW;
  END IF;
  SELECT m."territoryId" INTO mapped
  FROM "TerritoryLegacyMap" m
  WHERE m."legacyKind" = TG_ARGV[2]::"TerritoryLegacyKind" AND m."legacyId" = legacy_value;
  IF mapped IS NOT NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[1], mapped));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "territory_sync_District_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "District" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_MetroStation_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "MetroStation" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_Activity_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "Activity" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_ActivitySlugHistory_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "ActivitySlugHistory" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_EventVenue_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "EventVenue" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_Place_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "Place" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_PlaceRevision_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "PlaceRevision" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_PlaceSlugHistory_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "PlaceSlugHistory" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_HomeStoryItem_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "HomeStoryItem" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_Offer_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "Offer" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_OfferSlugHistory_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "OfferSlugHistory" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_Route_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "Route" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_Article_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "Article" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_Article_regionId" BEFORE INSERT OR UPDATE OF "regionId" ON "Article" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('regionId', 'regionTerritoryId', 'REGION');
CREATE TRIGGER "territory_sync_ArticleGeographyTarget_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "ArticleGeographyTarget" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_ArticleGeographyTarget_regionId" BEFORE INSERT OR UPDATE OF "regionId" ON "ArticleGeographyTarget" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('regionId', 'regionTerritoryId', 'REGION');
CREATE TRIGGER "territory_sync_ArticleSlugHistory_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "ArticleSlugHistory" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_EditorialRequest_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "EditorialRequest" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_SearchDocument_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "SearchDocument" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_ImportSource_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "ImportSource" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_SearchQuickTag_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "SearchQuickTag" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_SeoContentPlanItem_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "SeoContentPlanItem" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_SeoContentPlanItem_regionId" BEFORE INSERT OR UPDATE OF "regionId" ON "SeoContentPlanItem" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('regionId', 'regionTerritoryId', 'REGION');
CREATE TRIGGER "territory_sync_SearchQueryLog_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "SearchQueryLog" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_UserEvent_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "UserEvent" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
CREATE TRIGGER "territory_sync_RecommendationRun_cityId" BEFORE INSERT OR UPDATE OF "cityId" ON "RecommendationRun" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('cityId', 'territoryId', 'CITY');
