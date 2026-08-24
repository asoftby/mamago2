"use client";

import * as React from "react";
import type { DiscoveryFilters } from "./filters.store";

export type EventGenreOption = { id: string; nameRu: string; slug: string; sortOrder: number };
export type EventCategoryOption = {
  id: string;
  nameRu: string;
  nameEn: string | null;
  slug: string;
  icon: string | null;
  sortOrder: number;
  genres: EventGenreOption[];
};

const taxonomyCache = new Map<string, EventCategoryOption[]>();
const taxonomyRequests = new Map<string, Promise<EventCategoryOption[]>>();

export function eventTaxonomyCacheKey(citySlug: string): string {
  return citySlug.trim().toLowerCase();
}

export async function fetchEventTaxonomy(citySlug: string): Promise<EventCategoryOption[]> {
  const cacheKey = eventTaxonomyCacheKey(citySlug);
  const cached = taxonomyCache.get(cacheKey);
  if (cached) return cached;
  let request = taxonomyRequests.get(cacheKey);
  if (!request) {
    request = fetch(`/api/public/event-categories?city=${encodeURIComponent(cacheKey)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load event taxonomy");
        const payload = await response.json() as { categories?: EventCategoryOption[] };
        const categories = payload.categories ?? [];
        taxonomyCache.set(cacheKey, categories);
        return categories;
      })
      .finally(() => { taxonomyRequests.delete(cacheKey); });
    taxonomyRequests.set(cacheKey, request);
  }
  return request;
}

export function useEventTaxonomy(citySlug: string) {
  const cacheKey = eventTaxonomyCacheKey(citySlug);
  const [categories, setCategories] = React.useState<EventCategoryOption[]>(() => taxonomyCache.get(cacheKey) ?? []);
  const [loading, setLoading] = React.useState(() => !taxonomyCache.has(cacheKey));

  React.useEffect(() => {
    const cached = taxonomyCache.get(cacheKey);
    if (cached) {
      setCategories(cached);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchEventTaxonomy(cacheKey)
      .then((next) => { if (active) setCategories(next); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cacheKey]);

  return { categories, loading };
}

export function normalizeDraftToAvailableTaxonomy(
  draft: DiscoveryFilters,
  taxonomy: EventCategoryOption[],
): DiscoveryFilters {
  const availableCategories = new Set(taxonomy.map((category) => category.slug));
  const categories = draft.categories.filter((slug) => availableCategories.has(slug));
  const availableGenres = new Set(
    taxonomy
      .filter((category) => categories.includes(category.slug))
      .flatMap((category) => category.genres.map((genre) => genre.slug)),
  );
  return { ...draft, categories, genres: draft.genres.filter((slug) => availableGenres.has(slug)) };
}

export function toggleEventCategory(
  draft: DiscoveryFilters,
  categorySlug: string,
  taxonomy: EventCategoryOption[],
): DiscoveryFilters {
  if (!draft.categories.includes(categorySlug)) {
    return { ...draft, categories: [...draft.categories, categorySlug] };
  }
  const categories = draft.categories.filter((slug) => slug !== categorySlug);
  const allowedGenres = new Set(
    taxonomy
      .filter((category) => categories.includes(category.slug))
      .flatMap((category) => category.genres.map((genre) => genre.slug)),
  );
  return {
    ...draft,
    categories,
    genres: draft.genres.filter((slug) => allowedGenres.has(slug)),
  };
}
