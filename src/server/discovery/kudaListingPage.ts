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
  const feed = await getKudaDiscoveryFeed(input.cityId, input.citySlug, input.userId, {
      allCandidates: true,
      hydrateImages: false,
      format: parseActivityFormatQuery(input.searchParams.get("format")),
      nearby: false,
      explicitTerritorySlug: input.explicitTerritorySlug ?? null,
      eventFilters,
  });
  const partition = partitionDiscoveryFeed(filters, feed);
  const page = paginateKudaFeed(partition, input.page, input.pageSize ?? KUDA_LISTING_PAGE_SIZE);
  const items = await withImageDimensions(page.items, (card) => card.image);
  return { ...page, items, pool: [...partition.primary, ...partition.secondary] };
}
