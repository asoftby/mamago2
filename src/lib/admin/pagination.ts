/**
 * Shared server-side pagination for full admin list pages (`/admin/**`).
 *
 * Single source of truth for page size, `?page=` parsing, and the skip/take/
 * totalPages math every admin list page needs. Do not hand-roll this per page.
 *
 * Usage (server component):
 *   const page = parseAdminPage(searchParams.page);
 *   const total = await prisma.place.count({ where });
 *   const pagination = getAdminPagination({ page, total });
 *   const rows = await prisma.place.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take });
 *
 * count() and findMany() are run sequentially (not `$transaction`) on purpose:
 * `getAdminPagination` clamps an out-of-range requested page down to the last
 * real page using `total`, and that clamped value feeds the `skip` used by
 * findMany. There is no way to know the clamped skip before the count comes
 * back, so the two calls can't be parallelized without risking an empty page
 * for a stale/out-of-range `?page=`.
 */

export const ADMIN_PAGE_SIZE = 25;

/**
 * Parses the `page` search param. Missing, non-numeric, non-integer, zero,
 * negative, or fractional values all fall back to `1`. Never throws.
 */
export function parseAdminPage(raw: string | undefined | null): number {
  if (!raw) return 1;
  if (!/^\d+$/.test(raw)) return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

export interface AdminPaginationInput {
  /** Requested page, e.g. from `parseAdminPage`. */
  page: number;
  /** Total row count for the current filters (from `count()`). */
  total: number;
  /** Fixed page size; defaults to `ADMIN_PAGE_SIZE`. */
  pageSize?: number;
}

export interface AdminPaginationResult {
  /** The requested page, clamped into `[1, totalPages]` (or `1` if `total` is 0). */
  page: number;
  pageSize: number;
  total: number;
  /** `0` when `total` is 0, otherwise `ceil(total / pageSize)`. */
  totalPages: number;
  /** Pass straight to `findMany({ skip })`. */
  skip: number;
  /** Pass straight to `findMany({ take })`. */
  take: number;
  /** 1-indexed first row shown on this page; `0` when `total` is 0. */
  start: number;
  /** 1-indexed last row shown on this page; `0` when `total` is 0. */
  end: number;
}

export function getAdminPagination({
  page,
  total,
  pageSize = ADMIN_PAGE_SIZE,
}: AdminPaginationInput): AdminPaginationResult {
  const safeTotal = Math.max(0, total);
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const skip = (safePage - 1) * pageSize;
  const take = pageSize;
  const start = safeTotal === 0 ? 0 : skip + 1;
  const end = safeTotal === 0 ? 0 : Math.min(skip + pageSize, safeTotal);

  return {
    page: safePage,
    pageSize,
    total: safeTotal,
    totalPages,
    skip,
    take,
    start,
    end,
  };
}

/** A page number, or `"…"` for a collapsed gap in a compact page range. */
export type AdminPageRangeItem = number | "…";

/**
 * Builds the list of page numbers/ellipses to render. Shows every page when
 * there are few; otherwise keeps the first, last, current page, and its
 * immediate neighbors, collapsing the rest into a single `"…"` per side.
 */
export function getAdminPageRange(
  current: number,
  totalPages: number,
  siblingCount = 1,
): AdminPageRangeItem[] {
  if (totalPages <= 0) return [];

  const totalNumbersWhenNoEllipsis = siblingCount * 2 + 5; // first, last, current, 2 ellipses worth of siblings
  if (totalPages <= totalNumbersWhenNoEllipsis) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  const items: AdminPageRangeItem[] = [1];

  if (showLeftEllipsis) {
    items.push("…");
  } else {
    for (let p = 2; p < leftSibling; p++) items.push(p);
  }

  for (let p = leftSibling; p <= rightSibling; p++) {
    if (p !== 1 && p !== totalPages) items.push(p);
  }

  if (showRightEllipsis) {
    items.push("…");
  } else {
    for (let p = rightSibling + 1; p < totalPages; p++) items.push(p);
  }

  items.push(totalPages);

  return items;
}

/**
 * Builds an href for a given page, preserving every other existing query
 * param. Accepts `URLSearchParams` or a plain record (from a server
 * component's `searchParams`).
 */
export function buildAdminPageHref(
  basePath: string,
  currentParams: URLSearchParams | Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();

  const entries =
    currentParams instanceof URLSearchParams
      ? Array.from(currentParams.entries())
      : Object.entries(currentParams).flatMap(([key, value]): [string, string][] => {
          if (value === undefined) return [];
          if (Array.isArray(value)) return value.map((v): [string, string] => [key, v]);
          return [[key, value]];
        });

  for (const [key, value] of entries) {
    if (key === "page") continue;
    params.append(key, value);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}
