-- Territory REVERSE SYNC (PR 3a): territoryId / regionTerritoryId -> cityId / regionId.
--
-- PR 3 switches reads (and, from PR 3b, writes) to Territory. Until the contract phase (PR 6) the legacy
-- columns must stay correct so that PR 3 can be rolled back by redeploying the previous image. A BEFORE
-- trigger derives the legacy value from TerritoryLegacyMap whenever a writer sets only the Territory column.
--
-- Conflict rules with territory_sync_from_legacy (PR 2): if the same statement also changes the legacy
-- column (or an INSERT provides it), the legacy value wins and the forward trigger rebuilds the mirror.
-- Unmapped Territory (REGION/COUNTRY for a city column, or a city without a legacy row): the legacy column
-- becomes NULL ("no legacy city"); columns that are NOT NULL (District, MetroStation, HomeStoryItem)
-- raise instead, so a writer can never silently diverge from the legacy schema.
-- Dropped in the contract phase together with the legacy columns.
-- Reversible: see ./down.sql.txt (rename to .sql to run); data already written needs no undo.

CREATE OR REPLACE FUNCTION "territory_sync_to_legacy"() RETURNS trigger AS $$
DECLARE
  mirror_value text;
  legacy_value text;
  mapped text;
BEGIN
  -- TG_ARGV: 0 = legacy column, 1 = mirror column, 2 = legacy kind (CITY | REGION), 3 = required | nullable
  mirror_value := to_jsonb(NEW) ->> TG_ARGV[1];
  legacy_value := to_jsonb(NEW) ->> TG_ARGV[0];
  IF TG_OP = 'UPDATE' THEN
    IF mirror_value IS NOT DISTINCT FROM (to_jsonb(OLD) ->> TG_ARGV[1]) THEN
      RETURN NEW; -- Territory column not changed
    END IF;
    IF legacy_value IS DISTINCT FROM (to_jsonb(OLD) ->> TG_ARGV[0]) THEN
      RETURN NEW; -- legacy column changed in the same statement: legacy wins, forward trigger rebuilds mirror
    END IF;
  ELSIF legacy_value IS NOT NULL THEN
    RETURN NEW; -- INSERT with an explicit legacy value: legacy wins
  END IF;
  IF mirror_value IS NULL THEN
    IF TG_ARGV[3] = 'required' THEN
      RAISE EXCEPTION '%.% is required: cannot clear % (legacy column %)', TG_TABLE_NAME, TG_ARGV[0], TG_ARGV[1], TG_ARGV[0];
    END IF;
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], NULL));
    RETURN NEW;
  END IF;
  SELECT m."legacyId" INTO mapped
  FROM "TerritoryLegacyMap" m
  WHERE m."legacyKind" = TG_ARGV[2]::"TerritoryLegacyKind" AND m."territoryId" = mirror_value
  ORDER BY m."legacyId"
  LIMIT 1;
  IF mapped IS NULL AND TG_ARGV[3] = 'required' THEN
    RAISE EXCEPTION '%.%: territory % has no legacy % row', TG_TABLE_NAME, TG_ARGV[0], mirror_value, TG_ARGV[2];
  END IF;
  NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], mapped));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "territory_reverse_District_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "District" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'required');
CREATE TRIGGER "territory_reverse_MetroStation_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "MetroStation" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'required');
CREATE TRIGGER "territory_reverse_Activity_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "Activity" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_ActivitySlugHistory_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "ActivitySlugHistory" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_EventVenue_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "EventVenue" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_Place_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "Place" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_PlaceRevision_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "PlaceRevision" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_PlaceSlugHistory_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "PlaceSlugHistory" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_HomeStoryItem_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "HomeStoryItem" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'required');
CREATE TRIGGER "territory_reverse_Offer_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "Offer" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_OfferSlugHistory_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "OfferSlugHistory" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_Route_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "Route" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_Article_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "Article" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_Article_regionId" BEFORE INSERT OR UPDATE OF "regionTerritoryId" ON "Article" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('regionId', 'regionTerritoryId', 'REGION', 'nullable');
CREATE TRIGGER "territory_reverse_ArticleGeographyTarget_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "ArticleGeographyTarget" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_ArticleGeographyTarget_regionId" BEFORE INSERT OR UPDATE OF "regionTerritoryId" ON "ArticleGeographyTarget" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('regionId', 'regionTerritoryId', 'REGION', 'nullable');
CREATE TRIGGER "territory_reverse_ArticleSlugHistory_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "ArticleSlugHistory" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_EditorialRequest_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "EditorialRequest" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_SearchDocument_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "SearchDocument" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_ImportSource_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "ImportSource" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_SearchQuickTag_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "SearchQuickTag" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_SeoContentPlanItem_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "SeoContentPlanItem" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_SeoContentPlanItem_regionId" BEFORE INSERT OR UPDATE OF "regionTerritoryId" ON "SeoContentPlanItem" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('regionId', 'regionTerritoryId', 'REGION', 'nullable');
CREATE TRIGGER "territory_reverse_SearchQueryLog_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "SearchQueryLog" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_UserEvent_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "UserEvent" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
CREATE TRIGGER "territory_reverse_RecommendationRun_cityId" BEFORE INSERT OR UPDATE OF "territoryId" ON "RecommendationRun" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('cityId', 'territoryId', 'CITY', 'nullable');
