/**
 * Normalises Google Places API (New) address components — which use
 * `longText`/`shortText` — into the legacy `long_name`/`short_name` shape
 * that the rest of mamaGo (server enrichment, extractCityFromAddress, etc.)
 * still expects.
 */

export type NewAddressComponent = {
  longText?: string | null;
  shortText?: string | null;
  types?: string[];
};

export type LegacyAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export function toLegacyAddressComponents(
  components: NewAddressComponent[] | undefined | null,
): LegacyAddressComponent[] {
  if (!Array.isArray(components)) return [];
  return components.map((c) => ({
    long_name: c.longText ?? c.shortText ?? "",
    short_name: c.shortText ?? c.longText ?? "",
    types: c.types ?? [],
  }));
}
