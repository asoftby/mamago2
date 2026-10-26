/**
 * Deterministic Territory ids shared by the expand migration and the dual-write helper.
 * Must stay in sync with prisma/migrations/20261026120000_territory_expand/migration.sql.
 */

export type BelarusRegionRef = {
  /** Slug of the legacy oblast row (Region.slug). */
  oblastSlug: string;
  /** Territory REGION slug = slug of the oblast centre city (`/minsk/...`). */
  centreSlug: string;
  name: string;
  nameIn: string;
  /** Prepositional name of the centre city itself ("в Минске"). */
  cityNameIn: string;
  priority: number;
  lat: number;
  lng: number;
};

export const BELARUS_REGION_REFS: readonly BelarusRegionRef[] = [
  { oblastSlug: "minskaya-oblast", centreSlug: "minsk", name: "Минск и область", nameIn: "в Минске и области", cityNameIn: "в Минске", priority: 100, lat: 53.9006, lng: 27.559 },
  { oblastSlug: "brestskaya-oblast", centreSlug: "brest", name: "Брест и область", nameIn: "в Бресте и области", cityNameIn: "в Бресте", priority: 90, lat: 52.0976, lng: 23.7341 },
  { oblastSlug: "vitebskaya-oblast", centreSlug: "vitebsk", name: "Витебск и область", nameIn: "в Витебске и области", cityNameIn: "в Витебске", priority: 90, lat: 55.1904, lng: 30.2049 },
  { oblastSlug: "gomelskaya-oblast", centreSlug: "gomel", name: "Гомель и область", nameIn: "в Гомеле и области", cityNameIn: "в Гомеле", priority: 90, lat: 52.4345, lng: 30.9754 },
  { oblastSlug: "grodnenskaya-oblast", centreSlug: "grodno", name: "Гродно и область", nameIn: "в Гродно и области", cityNameIn: "в Гродно", priority: 90, lat: 53.6693, lng: 23.8131 },
  { oblastSlug: "mogilevskaya-oblast", centreSlug: "mogilev", name: "Могилёв и область", nameIn: "в Могилёве и области", cityNameIn: "в Могилёве", priority: 90, lat: 53.9007, lng: 30.3313 },
];

export const BELARUS_COUNTRY_SLUG = "belarus";

export function findBelarusRegionRefByOblastSlug(slug: string): BelarusRegionRef | undefined {
  return BELARUS_REGION_REFS.find((ref) => ref.oblastSlug === slug);
}

export function findBelarusRegionRefByCentreSlug(slug: string): BelarusRegionRef | undefined {
  return BELARUS_REGION_REFS.find((ref) => ref.centreSlug === slug);
}

export const countryTerritoryId = (legacyCountryId: string) => `ter_country_${legacyCountryId}`;
export const cityTerritoryId = (legacyCityId: string) => `ter_city_${legacyCityId}`;
/** Belarus oblasts are identified by their centre slug, every other region by its legacy id. */
export const regionTerritoryId = (input: { legacyRegionId: string; centreSlug?: string | null }) =>
  input.centreSlug ? `ter_region_${input.centreSlug}` : `ter_region_${input.legacyRegionId}`;
