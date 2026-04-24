"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CITY_SLUG } from "@/lib/intent";

export type PublicCityOption = {
  id: string;
  slug: string;
  name: string;
};

const FALLBACK_CITIES: PublicCityOption[] = [
  { id: DEFAULT_CITY_SLUG, slug: DEFAULT_CITY_SLUG, name: "Минск" },
];

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
  const [cities, setCities] = useState<PublicCityOption[]>(FALLBACK_CITIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/public/cities", { credentials: "same-origin" });
        if (!response.ok) return;
        const data = (await response.json()) as { cities?: PublicCityOption[] };
        if (cancelled) return;
        if (Array.isArray(data.cities) && data.cities.length > 0) {
          setCities((prev) => mergeCityOptions(FALLBACK_CITIES, prev, data.cities));
        }
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const slugSet = useMemo(() => new Set(cities.map((city) => city.slug)), [cities]);

  return {
    cities,
    loading,
    hasCity: (slug: string | null | undefined) => Boolean(slug && slugSet.has(slug)),
  };
}
