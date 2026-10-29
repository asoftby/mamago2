"use client";

import { useEffect, useMemo, useState } from "react";
import { serializeAppliedToSearchParams, type DiscoveryFilters } from "./filters.store";
import { useEventListingCitySlug, useEventListingExplore } from "@/lib/city/useEventListingCitySlug";

export type EventAvailableFacets = {
  categories: string[];
  genres: string[];
  formats: string[];
  ages: string[];
  occasions: string[];
  freeAvailable: boolean;
};

const cache = new Map<string, EventAvailableFacets>();
const pending = new Map<string, Promise<EventAvailableFacets>>();

export function useEventAvailableFacets(filters: DiscoveryFilters, enabled = true) {
  const city = useEventListingCitySlug();
  const explore = useEventListingExplore();
  const key = useMemo(() => {
    const params = serializeAppliedToSearchParams(new URLSearchParams(), filters);
    params.set("city", city);
    if (explore) params.set("explore", "1");
    return params.toString();
  }, [city, explore, filters]);
  const [result, setResult] = useState<{ key: string; value: EventAvailableFacets } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const cached = cache.get(key);
    if (cached) return;
    let request = pending.get(key);
    if (!request) {
      request = fetch(`/api/discovery/events/facets?${key}`)
        .then(response => {
          if (!response.ok) throw new Error("Could not fetch event facets");
          return response.json() as Promise<EventAvailableFacets>;
        })
        .then(value => { cache.set(key, value); return value; })
        .finally(() => { pending.delete(key); });
      pending.set(key, request);
    }
    let active = true;
    request.then(value => { if (active) setResult({ key, value }); }).catch(() => {});
    return () => { active = false; };
  }, [key, enabled]);

  return enabled ? cache.get(key) ?? (result?.key === key ? result.value : null) : null;
}
