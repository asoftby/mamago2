import type { PlanItemWithActivity } from "../types/event";

type ActivityPlace = NonNullable<PlanItemWithActivity["activity"]>["place"];

function streetFromPlace(place: ActivityPlace | null | undefined): string | null {
  if (!place) return null;
  const s =
    place.shortAddress?.trim() ||
    place.customAddress?.trim() ||
    null;
  if (s) return s;
  const f = place.formattedAddr?.trim();
  return f || null;
}

/**
 * Одна строка: город, улица и дом (без района).
 */
export function formatActivityAddressLine(
  activity: PlanItemWithActivity["activity"],
): string | null {
  if (!activity) return null;

  const place = activity.place;
  const venue = activity.venue;

  const cityName =
    place?.city?.name?.trim() ?? venue?.place?.city?.name?.trim() ?? null;

  const streetHouse =
    streetFromPlace(place) ??
    venue?.addressLine?.trim() ??
    streetFromPlace(venue?.place ?? null) ??
    null;

  if (cityName && streetHouse) {
    return `${cityName}, ${streetHouse}`;
  }
  if (streetHouse) {
    return streetHouse;
  }
  if (cityName) {
    return cityName;
  }

  const fallback =
    place?.formattedAddr?.trim() ?? venue?.place?.formattedAddr?.trim() ?? null;
  return fallback || null;
}
