import "server-only";

import type { ArticleDynamicAfishaData } from "@/components/article/blocks/ArticleDynamicAfishaBlock";
import { articleDynamicAfishaParams, type ArticleAfishaPeriod } from "@/lib/article/articleDynamicAfishaFilters";
import { getActivePublicOccasions } from "@/lib/discovery/occasions";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { loadKudaListingPage } from "@/server/discovery/kudaListingPage";

/**
 * Server-side hydration for the editorial afisha block. No custom event search,
 * ranking, monetization, or visibility rules: the catalog's existing loader
 * returns exactly the first ranked page and records its Boost exposures.
 */
export async function resolveArticleDynamicAfisha({
  citySlug,
  occasionSlug,
  period = "ALL",
}: {
  citySlug?: string | null;
  occasionSlug?: string | null;
  period?: ArticleAfishaPeriod;
}): Promise<ArticleDynamicAfishaData | null> {
  // COUNTRY-wide editorial pages must not silently use Minsk as a fallback.
  if (!citySlug) return null;

  const [city, occasions] = await Promise.all([
    findCityBySlug(citySlug),
    getActivePublicOccasions(),
  ]);
  if (!city) return null;

  const occasion = occasionSlug?.trim() || null;
  const activeSlugs = new Set(occasions.map((item) => item.slug));
  const active = !occasion || activeSlugs.has(occasion);
  // Expired occasion filters are ignored by the public catalog. Do not
  // silently show unrelated events inside an explicitly themed article.
  const filters = articleDynamicAfishaParams({ occasionSlug: occasion, period });
  const listing = active
    ? await loadKudaListingPage({
        cityId: city.id,
        citySlug: city.slug,
        userId: null,
        searchParams: filters,
        page: 1,
        pageSize: 8,
        activeOccasionSlugs: activeSlugs,
      })
    : null;

  const destination = active ? filters : articleDynamicAfishaParams({ period });
  const query = destination.toString();

  return {
    citySlug: city.slug,
    href: `/${city.slug}/events${query ? `?${query}` : ""}`,
    filterSummary: filters.toString() || "all",
    items: listing?.items ?? [],
  };
}
