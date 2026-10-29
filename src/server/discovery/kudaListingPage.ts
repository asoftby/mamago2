import { recordDiscoveryExposures } from "@/server/services/recommendations/RecommendationTraceService";
import { unstable_cache } from "next/cache";
import { withImageDimensions } from "@/server/media/loadImageDimensionsByUrl";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";
import { parseAppliedFromUrl } from "@/features/filters/discovery/discoveryFilterParams";
import { partitionDiscoveryFeed } from "@/lib/discovery/partitionDiscoveryFeed";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";
import { resolveEventDateRange, type EventRuntimeFilters } from "@/server/discovery/eventFilterSemantics";
import type { ActivityMock } from "@/types/activity";
import {
  KUDA_LISTING_PAGE_SIZE,
  paginateKudaFeed,
  type KudaListingPage,
} from "@/lib/discovery/kudaListingPagination";

export type ListingSearchParams = Record<string, string | string[] | undefined>;

export function toUrlSearchParams(record: ListingSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else params.set(key, value);
  }
  return params;
}

export function parseListingPage(value: string | string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Same filter semantics as the previous inline parsing in CityShell / count API. */
export function buildKudaEventFilters(
  params: Pick<URLSearchParams, "get">,
  halloweenEnabled: boolean,
): EventRuntimeFilters {
  const preset = params.get("preset");
  const free = params.get("free") === "true";
  const num = (key: string, min: (value: number) => boolean) => {
    if (free) return null;
    const raw = params.get(key);
    if (raw == null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && min(value) ? value : null;
  };
  return {
    categorySlugs: params.get("category")?.split(",").filter(Boolean) ?? [],
    occasionSlug: halloweenEnabled && params.get("occasion") === "halloween" ? "halloween" : null,
    genreSlugs: params.get("genre")?.split(",").filter(Boolean) ?? [],
    dateRange: resolveEventDateRange({
      preset: preset === "TODAY" || preset === "TOMORROW" || preset === "WEEKEND" ? preset : null,
      from: params.get("from") ?? params.get("dateFrom") ?? null,
      to: params.get("to") ?? params.get("dateTo") ?? null,
    }),
    free,
    priceMin: num("priceMin", (value) => value > 0),
    priceMax: num("priceMax", (value) => value >= 0),
    districtId: params.get("district") ?? null,
    metroId: params.get("metro") ?? null,
    adultOnly: params.get("adultOnly") === "true",
  };
}

export type KudaListingResult = KudaListingPage<ActivityMock> & {
  /** Whole partitioned pool (budget slider domain). */
  pool: ActivityMock[];
};

export async function loadKudaListingPage(input: {
  cityId: string;
  citySlug: string;
  userId: string | null;
  searchParams: Pick<URLSearchParams, "get">;
  page: number;
  halloweenEnabled: boolean;
  /** Events-only territory scope (`explore=1`, #795); null = default city hub expansion. */
  explicitTerritorySlug?: string | null;
  pageSize?: number;
}): Promise<KudaListingResult> {
  const filters = parseAppliedFromUrl(input.searchParams);
  const eventFilters = buildKudaEventFilters(input.searchParams, input.halloweenEnabled);
  // Family personas never reach the server listing (no persona IDs in URLs,
  // #799): the partition uses only explicit filters (manual age chips), so
  // `?page=N`, infinite scroll and guests all see the same membership/order.
  // Reuse the expensive global order across SSR and infinite-scroll requests
  // with identical *explicit* filters. Do not key on user/persona: the public
  // candidate set and its ranking must be independent of family membership.
  const format = parseActivityFormatQuery(input.searchParams.get("format"));
  const feed = await unstable_cache(
    async () => getKudaDiscoveryFeed(input.cityId, input.citySlug, null, {
      allCandidates: true,
      hydrateImages: false,
      rankOnly: true,
      format,
      nearby: false,
      explicitTerritorySlug: input.explicitTerritorySlug ?? null,
      eventFilters,
    }),
    [
      "kuda-ranked-candidates-v1",
      process.env.CROSS_REGION_FAMILY_THRESHOLDS ?? "",
      input.cityId,
      input.citySlug,
      input.explicitTerritorySlug ?? "",
      JSON.stringify({ format, eventFilters }),
    ],
    { revalidate: 60 },
  )();
  const partition = partitionDiscoveryFeed(filters, feed);
  const page = paginateKudaFeed(partition, input.page, input.pageSize ?? KUDA_LISTING_PAGE_SIZE);
  // The cached ranked pool has no media relation payloads. Hydrate only the
  // visible page, then restore its global rank, bucket and age hint.
  const visibleIds = page.items.map((item) => item.id);
  const details = visibleIds.length
    ? await getKudaDiscoveryFeed(input.cityId, input.citySlug, null, {
        onlyIds: visibleIds,
        take: visibleIds.length,
        format,
        nearby: false,
        explicitTerritorySlug: input.explicitTerritorySlug ?? null,
        eventFilters,
        hydrateImages: false,
      })
    : [];
  const hydrated = restoreHydratedKudaItems(page.items, details);
  const items = await withImageDimensions(hydrated, (card) => card.image);
  await recordDiscoveryExposures(items, input.cityId, input.citySlug, "kuda", null, page.offset - 1);
  return { ...page, items, pool: [...partition.primary, ...partition.secondary] };
}

/** Keep cached ordering/buckets only. Admission, paid status and reasons are live. */
export function restoreHydratedKudaItems(
  cached: KudaListingPage<ActivityMock>["items"],
  details: ActivityMock[],
): KudaListingPage<ActivityMock>["items"] {
  const byId = new Map(details.map(card => [card.id, card]));
  return cached.flatMap(item => {
    const card = byId.get(item.id);
    return card ? [{ ...card, feedBucket: item.feedBucket, ageHintBadge: item.ageHintBadge }] : [];
  });
}
