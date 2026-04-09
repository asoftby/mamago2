/** Сопоставление сохранённого `cityContext` (name или slug) с городом из справочника. */
export function matchCitySlugFromContext(
  cityContext: string | null | undefined,
  cities: { slug: string; name: string }[],
): string {
  const t = (cityContext ?? "").trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  const byName = cities.find((c) => c.name === t);
  if (byName) return byName.slug;
  const bySlug = cities.find((c) => c.slug === lower);
  if (bySlug) return bySlug.slug;
  return "";
}

export function cityNameFromSlug(
  slug: string | null | undefined,
  cities: { slug: string; name: string }[],
): string {
  const s = slug?.trim();
  if (!s) return "";
  return cities.find((c) => c.slug === s)?.name ?? "";
}
