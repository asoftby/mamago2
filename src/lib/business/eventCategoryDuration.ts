/**
 * Категории событий, для которых осмыслена единая «Продолжительность» одного
 * сеанса/посещения. Кодовый slug-set (не колонка БД, не сид) — по образцу
 * isCinemaEventCategorySlug (src/lib/business/eventCategoryCinema.ts).
 *
 * Слаги — фактические корневые из prisma/seed/event-categories.ts.
 */
export const EVENT_DURATION_CATEGORY_SLUGS = [
  "cinema",
  "excursions",
  "workshops",
  "theatre",
  "shows",
  "classes",
  "play-programs",
] as const;

const DURATION_SLUGS: ReadonlySet<string> = new Set(EVENT_DURATION_CATEGORY_SLUGS);

/** true, если у категории (по корневому slug) есть поле «Продолжительность». */
export function supportsDurationForCategorySlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return DURATION_SLUGS.has(slug.trim().toLowerCase());
}
