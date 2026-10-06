import prisma from "@/lib/prisma";
import type {
  SeoGeoContext,
  SeoGeoContextToken,
  SeoGeoSelectorOption,
} from "./types";
import { isSeoGeoContextToken } from "./types";

export type SeoGeoCatalog = {
  options: SeoGeoSelectorOption[];
  defaultToken: SeoGeoContextToken;
  resolve: (token: string | null | undefined) => SeoGeoContext;
};

type CityRow = {
  id: string;
  slug: string;
  name: string;
  regionId: string | null;
  countryId: string;
  region: { id: string; slug: string; name: string } | null;
  country: { id: string; slug: string; name: string };
};

type RegionRow = {
  id: string;
  slug: string;
  name: string;
  countryId: string;
  country: { id: string; slug: string; name: string };
  cities: { id: string; slug: string }[];
};

/**
 * Load selector options from existing Country / Region / City models.
 * Prefers active Belarus cities; includes regions for REGION-scoped work.
 */
export async function loadSeoGeoCatalog(): Promise<SeoGeoCatalog> {
  const [cities, regions] = await Promise.all([
    prisma.city.findMany({
      where: {
        isLegacyNonCity: false,
        isActive: true,
      },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        regionId: true,
        countryId: true,
        region: { select: { id: true, slug: true, name: true } },
        country: { select: { id: true, slug: true, name: true } },
      },
    }),
    // Regions may be isActive=false in seed data; still expose any region
    // that already has cities so REGION SEO context works.
    prisma.region.findMany({
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        countryId: true,
        country: { select: { id: true, slug: true, name: true } },
        cities: {
          where: { isLegacyNonCity: false, isActive: true },
          select: { id: true, slug: true },
        },
      },
    }),
  ]);

  return buildSeoGeoCatalog(cities, regions);
}

export function buildSeoGeoCatalog(
  cities: CityRow[],
  regions: RegionRow[],
): SeoGeoCatalog {
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const regionById = new Map(regions.map((r) => [r.id, r]));
  const countryById = new Map<string, { id: string; slug: string; name: string }>();

  for (const c of cities) countryById.set(c.country.id, c.country);
  for (const r of regions) countryById.set(r.country.id, r.country);

  const options: SeoGeoSelectorOption[] = [
    { value: "all", label: "Все регионы", group: "special" },
  ];

  for (const country of [...countryById.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ru"),
  )) {
    options.push({
      value: `country:${country.id}`,
      label: country.name,
      group: "country",
      countryId: country.id,
    });
  }

  for (const region of regions) {
    if (region.cities.length === 0) continue;
    options.push({
      value: `region:${region.id}`,
      label: region.name,
      group: "region",
      regionId: region.id,
      countryName: region.country.name,
    });
  }

  const sortedCities = [...cities].sort((a, b) => {
    if (a.slug === "minsk") return -1;
    if (b.slug === "minsk") return 1;
    return a.name.localeCompare(b.name, "ru");
  });

  for (const city of sortedCities) {
    options.push({
      value: `city:${city.id}`,
      label: city.name,
      group: "city",
      cityId: city.id,
      regionName: city.region?.name ?? null,
      countryName: city.country.name,
    });
  }

  const minsk = cities.find((c) => c.slug === "minsk");
  const defaultToken: SeoGeoContextToken = minsk
    ? `city:${minsk.id}`
    : cities[0]
      ? `city:${cities[0].id}`
      : "all";

  function resolve(token: string | null | undefined): SeoGeoContext {
    const raw = token?.trim() || defaultToken;
    const safe = isSeoGeoContextToken(raw) ? raw : defaultToken;

    if (safe === "all") return { kind: "all" };

    if (safe.startsWith("city:")) {
      const id = safe.slice("city:".length);
      const city = cityById.get(id);
      if (!city) return resolve(defaultToken === safe ? "all" : defaultToken);
      return {
        kind: "city",
        cityId: city.id,
        citySlug: city.slug,
        cityName: city.name,
        regionId: city.regionId,
        regionName: city.region?.name ?? null,
        countryId: city.countryId,
        countryName: city.country.name,
      };
    }

    if (safe.startsWith("region:")) {
      const id = safe.slice("region:".length);
      const region = regionById.get(id);
      if (!region) return resolve(defaultToken === safe ? "all" : defaultToken);
      return {
        kind: "region",
        regionId: region.id,
        regionSlug: region.slug,
        regionName: region.name,
        countryId: region.countryId,
        countryName: region.country.name,
        cityIds: region.cities.map((c) => c.id),
        citySlugs: region.cities.map((c) => c.slug),
      };
    }

    const id = safe.slice("country:".length);
    const country = countryById.get(id);
    if (!country) return resolve(defaultToken === safe ? "all" : defaultToken);
    return {
      kind: "country",
      countryId: country.id,
      countrySlug: country.slug,
      countryName: country.name,
    };
  }

  return { options, defaultToken, resolve };
}
