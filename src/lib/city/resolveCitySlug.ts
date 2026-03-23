import { getCityFromPath } from "@/lib/intent";

/**
 * Priority: city from URL path → `city` query → persisted choice → minsk.
 */
export function resolveCitySlug(
  pathname: string | null,
  cityFromQuery: string | null,
  storedCity: string | null,
): string {
  return getCityFromPath(pathname) || cityFromQuery || storedCity || "minsk";
}
