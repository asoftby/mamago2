/**
 * Territory EXPAND phase: every legacy geo FK column and the Territory column
 * it is backfilled into. Shared by the reconciliation script and its test.
 * Dropped together with the legacy tables in the contract phase.
 */
export type TerritoryExpandColumn = {
  table: string;
  legacyColumn: "cityId" | "regionId";
  territoryColumn: "territoryId" | "regionTerritoryId";
};

const city = (table: string): TerritoryExpandColumn => ({ table, legacyColumn: "cityId", territoryColumn: "territoryId" });
const region = (table: string): TerritoryExpandColumn => ({ table, legacyColumn: "regionId", territoryColumn: "regionTerritoryId" });

export const TERRITORY_EXPAND_COLUMNS: TerritoryExpandColumn[] = [
  city("District"),
  city("MetroStation"),
  city("Activity"),
  city("ActivitySlugHistory"),
  city("EventVenue"),
  city("Place"),
  city("PlaceRevision"),
  city("PlaceSlugHistory"),
  city("HomeStoryItem"),
  city("Offer"),
  city("OfferSlugHistory"),
  city("Route"),
  city("Article"),
  region("Article"),
  city("ArticleGeographyTarget"),
  region("ArticleGeographyTarget"),
  city("ArticleSlugHistory"),
  city("EditorialRequest"),
  city("SearchDocument"),
  city("ImportSource"),
  city("SearchQuickTag"),
  city("SeoContentPlanItem"),
  region("SeoContentPlanItem"),
  city("SearchQueryLog"),
  city("UserEvent"),
  city("RecommendationRun"),
];
