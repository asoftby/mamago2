type ActivityPlace = {
  shortAddress: string | null;
  formattedAddr: string | null;
  customAddress: string | null;
  city: { name: string } | null;
} | null;

type ActivityForAddress = {
  place: ActivityPlace;
  venue: {
    addressLine: string | null;
    place: ActivityPlace;
  } | null;
} | null;

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
  activity: ActivityForAddress,
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
