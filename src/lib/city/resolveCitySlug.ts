import { DEFAULT_CITY_SLUG, resolveCityContext } from "@/lib/city/resolveCityContext";

/**
 * Priority: city from URL path → `city` query → persisted choice → minsk.
 */
export function resolveCitySlug(
  pathname: string | null,
  cityFromQuery: string | null,
  storedCity: string | null,
): string {
  return (
    resolveCityContext({
      pathname,
      cityFromQuery,
      preferredCitySlug: storedCity,
    }).citySlug ?? DEFAULT_CITY_SLUG
  );
}
