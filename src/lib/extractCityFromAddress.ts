/**
 * Extract city information from Google address components
 * 
 * For Belarus, we primarily look for "locality" (город) in address components.
 * Falls back to a hardcoded Minsk cityId for now.
 */

// TODO: Replace with actual cityId from database
// This is a temporary hardcoded value for Minsk
const MINSK_CITY_ID = "minsk-temp-id";

export function extractCityIdFromAddressComponents(
  addressComponents: google.maps.GeocoderAddressComponent[]
): string | null {
  // Look for locality (city)
  const locality = addressComponents.find((component) =>
    component.types.includes("locality")
  );

  if (locality) {
    // For now, if it's Minsk, return hardcoded ID
    // TODO: Query database to get actual cityId by name
    if (locality.long_name === "Минск" || locality.long_name === "Minsk") {
      return MINSK_CITY_ID;
    }
  }

  // Fallback: assume Minsk for Belarus addresses
  const country = addressComponents.find((component) =>
    component.types.includes("country")
  );

  if (country && country.short_name === "BY") {
    return MINSK_CITY_ID;
  }

  return null;
}
