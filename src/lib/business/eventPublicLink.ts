import { VALID_CITY_SLUGS } from "@/lib/intent";

/** Городской slug для ссылки на карточку события (form `city` может быть id или slug). */
export function resolveCitySlugForPublicActivity(cityField: string | undefined | null): string {
  const t = (cityField ?? "").trim();
  if (VALID_CITY_SLUGS.includes(t as (typeof VALID_CITY_SLUGS)[number])) {
    return t;
  }
  return VALID_CITY_SLUGS[0];
}

/** Сегмент URL: предпочитаем SEO-slug, иначе id (черновики без slug). */
export function activityPublicPathSegment(
  slug: string | null | undefined,
  activityId: string,
): string {
  const s = typeof slug === "string" ? slug.trim() : "";
  return s.length > 0 ? s : activityId;
}

/** Сегмент публичного URL для карточки события (не путать с типом `Activity` в БД). */
export const PUBLIC_EVENT_PATH_SEGMENT = "events";

/**
 * Публичная страница события: `/{city}/events/{slug|id}`.
 * Если `activitySlug` задан — в пути только slug (canonical для SEO).
 */
export function publicActivityPath(
  activityId: string,
  cityField: string | undefined | null,
  activitySlug?: string | null,
): string {
  const citySlug = resolveCitySlugForPublicActivity(cityField);
  const seg = activityPublicPathSegment(activitySlug ?? null, activityId);
  return `/${citySlug}/${PUBLIC_EVENT_PATH_SEGMENT}/${seg}`;
}
