/**
 * Safe pagination parameter parser for admin API routes.
 *
 * Clamps limit to a safe range to prevent abuse via ?limit=999999.
 *
 * Defaults:
 * - defaultLimit: 20
 * - maxLimit: 100
 * - minLimit: 1
 * - page minimum: 1
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationOptions {
  /** Default limit when not specified (default: 20) */
  defaultLimit?: number;
  /** Maximum allowed limit (default: 100) */
  maxLimit?: number;
  /** Minimum allowed limit (default: 1) */
  minLimit?: number;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options?: PaginationOptions
): PaginationParams {
  const defaultLimit = options?.defaultLimit ?? 20;
  const maxLimit = options?.maxLimit ?? 100;
  const minLimit = options?.minLimit ?? 1;

  const rawPage = parseInt(searchParams.get("page") ?? "", 10);
  const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const limit = Math.min(
    maxLimit,
    Math.max(minLimit, Number.isFinite(rawLimit) ? rawLimit : defaultLimit)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}