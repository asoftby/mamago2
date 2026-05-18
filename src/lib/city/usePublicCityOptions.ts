"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_CITY_SLUG } from "@/lib/intent";

export type PublicCityOption = {
  id: string;
  slug: string;
  name: string;
};

const FALLBACK_CITIES: PublicCityOption[] = [
  { id: DEFAULT_CITY_SLUG, slug: DEFAULT_CITY_SLUG, name: "Минск" },
];

/** Paths where city options are not needed — skip fetch */
function shouldSkipCityOptions(pathname: string): boolean {
  return pathname.startsWith("/me/") || pathname.startsWith("/admin/");
}

/** Module-level cache to avoid repeated fetch across remounts */
let cachedCities: PublicCityOption[] | null = null;
let inFlightCitiesPromise: Promise<PublicCityOption[]> | null = null;

function mergeCityOptions(
  ...lists: Array<PublicCityOption[] | null | undefined>
): PublicCityOption[] {
  const map = new Map<string, PublicCityOption>();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const city of list) {
      if (!city?.slug) continue;
      map.set(city.slug, city);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.slug === DEFAULT_CITY_SLUG) return -1;
    if (b.slug === DEFAULT_CITY_SLUG) return 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

export function usePublicCityOptions() {
  const pathname = usePathname();
  const [cities, setCities] = useState<PublicCityOption[]>(cachedCities || FALLBACK_CITIES);
  const [loading, setLoading] = useState(!cachedCities);

  useEffect(() => {
    // Skip fetching cities on /me/* and /admin/* — not needed for these pages
    if (shouldSkipCityOptions(pathname)) {
      if (!cachedCities) {
        // Use fallback (just Minsk) — city data not needed here
        setCities(FALLBACK_CITIES);
      }
      setLoading(false);
      return;
    }

    if (cachedCities) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      if (inFlightCitiesPromise) {
        const result = await inFlightCitiesPromise;
        if (!cancelled) {
          setCities(result);
          setLoading(false);
        }
        return;
      }

      inFlightCitiesPromise = (async () => {
        try {
          const response = await fetch("/api/public/cities", {
            credentials: "same-origin",
          });
          if (!response.ok) return FALLBACK_CITIES;
          const data = (await response.json()) as { cities?: PublicCityOption[] };
          if (Array.isArray(data.cities) && data.cities.length > 0) {
            const merged = mergeCityOptions(FALLBACK_CITIES, data.cities);
            cachedCities = merged;
            return merged;
          }
          return FALLBACK_CITIES;
        } catch {
          return FALLBACK_CITIES;
        } finally {
          inFlightCitiesPromise = null;
        }
      })();

      const result = await inFlightCitiesPromise;
      if (!cancelled) {
        setCities(result);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const slugSet = useMemo(() => new Set(cities.map((city) => city.slug)), [cities]);

  return {
    cities,
    loading,
    hasCity: (slug: string | null | undefined) => Boolean(slug && slugSet.has(slug)),
  };
}
