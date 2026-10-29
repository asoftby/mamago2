/**
 * Pure (server- and client-safe) discovery filter URL contract.
 * `filters.store.ts` re-exports these; the server listing pagination parses the
 * same URL with the same rules, so client and server never disagree.
 */
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";

export type WhenPreset = "TODAY" | "TOMORROW" | "WEEKEND" | null;

/** Primary discovery filters — источник правды: URL (searchParams) */
export type DiscoveryFilters = {
  categories: string[];
  genres: string[];
  /** Seasonal occasion quick-filter (presently Halloween). */
  occasionSlug?: string | null;
  /** Selected family persona IDs (comma-separated when multiple); shareable URL. */
  profile: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  whenPreset: WhenPreset;
  age: string[];
  format: "OFFLINE" | "ONLINE" | "HYBRID" | null;
  metro: string | null;
  district: string | null;
  nearby: boolean;
  free: boolean;
  priceMin: number | null;
  priceMax: number | null;
  adultOnly: boolean;
};

export const defaultFilters: DiscoveryFilters = {
  categories: [],
  genres: [],
  occasionSlug: null,
  profile: null,
  dateFrom: null,
  dateTo: null,
  whenPreset: null,
  age: [],
  format: null,
  metro: null,
  district: null,
  nearby: false,
  free: false,
  priceMin: null,
  priceMax: null,
  adultOnly: false,
};

export function parseAppliedFromUrl(
  searchParams: Pick<URLSearchParams, "get">,
): DiscoveryFilters {
  let dFrom = searchParams.get("from") || searchParams.get("dateFrom");
  let dTo = searchParams.get("to") || searchParams.get("dateTo");

  if (!dFrom && !dTo) {
    const w = searchParams.get("when");
    if (w) {
      if (w.includes(",")) {
        const parts = w.split(",");
        dFrom = parts[0];
        dTo = parts[1];
      } else {
        dFrom = w;
      }
    }
  }

  const ageRaw = searchParams.get("age")?.split(",").filter(Boolean) || [];
  const categories = searchParams.get("category")?.split(",").filter(Boolean) || [];
  const genres = searchParams.get("genre")?.split(",").filter(Boolean) || [];
  const occasionSlug = searchParams.get("occasion") === "halloween" ? "halloween" : null;
  // Family persona IDs are never read from (or written to) public URLs (#799).
  const profile = null;

  const legacyAgeMap: Record<string, string> = {
    "0+": "0-1",
    "6+": "5-7",
    "12+": "12-14",
    "18_plus": "18+",
  };

  const ageNormalized = ageRaw.map((id) => legacyAgeMap[id] ?? id);

  const validAgeIds = new Set(AGE_GROUPS.map((g) => g.value));
  const mappedAge = ageNormalized.filter((id) => validAgeIds.has(id));

  const metroParam = searchParams.get("metro");
  const metro = metroParam
    ? metroParam.includes(",")
      ? metroParam.split(",")[0]
      : metroParam
    : null;

  const district = searchParams.get("district") || null;
  const format = parseActivityFormatQuery(searchParams.get("format"));

  const nearby = searchParams.get("nearby") === "true";
  const free = searchParams.get("free") === "true";
  const priceMinRaw = searchParams.get("priceMin");
  const parsedPriceMin = priceMinRaw == null ? NaN : Number(priceMinRaw);
  const priceMaxRaw = searchParams.get("priceMax");
  const parsedPriceMax = priceMaxRaw == null ? NaN : Number(priceMaxRaw);
  const priceMin = !free && Number.isFinite(parsedPriceMin) && parsedPriceMin > 0 ? parsedPriceMin : null;
  const priceMax = !free && Number.isFinite(parsedPriceMax) && parsedPriceMax >= 0 ? parsedPriceMax : null;
  const adultOnly = searchParams.get("adultOnly") === "true";

  const presetParam = searchParams.get("preset");
  let whenPreset: WhenPreset = null;
  if (
    presetParam === "TODAY" ||
    presetParam === "TOMORROW" ||
    presetParam === "WEEKEND"
  ) {
    whenPreset = presetParam;
  }

  return {
    categories: [...new Set(categories)],
    genres: [...new Set(genres)],
    occasionSlug,
    profile,
    dateFrom: dFrom || null,
    dateTo: dTo || null,
    whenPreset,
    age: mappedAge,
    format,
    metro,
    district,
    nearby,
    free,
    priceMin,
    priceMax,
    adultOnly,
  };
}

/**
 * Stable signature of the filters that shape the afisha result set. Computed
 * on the server for the rendered listing and on the client for the applied
 * URL state; a mismatch means a newer server render is on its way.
 */
export function discoveryFiltersSignature(f: DiscoveryFilters): string {
  return JSON.stringify({
    df: f.dateFrom,
    dt: f.dateTo,
    wp: f.whenPreset,
    age: [...f.age].sort(),
    categories: [...f.categories].sort(),
    genres: [...f.genres].sort(),
    occasion: f.occasionSlug ?? null,
    profile: f.profile ?? null,
    format: f.format,
    metro: f.metro,
    district: f.district,
    nearby: f.nearby,
    free: f.free,
    priceMin: f.priceMin,
    priceMax: f.priceMax,
    adultOnly: f.adultOnly,
  });
}

/** Listing pagination query param (afisha `?page=N`). */
export const LISTING_PAGE_PARAM = "page";

/**
 * Every write that changes the result set must start from the first page;
 * otherwise a narrower filter can land past the end (404) or skip matches.
 */
export function resetListingPage<T extends Pick<URLSearchParams, "delete">>(params: T): T {
  params.delete(LISTING_PAGE_PARAM);
  return params;
}

/**
 * Filters implied by the route rather than the query string — e.g. the
 * category hub `/[city]/events/category/[category]` injects `category`
 * server-side. The route value wins, exactly like the server render.
 */
export type ImplicitListingFilters = { category?: string | null };

export function withImplicitListingFilters(
  filters: DiscoveryFilters,
  implicit: ImplicitListingFilters | null | undefined,
): DiscoveryFilters {
  if (!implicit?.category) return filters;
  return { ...filters, categories: [implicit.category] };
}

/** Same override applied to raw query params (pagination requests). */
export function applyImplicitListingParams<T extends Pick<URLSearchParams, "set">>(
  params: T,
  implicit: ImplicitListingFilters | null | undefined,
): T {
  if (implicit?.category) params.set("category", implicit.category);
  return params;
}
