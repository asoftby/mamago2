/**
 * Format Short Address for Media Metadata
 * 
 * Builds clean, human-readable short address from place data.
 * Only includes parts that exist, no empty commas.
 */

export interface PlaceAddressData {
  cityName?: string | null;
  shortAddress?: string | null;
}

/**
 * Format short address for metadata
 * 
 * Examples:
 * - "Минск, Ратомская, 7"
 * - "Минск, Ратомская"
 * - "Минск"
 * - null (if no data)
 */
export function formatShortAddress(place: PlaceAddressData): string | null {
  // If shortAddress already contains city, use it as-is
  if (place.shortAddress) {
    return place.shortAddress;
  }

  // Otherwise, just return city
  if (place.cityName) {
    return place.cityName;
  }

  return null;
}

/**
 * Format city only (for title)
 */
export function formatCityForTitle(place: PlaceAddressData): string | null {
  return place.cityName || null;
}
