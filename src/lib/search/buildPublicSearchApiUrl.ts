import { PUBLIC_SEARCH_RESULTS_LIMIT } from "@/lib/search/constants";

/**
 * Builds the public `/api/search` URL. Prefer `citySlug` as the geo contract;
 * the server resolves slug → City.id for SearchQueryLog.
 */
export function buildPublicSearchApiUrl(input: {
  q: string;
  limit?: number;
  citySlug?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("q", input.q);
  params.set(
    "limit",
    String(input.limit ?? PUBLIC_SEARCH_RESULTS_LIMIT),
  );
  const slug = input.citySlug?.trim();
  if (slug) {
    params.set("citySlug", slug);
  }
  return `/api/search?${params.toString()}`;
}
