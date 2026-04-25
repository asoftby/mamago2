import { listAdminCityRows } from "@/server/city/cityAdminData";
import { isCityNameAllowed } from "@/server/geo/city-resolver";

export type PublicCitySelectorOption = {
  id: string;
  slug: string;
  name: string;
};

/** Паттерны slug, которые указывают на административный регион, а не город. */
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
  const rows = await listAdminCityRows();

  return rows
    .filter(
      (city) =>
        city.isActive &&
        city.isVisibleInCityFilter &&
        (city.eventsCount > 0 || city.placesCount > 0) &&
        // Запрет административных регионов в публичном селекторе
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
}
