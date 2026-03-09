/**
 * Place Location String Utilities
 * Formats location information for display on public pages
 */

/**
 * Remove city name from address if it's duplicated
 * Example: "Восточная 137, Минск" → "Восточная 137"
 */
function removeCityFromAddress(address: string, cityName: string): string {
  // Remove ", CityName" or " CityName" from the end
  const patterns = [
    new RegExp(`,\\s*${cityName}\\s*$`, 'i'),
    new RegExp(`\\s+${cityName}\\s*$`, 'i'),
  ];
  
  let cleaned = address;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  return cleaned.trim();
}

/**
 * Format district name with "район" suffix if not already present
 * Example: "Московский" → "Московский район"
 * Example: "Московский район" → "Московский район" (no duplication)
 */
function formatDistrictLabel(districtName: string): string {
  const trimmed = districtName.trim();
  
  // Check if already ends with "район"
  if (trimmed.toLowerCase().endsWith('район')) {
    return trimmed;
  }
  
  return `${trimmed} район`;
}

/**
 * Add "ул." prefix to street address if not already present
 * Example: "Восточная 137" → "ул.Восточная 137"
 * Example: "ул. Восточная 137" → "ул.Восточная 137" (normalized)
 */
function addStreetPrefix(address: string): string {
  const trimmed = address.trim();
  
  // Check if already starts with "ул." or "ул "
  if (trimmed.toLowerCase().startsWith('ул.') || trimmed.toLowerCase().startsWith('ул ')) {
    // Normalize: remove space after "ул." if present
    return trimmed.replace(/^ул\.?\s*/i, 'ул.');
  }
  
  return `ул.${trimmed}`;
}

/**
 * Build location string for place hero section
 * Format: "Минск, ул.Восточная 137 · Московский район · м.Уручье"
 * 
 * Parts (joined with " · "):
 * 1. City + Address: "Минск, ул.Восточная 137" (city duplication removed, "ул." prefix added)
 * 2. District: "Московский район" (with "район" suffix)
 * 3. Metro: "м.Восток" (with "м." prefix, no space)
 * 
 * @param place - Place data with location info
 * @returns Formatted location string
 */
export function getPlaceLocationString(place: {
  city?: { name: string } | null;
  shortAddress?: string | null;
  districtAuto?: { name: string } | null;
  districtManual?: { name: string } | null;
  metroAuto?: { name: string } | null;
  metroManual?: { name: string } | null;
}): string {
  const parts: string[] = [];

  // Part 1: City + Address (remove city duplication, add "ул." prefix)
  if (place.city?.name) {
    if (place.shortAddress) {
      const cleanAddress = removeCityFromAddress(place.shortAddress, place.city.name);
      const addressWithPrefix = addStreetPrefix(cleanAddress);
      parts.push(`${place.city.name}, ${addressWithPrefix}`);
    } else {
      parts.push(place.city.name);
    }
  } else if (place.shortAddress) {
    const addressWithPrefix = addStreetPrefix(place.shortAddress);
    parts.push(addressWithPrefix);
  }

  // Part 2: District (prefer manual over auto, add "район" suffix)
  const district = place.districtManual || place.districtAuto;
  if (district?.name) {
    parts.push(formatDistrictLabel(district.name));
  }

  // Part 3: Metro (prefer manual over auto, add "м." prefix without space)
  const metro = place.metroManual || place.metroAuto;
  if (metro?.name) {
    parts.push(`м.${metro.name}`);
  }

  return parts.join(" · ");
}
