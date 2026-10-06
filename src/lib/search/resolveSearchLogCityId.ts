import { findCityBySlug } from "@/server/geo/findCityBySlug";

export type SearchCityLookup =
  | { kind: "slug"; slug: string }
  | { kind: "legacy"; cityId: string }
  | { kind: "none" };

/**
 * Prefer citySlug (public contract). Legacy cityId only when slug is absent.
 */
export function pickSearchCityLookup(input: {
  citySlug?: string | null;
  legacyCityId?: string | null;
}): SearchCityLookup {
  const slug = input.citySlug?.trim();
  if (slug) return { kind: "slug", slug };

  const legacy = input.legacyCityId?.trim();
  if (legacy) return { kind: "legacy", cityId: legacy };

  return { kind: "none" };
}

/**
 * Resolve which cityId to attach to SearchQueryLog.
 *
 * Prefer `citySlug` (public contract). Legacy `cityId` is accepted only when
 * slug is absent, for older callers. Unknown slug → null (do not invent Minsk).
 * Search results/ranking must not depend on this resolution.
 */
export async function resolveSearchLogCityId(input: {
  citySlug?: string | null;
  legacyCityId?: string | null;
}): Promise<string | null> {
  const pick = pickSearchCityLookup(input);
  if (pick.kind === "slug") {
    const city = await findCityBySlug(pick.slug, {
      onlyRealCities: true,
      select: { id: true },
    });
    return city?.id ?? null;
  }
  if (pick.kind === "legacy") return pick.cityId;
  return null;
}
