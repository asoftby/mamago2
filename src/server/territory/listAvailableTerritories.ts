import type { TerritoryType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  defaultTerritorySlugForSection,
  DEFAULT_CITY_TERRITORY_SLUG,
  isTerritoryTypeSupported,
  type TerritorySection,
} from "@/lib/territory/territorySections";
import { DEFAULT_COUNTRY_ISO } from "@/server/geo/geoConstants";
import { isAdministrativeSlug } from "@/server/city/publicCitySelector";
import { isCityNameAllowed } from "@/server/geo/city-resolver";
import {
  addSectionCounts,
  countNationalArticles,
  countPublicContentByTerritory,
  EMPTY_SECTION_COUNTS,
  totalSectionCounts,
  type TerritorySectionCounts,
} from "@/server/territory/territoryContentCounts";

export type AvailableTerritory = {
  id: string;
  type: TerritoryType;
  slug: string;
  name: string;
  nameIn: string | null;
  parentId: string | null;
  path: string;
  /** Published content per section (a region includes its cities, the country everything). */
  counts: TerritorySectionCounts;
  /** false when the section cannot show this territory (e.g. whole country in birthday). */
  supported: boolean;
};

export type AvailableTerritoriesResult = {
  territories: AvailableTerritory[];
  /** Territory preselected when the visitor has made no choice. */
  defaultSlug: string;
  /** Where to send a visitor whose selection is unsupported in the section. */
  fallbackSlug: string;
};

type Row = {
  id: string; type: TerritoryType; slug: string; name: string; nameIn: string | null;
  parentId: string | null; priority: number; isVisibleInCityFilter: boolean;
};

/**
 * Pure ordering/filtering: country first, then each region followed by its cities.
 * A territory is listed when it holds at least one published item in ANY section
 * (events, classes, places, offers, routes, articles); the country is always listed.
 * A centre city (same slug as its region) is represented by the region, which includes its content.
 */
export function buildAvailableTerritories(
  rows: readonly Row[],
  ownCounts: ReadonlyMap<string, TerritorySectionCounts>,
  section: TerritorySection | null,
  nationalArticles = 0,
): AvailableTerritory[] {
  const byParent = new Map<string | null, Row[]>();
  for (const row of rows) byParent.set(row.parentId, [...(byParent.get(row.parentId) ?? []), row]);
  const rank = (a: Row, b: Row) => b.priority - a.priority || a.name.localeCompare(b.name, "ru");
  const own = (row: Row) => ownCounts.get(row.id) ?? EMPTY_SECTION_COUNTS;
  const cityAllowed = (city: Row) =>
    city.type === "CITY" && city.isVisibleInCityFilter && isCityNameAllowed(city.name) && !isAdministrativeSlug(city.slug);
  const regionCounts = (region: Row) =>
    (byParent.get(region.id) ?? []).reduce(
      (sum, child) => (child.type === "CITY" && cityAllowed(child) ? addSectionCounts(sum, own(child)) : sum),
      own(region),
    );

  const toItem = (row: Row, counts: TerritorySectionCounts): AvailableTerritory => ({
    id: row.id, type: row.type, slug: row.slug, name: row.name, nameIn: row.nameIn, parentId: row.parentId,
    path: `/${row.slug}`, counts, supported: section ? isTerritoryTypeSupported(section, row.type) : true,
  });

  const out: AvailableTerritory[] = [];
  for (const country of rows.filter((r) => r.type === "COUNTRY").sort(rank)) {
    const children = (byParent.get(country.id) ?? []).sort(rank);
    const regions = children.filter((r) => r.type === "REGION");
    const looseCities = children.filter((r) => cityAllowed(r) && totalSectionCounts(own(r)) > 0);
    const countryCounts = [
      ...regions.map(regionCounts),
      ...looseCities.map(own),
      { ...EMPTY_SECTION_COUNTS, articles: nationalArticles },
    ].reduce(addSectionCounts, EMPTY_SECTION_COUNTS);
    out.push(toItem(country, countryCounts));
    for (const region of regions) {
      const counts = regionCounts(region);
      if (totalSectionCounts(counts) === 0) continue;
      out.push(toItem(region, counts));
      for (const city of (byParent.get(region.id) ?? []).sort(rank)) {
        if (cityAllowed(city) && city.slug !== region.slug && totalSectionCounts(own(city)) > 0) out.push(toItem(city, own(city)));
      }
    }
    for (const city of looseCities) out.push(toItem(city, own(city)));
  }
  return out;
}

export async function listAvailableTerritories(section: TerritorySection | null): Promise<AvailableTerritoriesResult> {
  const rows = await prisma.territory.findMany({
    where: {
      isActive: true,
      OR: [
        { type: "COUNTRY", isoCode: DEFAULT_COUNTRY_ISO },
        { type: "REGION", parent: { isoCode: DEFAULT_COUNTRY_ISO } },
        { type: "CITY", isLegacyNonCity: false, OR: [{ parent: { isoCode: DEFAULT_COUNTRY_ISO } }, { parent: { parent: { isoCode: DEFAULT_COUNTRY_ISO } } }] },
      ],
    },
    select: { id: true, type: true, slug: true, name: true, nameIn: true, parentId: true, priority: true, isVisibleInCityFilter: true },
  });
  const [counts, nationalArticles] = await Promise.all([
    countPublicContentByTerritory(rows.filter((row) => row.type !== "COUNTRY").map((row) => row.id)),
    countNationalArticles(),
  ]);
  return {
    territories: buildAvailableTerritories(rows, counts, section, nationalArticles),
    defaultSlug: section ? defaultTerritorySlugForSection(section) : DEFAULT_CITY_TERRITORY_SLUG,
    fallbackSlug: DEFAULT_CITY_TERRITORY_SLUG,
  };
}
