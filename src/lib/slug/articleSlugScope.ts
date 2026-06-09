/**
 * Article slug uniqueness scope — mirrors Prisma partial unique index (cityId, slug).
 * National articles: cityId IS NULL; city articles: cityId IS NOT NULL.
 */
export function articleSlugScopeKey(cityId: string | null | undefined): string {
  return cityId ?? "__national__";
}

export function articleSlugScopeWhere(
  slug: string,
  cityId: string | null | undefined,
): { slug: string; cityId: string | null } {
  return { slug, cityId: cityId ?? null };
}

export function articlesShareSlugScope(
  aCityId: string | null | undefined,
  bCityId: string | null | undefined,
): boolean {
  return articleSlugScopeKey(aCityId) === articleSlugScopeKey(bCityId);
}
