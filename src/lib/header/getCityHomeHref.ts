import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";

export function getCityHomeHref(citySlug?: string | null): string {
  const normalizedCitySlug = citySlug?.trim().toLowerCase() || DEFAULT_CITY_SLUG;
  return `/${normalizedCitySlug}`;
}
