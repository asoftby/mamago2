type MetroRef = { name: string } | null | undefined;

type ActivityPlace = {
  shortAddress: string | null;
  formattedAddr: string | null;
  customAddress: string | null;
  city: { name: string } | null;
  metroAuto?: MetroRef;
  metroManual?: MetroRef;
} | null;

type ActivityForAddress = {
  place: ActivityPlace;
  venue: {
    addressLine: string | null;
    place: ActivityPlace;
  } | null;
} | null;

export type ActivityAddressLabel = {
  cityLabel: string | null;
  streetAddressLabel: string | null;
  metroLabel: string | null;
};

function streetFromPlace(place: ActivityPlace | null | undefined): string | null {
  if (!place) return null;
  const s = place.shortAddress?.trim() || place.customAddress?.trim() || null;
  if (s) return s;
  const f = place.formattedAddr?.trim();
  return f || null;
}

function metroFromPlace(place: ActivityPlace | null | undefined): string | null {
  const name = place?.metroAuto?.name?.trim() || place?.metroManual?.name?.trim() || null;
  return name ? `м. ${name}` : null;
}

/**
 * Strips data-entry noise baked directly into raw stored address text: a
 * redundant "г.<city>" / "<city>" token duplicating the already-known
 * structured city, and a "(ст.м.<name>)" / "(м. <name>)" metro parenthetical
 * (metro is sourced separately from the structured MetroStation relation —
 * see metroFromPlace — never re-extracted from free text). Only removes
 * exact known-noise patterns; never rewrites or guesses the remaining text.
 * The negative lookahead guards against partial-word matches (e.g. "Минская"
 * must never be truncated by a "Минск" city-name strip).
 */
function normalizeStreetText(raw: string, cityName: string | null): string {
  let text = raw;

  text = text
    .replace(/\(\s*ст\.?\s*м\.?[^)]*\)/gi, "")
    .replace(/\(\s*м\.?[^)]*\)/gi, "");

  if (cityName) {
    const cityEscaped = cityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cityToken = `(?:г\\.?\\s*)?${cityEscaped}(?![а-яёА-ЯЁa-zA-Z])`;
    text = text.replace(new RegExp(`^${cityToken}\\s*,?\\s*`, "i"), "");
    text = text.replace(new RegExp(`,?\\s*${cityToken}\\s*$`, "i"), "");
  }

  return text.replace(/\s{2,}/g, " ").replace(/^[,\s]+|[,\s]+$/g, "").trim();
}

/**
 * Canonical structured address projection: city, street+house, and metro
 * kept as separate labels so callers never have to re-parse a combined
 * string. Prefers structured fields (Place.city, Place.metroAuto/Manual)
 * over the raw free-text address fields, and never fabricates a missing
 * part — omits it instead.
 */
export function resolveActivityAddress(activity: ActivityForAddress): ActivityAddressLabel {
  if (!activity) return { cityLabel: null, streetAddressLabel: null, metroLabel: null };

  const place = activity.place;
  const venue = activity.venue;

  const cityLabel = place?.city?.name?.trim() || venue?.place?.city?.name?.trim() || null;

  const rawStreet =
    streetFromPlace(place) ??
    venue?.addressLine?.trim() ??
    streetFromPlace(venue?.place ?? null) ??
    null;

  const normalizedStreet = rawStreet ? normalizeStreetText(rawStreet, cityLabel) : null;
  const streetAddressLabel =
    normalizedStreet && normalizedStreet.toLowerCase() !== (cityLabel ?? "").toLowerCase()
      ? normalizedStreet
      : null;

  const metroLabel = metroFromPlace(place) ?? metroFromPlace(venue?.place ?? null);

  return { cityLabel, streetAddressLabel, metroLabel };
}

/**
 * Single combined "City, Street" string for compact inline widgets (e.g.
 * UpcomingPlanBlock) that show address alongside other metadata in one
 * line. Built from the same normalized projection as resolveActivityAddress
 * — never a second, independently-parsed implementation.
 */
export function formatActivityAddressLine(activity: ActivityForAddress): string | null {
  const { cityLabel, streetAddressLabel } = resolveActivityAddress(activity);
  if (cityLabel && streetAddressLabel) return `${cityLabel}, ${streetAddressLabel}`;
  if (streetAddressLabel) return streetAddressLabel;
  if (cityLabel) return cityLabel;
  return null;
}
