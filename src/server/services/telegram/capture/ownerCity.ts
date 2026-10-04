import type { PlanOwner } from "@/server/services/planOwner";

/**
 * City used to scope place matching. There is no authoritative per-user city
 * setting in the schema today (User has no city; plan notifications only carry
 * a time zone), so every owner resolves to the product default, Minsk. The
 * resolver shape is the extension point: a real source (user/family setting)
 * is added here later without touching the place matcher.
 */
export const FALLBACK_CITY_SLUG = "minsk";

export type OwnerCity = {
  slug: string;
  cityId: string | null;
  source: "FALLBACK_MINSK";
};

export type OwnerCityDeps = {
  findCityIdBySlug: (slug: string) => Promise<string | null>;
};

export async function resolveOwnerCity(deps: OwnerCityDeps, owner: PlanOwner): Promise<OwnerCity> {
  void owner; // reserved for a per-user/family city source
  const cityId = await deps.findCityIdBySlug(FALLBACK_CITY_SLUG);
  return { slug: FALLBACK_CITY_SLUG, cityId, source: "FALLBACK_MINSK" };
}
