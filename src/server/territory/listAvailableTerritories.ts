import type { TerritoryType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  defaultTerritorySlugForSection,
  DEFAULT_CITY_TERRITORY_SLUG,
  isTerritoryTypeSupported,
  type TerritorySection,
} from "@/lib/territory/territorySections";
import { DEFAULT_COUNTRY_ISO } from "@/server/geo/geoConstants";
import { listPublicCitySelectorOptions } from "@/server/city/publicCitySelector";

export type AvailableTerritory = {
  id: string;
  type: TerritoryType;
  slug: string;
  name: string;
  nameIn: string | null;
  parentId: string | null;
  path: string;
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
 * A centre city (same slug as its region) is represented by the region itself.
 */
export function buildAvailableTerritories(
  rows: readonly Row[],
  visibleCitySlugs: ReadonlySet<string>,
  section: TerritorySection | null,
): AvailableTerritory[] {
  const byParent = new Map<string | null, Row[]>();
  for (const row of rows) byParent.set(row.parentId, [...(byParent.get(row.parentId) ?? []), row]);
  const rank = (a: Row, b: Row) => b.priority - a.priority || a.name.localeCompare(b.name, "ru");
  const isListedCity = (city: Row, parent: Row | null) =>
    city.type === "CITY" && city.isVisibleInCityFilter && visibleCitySlugs.has(city.slug) && city.slug !== parent?.slug;
  const hasListedCity = (region: Row) =>
    (byParent.get(region.id) ?? []).some((child) => child.type === "CITY" && child.isVisibleInCityFilter && visibleCitySlugs.has(child.slug));

  const toItem = (row: Row): AvailableTerritory => ({
    id: row.id, type: row.type, slug: row.slug, name: row.name, nameIn: row.nameIn, parentId: row.parentId,
    path: `/${row.slug}`, supported: section ? isTerritoryTypeSupported(section, row.type) : true,
  });

  const out: AvailableTerritory[] = [];
  for (const country of rows.filter((r) => r.type === "COUNTRY").sort(rank)) {
    out.push(toItem(country));
    const children = (byParent.get(country.id) ?? []).sort(rank);
    for (const region of children.filter((r) => r.type === "REGION" && hasListedCity(r))) {
      out.push(toItem(region));
      for (const city of (byParent.get(region.id) ?? []).sort(rank)) if (isListedCity(city, region)) out.push(toItem(city));
    }
    for (const city of children) if (isListedCity(city, country)) out.push(toItem(city));
  }
  return out;
}

export async function listAvailableTerritories(section: TerritorySection | null): Promise<AvailableTerritoriesResult> {
  const [rows, cityOptions] = await Promise.all([
    prisma.territory.findMany({
      where: {
        isActive: true,
        OR: [
          { type: "COUNTRY", isoCode: DEFAULT_COUNTRY_ISO },
          { type: "REGION", parent: { isoCode: DEFAULT_COUNTRY_ISO } },
          { type: "CITY", isLegacyNonCity: false, OR: [{ parent: { isoCode: DEFAULT_COUNTRY_ISO } }, { parent: { parent: { isoCode: DEFAULT_COUNTRY_ISO } } }] },
        ],
      },
      select: { id: true, type: true, slug: true, name: true, nameIn: true, parentId: true, priority: true, isVisibleInCityFilter: true },
    }),
    // Same visibility rules as the legacy selector (active + events/places present + real city).
    listPublicCitySelectorOptions(),
  ]);
  return {
    territories: buildAvailableTerritories(rows, new Set(cityOptions.map((city) => city.slug)), section),
    defaultSlug: section ? defaultTerritorySlugForSection(section) : DEFAULT_CITY_TERRITORY_SLUG,
    fallbackSlug: DEFAULT_CITY_TERRITORY_SLUG,
  };
}
