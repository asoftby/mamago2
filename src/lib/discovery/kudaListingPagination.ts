/** Client-safe pagination contract for the afisha («Куда пойти») masonry listing. */

import {
  applyImplicitListingParams,
  type ImplicitListingFilters,
} from "@/features/filters/discovery/discoveryFilterParams";

export const KUDA_LISTING_PAGE_SIZE = 24;

export type FeedBucket = "primary" | "secondary";

export type KudaListingPage<T> = {
  page: number;
  totalPages: number;
  total: number;
  /** Items of this page in feed order; `secondary` items always follow all `primary` ones. */
  items: Array<T & { feedBucket: FeedBucket }>;
  /** Global 1-based position of the first item on this page. */
  offset: number;
  secondaryHeading: string | null;
};

/**
 * Pages are cut from the fully ranked + partitioned feed, so the order is the
 * same whether a user scrolls page by page or a crawler opens `?page=N`.
 * Out-of-range pages return no items (the route decides on 404).
 */
export function paginateKudaFeed<T>(
  partition: { primary: T[]; secondary: T[]; secondaryHeading: string | null },
  requestedPage: number,
  pageSize: number = KUDA_LISTING_PAGE_SIZE,
): KudaListingPage<T> {
  const all = [
    ...partition.primary.map((item) => ({ ...item, feedBucket: "primary" as const })),
    ...partition.secondary.map((item) => ({ ...item, feedBucket: "secondary" as const })),
  ];
  const size = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(all.length / size));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const start = (page - 1) * size;
  return {
    page,
    totalPages,
    total: all.length,
    items: all.slice(start, start + size),
    offset: start + 1,
    secondaryHeading: partition.secondary.length > 0 ? partition.secondaryHeading : null,
  };
}

/** `?page=N` URL for a listing path, keeping the other query params. */
export function listingPageHref(pathname: string, query: string, page: number): string {
  const params = new URLSearchParams(query);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Query for `/api/discovery/events/page`: the current listing URL + next page +
 * listing city + route-implied filters (category hub), so every appended page
 * is cut from the same result set as the SSR render.
 */
export function buildNextPageParams(
  search: string,
  input: { page: number; citySlug: string; implicitFilters?: ImplicitListingFilters | null },
): URLSearchParams {
  const params = applyImplicitListingParams(new URLSearchParams(search), input.implicitFilters);
  params.set("page", String(input.page));
  params.set("listingCity", input.citySlug);
  return params;
}
