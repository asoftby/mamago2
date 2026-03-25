import { VALID_CITY_SLUGS } from "@/lib/intent";

/** Городской slug для ссылки на карточку события (form `city` может быть id или slug). */
export function resolveCitySlugForPublicActivity(cityField: string | undefined | null): string {
  const t = (cityField ?? "").trim();
  if (VALID_CITY_SLUGS.includes(t as (typeof VALID_CITY_SLUGS)[number])) {
    return t;
  }
  return VALID_CITY_SLUGS[0];
}

/** Публичная страница события в формате `/{city}/activity/{id}`. */
export function publicActivityPath(
  eventId: string,
  cityField: string | undefined | null
): string {
  const slug = resolveCitySlugForPublicActivity(cityField);
  return `/${slug}/activity/${eventId}`;
}
