/**
 * Normalizes Google Place address_components into Country / Region / City fields.
 * Google is a hint only — never treat administrative_area_level_1 as City.
 */

import { isCityNameAllowed } from "@/server/geo/city-resolver";

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type ExtractedGeoFromGooglePlace = {
  countryName: string | null;
  countryCode: string | null;
  regionName: string | null;
  cityName: string | null;
  needsReview: boolean;
  rejectedAsCity: Array<{ name: string; reason: string; types: string[] }>;
};

const FORBIDDEN_CITY_TYPES = new Set([
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "administrative_area_level_4",
  "administrative_area_level_5",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "route",
  "street_number",
  "country",
]);

function pickComponent(
  components: GoogleAddressComponent[],
  type: string,
): GoogleAddressComponent | undefined {
  return components.find((c) => c.types.includes(type));
}

/**
 * @param addressComponents Google Geocoding API address_components
 */
export function extractGeoFromGooglePlace(
  addressComponents: GoogleAddressComponent[],
): ExtractedGeoFromGooglePlace {
  const rejectedAsCity: ExtractedGeoFromGooglePlace["rejectedAsCity"] = [];

  const country = pickComponent(addressComponents, "country");
  const region = pickComponent(addressComponents, "administrative_area_level_1");

  let cityName: string | null = null;
  for (const allowedType of ["locality", "postal_town"] as const) {
    const comp = pickComponent(addressComponents, allowedType);
    if (!comp?.long_name) continue;
    if (!isCityNameAllowed(comp.long_name)) {
      rejectedAsCity.push({
        name: comp.long_name,
        reason: `Name looks like administrative region despite type "${allowedType}"`,
        types: comp.types,
      });
      continue;
    }
    cityName = comp.long_name;
    break;
  }

  for (const comp of addressComponents) {
    const forbidden = comp.types.find((t) => FORBIDDEN_CITY_TYPES.has(t));
    if (!forbidden) continue;
    if (forbidden === "country") continue;
    rejectedAsCity.push({
      name: comp.long_name,
      reason: `Component type "${forbidden}" cannot be used as City`,
      types: comp.types,
    });
  }

  const regionName = region?.long_name ?? null;
  const hasOnlyRegion =
    !cityName && Boolean(regionName) && rejectedAsCity.some((r) => r.types.includes("administrative_area_level_1"));

  return {
    countryName: country?.long_name ?? null,
    countryCode: country?.short_name ?? null,
    regionName,
    cityName,
    needsReview: hasOnlyRegion || (!cityName && rejectedAsCity.length > 0),
    rejectedAsCity,
  };
}
