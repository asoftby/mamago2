"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG, resolveRouteCitySlug } from "@/lib/city/resolveCityContext";
import { isScopedEventBrowsing } from "@/lib/city/scopedEventBrowsing";

/**
 * Filters must reflect the event listing being viewed, not the persisted
 * header territory. In ?explore=1 mode the header intentionally stays home.
 */
export function useEventListingCitySlug(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const city = useOptionalCity()?.citySlug ?? DEFAULT_CITY_SLUG;
  if (isScopedEventBrowsing(pathname, searchParams.get("explore"))) {
    return resolveRouteCitySlug(pathname) ?? city;
  }
  return city;
}
