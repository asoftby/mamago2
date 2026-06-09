import { unstable_cache } from "next/cache";
import { findCityBySlug } from "@/server/geo/findCityBySlug";

const RESOLVE_CITY_ID_REVALIDATE_SECONDS = 60 * 60;

async function readCityIdBySlug(citySlug: string): Promise<string | null> {
  const city = await findCityBySlug(citySlug, { select: { id: true } });
  return city?.id ?? null;
}

/**
 * Shared cached resolver for geo reference-data routes that accept `citySlug`.
 *
 * Notes:
 * - `unstable_cache` is safe here because city slug → city id is reference data.
 * - We intentionally cache null as well to avoid duplicate misses when both
 *   geo endpoints are requested for an unknown slug.
 * - TTL-based revalidation is enough for this phase; admin-side invalidation of
 *   edited city slugs can be added later if needed.
 */
export async function resolveCityIdBySlug(citySlug: string): Promise<string | null> {
  return unstable_cache(
    async () => readCityIdBySlug(citySlug),
    [`geo-city-id-by-slug:${citySlug}`],
    { revalidate: RESOLVE_CITY_ID_REVALIDATE_SECONDS },
  )();
}
