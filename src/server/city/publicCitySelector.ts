import { listAdminCityRows } from "@/server/city/cityAdminData";
import { isCityNameAllowed } from "@/server/geo/city-resolver";

export type PublicCitySelectorOption = {
  id: string;
  slug: string;
  name: string;
};

/** Slug patterns that indicate administrative region, not a city. */
const ADMINISTRATIVE_SLUG_PATTERNS = [
  /oblast$/i,
  /region$/i,
  /rayon$/i,
  /okrug$/i,
  /-oblast/i,
  /-region/i,
];

function isAdministrativeSlug(slug: string): boolean {
  return ADMINISTRATIVE_SLUG_PATTERNS.some((p) => p.test(slug));
}

export async function listPublicCitySelectorOptions(): Promise<PublicCitySelectorOption[]> {
  const totalStart = performance.now();
  const rows = await listAdminCityRows();
  if (process.env.NODE_ENV === "development") {
    console.debug(`[publicCitySelector] listAdminCityRows: ${(performance.now() - totalStart).toFixed(0)}ms`);
  }

  const filterStart = performance.now();
  const result = rows
    .filter(
      (city) =>
        city.isActive &&
        city.isVisibleInCityFilter &&
        (city.eventsCount > 0 || city.placesCount > 0) &&
        isCityNameAllowed(city.name) &&
        !isAdministrativeSlug(city.slug),
    )
    .map((city) => ({
      id: city.id,
      slug: city.slug,
      name: city.name,
      priority: city.priority,
    }))
    .sort((a, b) => {
      if (a.slug === "minsk") return -1;
      if (b.slug === "minsk") return 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.name.localeCompare(b.name, "ru");
    })
    .map(({ id, slug, name }) => ({ id, slug, name }));
  if (process.env.NODE_ENV === "development") {
    console.debug(`[publicCitySelector] filter+sort: ${(performance.now() - filterStart).toFixed(0)}ms`);
    console.debug(`[publicCitySelector] total: ${(performance.now() - totalStart).toFixed(0)}ms`);
  }
  return result;
}
