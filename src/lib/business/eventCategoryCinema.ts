/** Доп. поля «кино» — по slug категории из Discovery (не по захардкоженному названию). */
export function isCinemaEventCategorySlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  const s = slug.trim().toLowerCase();
  return s === "kino" || s === "cinema" || s === "movie" || s === "movies";
}
