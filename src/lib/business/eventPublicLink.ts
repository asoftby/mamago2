import { DEFAULT_CITY_SLUG } from "@/lib/intent";

function isUsableCitySlug(value: string | undefined | null): value is string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 && !trimmed.includes("/") && /^[a-z-]+$/i.test(trimmed);
}

/** Городской slug для ссылки на карточку события (form `city` может быть id или slug). */
export function resolveCitySlugForPublicActivity(cityField: string | undefined | null): string {
  const t = (cityField ?? "").trim();
  if (isUsableCitySlug(t)) {
    return t;
  }
  return DEFAULT_CITY_SLUG;
}

function firstValidCitySlug(
  values: Array<string | undefined | null>,
): string | null {
  for (const value of values) {
    const trimmed = (value ?? "").trim();
    if (!trimmed) continue;
    if (isUsableCitySlug(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Канонический city slug для публичной ссылки события.
 * Приоритет соответствует фактической привязке события, а не текущему UI context:
 * 1. `Activity.city`
 * 2. `Place.city`
 * 3. `EventVenue.city`
 * 4. legacy/form `cityField`, если это уже slug
 */
export function resolveCanonicalCitySlugForEvent(input: {
  activityCitySlug?: string | null;
  placeCitySlug?: string | null;
  venueCitySlug?: string | null;
  cityField?: string | null;
}): string {
  return (
    firstValidCitySlug([
      input.activityCitySlug,
      input.placeCitySlug,
      input.venueCitySlug,
      input.cityField,
    ]) ?? DEFAULT_CITY_SLUG
  );
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

export function canonicalPublicActivityPath(input: {
  activityId: string;
  activitySlug?: string | null;
  activityCitySlug?: string | null;
  placeCitySlug?: string | null;
  venueCitySlug?: string | null;
  cityField?: string | null;
}): string {
  const citySlug = resolveCanonicalCitySlugForEvent({
    activityCitySlug: input.activityCitySlug,
    placeCitySlug: input.placeCitySlug,
    venueCitySlug: input.venueCitySlug,
    cityField: input.cityField,
  });
  const seg = activityPublicPathSegment(input.activitySlug ?? null, input.activityId);
  return `/${citySlug}/${PUBLIC_EVENT_PATH_SEGMENT}/${seg}`;
}
