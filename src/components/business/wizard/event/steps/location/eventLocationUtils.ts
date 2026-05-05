/**
 * Event Location Utilities
 * Helper functions for processing location data in Event context
 */

type AddressComponent = {
  types: string[];
  long_name: string;
  short_name: string;
};

/**
 * Extract city information from Google Places address components
 */
export function extractCityFromAddressComponents(addressComponents: AddressComponent[]): {
  cityId: string | null;
  district: string | null;
} {
  let cityId: string | null = null;
  let district: string | null = null;

  for (const component of addressComponents) {
    const types = component.types || [];
    
    // Look for city/locality — ONLY locality is allowed, NOT administrative_area_level_2
    // administrative_area_level_2 can be a district/rayon, not a city
    if (types.includes('locality')) {
      cityId = component.long_name;
    }
    
    // Look for district/sublocality
    if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
      district = component.long_name;
    }
  }

  return { cityId, district };
}

/**
 * Format address for display
 */
export function formatEventLocationAddress(data: {
  venueName?: string;
  address?: string;
  city?: string;
}): string {
  const parts: string[] = [];
  
  if (data.venueName) {
    parts.push(data.venueName);
  }
  
  if (data.address) {
    parts.push(data.address);
  }
  
  if (data.city) {
    parts.push(data.city);
  }
  
  return parts.join(' • ');
}

/**
 * Determine venue name from Google Places data
 */
export function extractVenueNameFromPlace(place: {
  name?: string;
  formatted_address?: string;
}): string {
  // Use place name if available, otherwise extract from formatted address
  if (place.name && place.name !== place.formatted_address) {
    return place.name;
  }
  
  // Extract first part of formatted address as venue name
  if (place.formatted_address) {
    const parts = place.formatted_address.split(',');
    return parts[0].trim();
  }
  
  return '';
}

/**
 * Load districts for a city
 */
export async function loadDistricts(cityIdOrSlug: string): Promise<Array<{ id: string; name: string }>> {
  try {
    // Handle common city names by converting to known slugs
    const cityNameToSlug: Record<string, string> = {
      'Минск': 'minsk',
      'Minsk': 'minsk',
      'минск': 'minsk',
    };
    
    let resolvedInput = cityIdOrSlug;
    if (cityNameToSlug[cityIdOrSlug]) {
      console.log('[loadDistricts] Converting city name to slug:', cityIdOrSlug, '->', cityNameToSlug[cityIdOrSlug]);
      resolvedInput = cityNameToSlug[cityIdOrSlug];
    }
    
    // Determine if it's a CUID/UUID (cityId) or slug
    // CUID format: cmmj3p3uh0011ws3mmxhskmsf (25 chars, alphanumeric)
    // UUID format: 550e8400-e29b-41d4-a716-446655440000 (36 chars with dashes)
    const isCUID = /^c[a-z0-9]{24}$/i.test(resolvedInput);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedInput);
    const isId = isCUID || isUUID;
    
    const param = isId ? `cityId=${encodeURIComponent(resolvedInput)}` : `citySlug=${encodeURIComponent(resolvedInput)}`;
    
    console.log('[loadDistricts] Using param:', param, 'for input:', cityIdOrSlug, 'resolved to:', resolvedInput);
    
    const response = await fetch(`/api/geo/districts?${param}`);
    if (!response.ok) {
      console.error('[loadDistricts] API error:', response.status, response.statusText);
      
      // Try to get error details
      try {
        const errorData = await response.text();
        console.error('[loadDistricts] Error details:', errorData);
      } catch (e) {
        // Ignore error parsing error
      }
      
      return [];
    }
    
    const data = await response.json();
    return data.districts || [];
  } catch (err) {
    console.error('[loadDistricts] Error:', err);
    return [];
  }
}

/**
 * Load metro stations for a city
 */
export async function loadMetroStations(cityIdOrSlug: string): Promise<Array<{ id: string; name: string }>> {
  try {
    // Handle common city names by converting to known slugs
    const cityNameToSlug: Record<string, string> = {
      'Минск': 'minsk',
      'Minsk': 'minsk',
      'минск': 'minsk',
    };
    
    let resolvedInput = cityIdOrSlug;
    if (cityNameToSlug[cityIdOrSlug]) {
      console.log('[loadMetroStations] Converting city name to slug:', cityIdOrSlug, '->', cityNameToSlug[cityIdOrSlug]);
      resolvedInput = cityNameToSlug[cityIdOrSlug];
    }
    
    // Determine if it's a CUID/UUID (cityId) or slug
    // CUID format: cmmj3p3uh0011ws3mmxhskmsf (25 chars, alphanumeric)
    // UUID format: 550e8400-e29b-41d4-a716-446655440000 (36 chars with dashes)
    const isCUID = /^c[a-z0-9]{24}$/i.test(resolvedInput);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedInput);
    const isId = isCUID || isUUID;
    
    const param = isId ? `cityId=${encodeURIComponent(resolvedInput)}` : `citySlug=${encodeURIComponent(resolvedInput)}`;
    
    console.log('[loadMetroStations] Using param:', param, 'for input:', cityIdOrSlug, 'resolved to:', resolvedInput);
    
    const response = await fetch(`/api/geo/metro-stations?${param}`);
    if (!response.ok) {
      console.error('[loadMetroStations] API error:', response.status, response.statusText);
      
      // Try to get error details
      try {
        const errorData = await response.text();
        console.error('[loadMetroStations] Error details:', errorData);
      } catch (e) {
        // Ignore error parsing error
      }
      
      return [];
    }
    
    const data = await response.json();
    return data.metroStations || [];
  } catch (err) {
    console.error('[loadMetroStations] Error:', err);
    return [];
  }
}

/**
 * Enrich location with district and metro data
 */
export async function enrichEventLocation(data: {
  lat: number;
  lng: number;
  cityId?: string;
  formattedAddr?: string;
  addressJson?: unknown[];
}): Promise<{
  cityId?: string;
  districtAutoId?: string | null;
  metroAutoId?: string | null;
  metroAutoDistanceM?: number | null;
  districtName?: string | null;
  metroName?: string | null;
} | null> {
  try {
    const response = await fetch('/api/geo/enrich-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: data.lat,
        lng: data.lng,
        cityId: data.cityId,
        formattedAddr: data.formattedAddr,
        addressJson: data.addressJson || [],
      }),
    });

    if (!response.ok) {
      console.error('[enrichEventLocation] API error:', response.status, response.statusText);
      
      // Try to get error details
      try {
        const errorData = await response.text();
        console.error('[enrichEventLocation] Error details:', errorData);
      } catch (e) {
        // Ignore error parsing error
      }
      
      return null;
    }

    const result = await response.json();
    return {
      cityId: result.cityId,
      districtAutoId: result.districtAutoId,
      metroAutoId: result.metroAutoId,
      metroAutoDistanceM: result.metroAutoDistanceM,
      districtName: result.districtName,
      metroName: result.metroName,
    };
  } catch (err) {
    console.error('[enrichEventLocation] Error:', err);
    
    return null;
  }
}

/**
 * Format distance for display
 */
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) {
    return `${Math.round(distanceM)} м`;
  } else {
    return `${(distanceM / 1000).toFixed(1)} км`;
  }
}
