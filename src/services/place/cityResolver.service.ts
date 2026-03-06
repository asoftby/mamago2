/**
 * City Resolver Service
 * 
 * Resolves cityId from coordinates (primary) and address parsing (helper).
 * 
 * Resolution Strategy:
 * 1. Coordinate-based (PRIMARY): Find nearest city within radiusKm
 * 2. Address parsing (HELPER): Extract city from Google addressJson for validation
 * 3. Manual fallback: Return null, UI prompts user to select city
 */

import prisma from "@/lib/prisma";

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate distance using Haversine formula
 * Returns distance in kilometers
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c;
}

/**
 * Extract city name and country code from Google address_components
 * Priority: locality > administrative_area_level_2 > administrative_area_level_1
 */
function extractCityFromAddressComponents(
  addressComponents: any[]
): { cityName: string | null; countryCode: string | null } {
  let cityName: string | null = null;
  let countryCode: string | null = null;

  // Extract country code
  const countryComponent = addressComponents.find((c) =>
    c.types?.includes("country")
  );
  if (countryComponent) {
    countryCode = countryComponent.short_name || null;
  }

  // Extract city name with priority
  const priorities = [
    "locality",
    "administrative_area_level_2",
    "administrative_area_level_1",
  ];

  for (const type of priorities) {
    const component = addressComponents.find((c) => c.types?.includes(type));
    if (component?.long_name) {
      cityName = component.long_name;
      break;
    }
  }

  return { cityName, countryCode };
}

/**
 * Resolve city by coordinates (PRIMARY METHOD)
 * Finds nearest city center within city.radiusKm
 */
async function resolveCityByCoordinates(
  lat: number,
  lng: number,
  countryCode?: string | null
): Promise<{ cityId: string; cityName: string; distance: number } | null> {
  try {
    console.log(`[cityResolver] Resolving by coordinates: ${lat}, ${lng}, country: ${countryCode || "any"}`);

    // Get all cities with center coordinates (optionally filter by country if we add that field later)
    const cities = await prisma.city.findMany({
      where: {
        centerLat: { not: null },
        centerLng: { not: null },
        radiusKm: { not: null },
      },
      select: {
        id: true,
        name: true,
        centerLat: true,
        centerLng: true,
        radiusKm: true,
      },
    });

    if (cities.length === 0) {
      console.log("[cityResolver] No cities with center coordinates and radius found");
      return null;
    }

    console.log(`[cityResolver] Checking ${cities.length} cities`);

    // Find nearest city within its radius
    let nearestCity: { id: string; name: string; distance: number } | null = null;

    for (const city of cities) {
      if (city.centerLat === null || city.centerLng === null || city.radiusKm === null) continue;

      const distance = haversineKm(lat, lng, city.centerLat, city.centerLng);

      console.log(`[cityResolver] ${city.name}: ${distance.toFixed(2)}km (radius: ${city.radiusKm}km)`);

      // Check if within city radius
      if (distance <= city.radiusKm) {
        if (!nearestCity || distance < nearestCity.distance) {
          nearestCity = { cityId: city.id, cityName: city.name, distance };
        }
      }
    }

    if (nearestCity) {
      console.log(
        `[cityResolver] ✅ Matched city by coordinates: ${nearestCity.cityName} (${nearestCity.distance.toFixed(2)}km from center)`
      );
      return nearestCity;
    }

    console.log(`[cityResolver] ⚠️ No city found within radius for coordinates`);
    return null;
  } catch (error) {
    console.error("[cityResolver] Error resolving by coordinates:", error);
    return null;
  }
}

/**
 * Resolve city by Google address_components (HELPER METHOD)
 * Used to validate coordinate-based resolution or provide hints
 * 
 * Handles multiple language variants:
 * - Belarusian: Мінск
 * - Russian: Минск  
 * - English: Minsk
 */
async function resolveCityByAddressComponents(
  addressJson: any
): Promise<{ cityId: string; cityName: string } | null> {
  try {
    if (!addressJson || !Array.isArray(addressJson)) {
      return null;
    }

    const { cityName, countryCode } = extractCityFromAddressComponents(addressJson);

    if (!cityName) {
      console.log("[cityResolver] No city name found in address_components");
      return null;
    }

    console.log(`[cityResolver] Extracted from address: "${cityName}", country: "${countryCode}"`);

    // Try to match city in database with multiple strategies
    // Priority: googleName > name > slug > aliases
    
    // Strategy 1: Direct match (case-insensitive)
    let city = await prisma.city.findFirst({
      where: {
        OR: [
          { googleName: { equals: cityName, mode: "insensitive" } },
          { name: { equals: cityName, mode: "insensitive" } },
          { slug: { equals: cityName.toLowerCase().replace(/\s+/g, "-") } },
        ],
      },
      select: { id: true, name: true },
    });

    if (city) {
      console.log(`[cityResolver] ✅ Matched city by address (direct): ${city.name} (${city.id})`);
      return { cityId: city.id, cityName: city.name };
    }

    // Strategy 2: Known aliases for common cities
    // This handles language variants (Мінск/Минск/Minsk)
    const aliases: Record<string, string[]> = {
      "minsk": ["Minsk", "Минск", "Мінск", "minsk"],
      "gomel": ["Gomel", "Гомель", "Гомель", "gomel"],
      "brest": ["Brest", "Брест", "Брэст", "brest"],
      "grodno": ["Grodno", "Гродно", "Гродна", "grodno"],
      "vitebsk": ["Vitebsk", "Витебск", "Віцебск", "vitebsk"],
      "mogilev": ["Mogilev", "Могилёв", "Магілёў", "mogilev"],
    };

    // Check if cityName matches any alias
    for (const [slug, cityAliases] of Object.entries(aliases)) {
      if (cityAliases.some(alias => alias.toLowerCase() === cityName.toLowerCase())) {
        console.log(`[cityResolver] Found alias match: "${cityName}" -> slug "${slug}"`);
        
        city = await prisma.city.findFirst({
          where: { slug },
          select: { id: true, name: true },
        });

        if (city) {
          console.log(`[cityResolver] ✅ Matched city by address (alias): ${city.name} (${city.id})`);
          return { cityId: city.id, cityName: city.name };
        }
      }
    }

    console.log(`[cityResolver] ⚠️ No city match found for "${cityName}"`);
    return null;
  } catch (error) {
    console.error("[cityResolver] Error resolving by address_components:", error);
    return null;
  }
}

/**
 * Main city resolution function
 * 
 * Strategy:
 * 1. Try coordinate-based resolution (PRIMARY)
 * 2. If found, optionally validate with address parsing
 * 3. If not found, return null (UI will prompt for manual selection)
 */
export async function resolveCityId(input: {
  lat: number;
  lng: number;
  addressJson?: any | null;
  existingCityId?: string | null;
}): Promise<{
  cityId: string | null;
  confidence: "high" | "medium" | "low" | null;
  shouldUpdate: boolean;
  cityName?: string;
}> {
  const { lat, lng, addressJson, existingCityId } = input;

  console.log("[cityResolver] Starting resolution:", {
    hasAddressJson: !!addressJson,
    hasExistingCityId: !!existingCityId,
    coordinates: `${lat}, ${lng}`,
  });

  // Extract country code from address if available (for future filtering)
  let countryCode: string | null = null;
  if (addressJson && Array.isArray(addressJson)) {
    const extracted = extractCityFromAddressComponents(addressJson);
    countryCode = extracted.countryCode;
  }

  // Strategy 1: Coordinate-based resolution (PRIMARY)
  const coordResult = await resolveCityByCoordinates(lat, lng, countryCode);
  
  if (coordResult) {
    // High confidence - coordinates are within city radius
    // Optionally validate with address parsing
    if (addressJson) {
      const addressResult = await resolveCityByAddressComponents(addressJson);
      
      if (addressResult && addressResult.cityId !== coordResult.cityId) {
        console.log(
          `[cityResolver] ⚠️ Mismatch: coordinates say ${coordResult.cityName}, address says ${addressResult.cityName}. Using coordinates.`
        );
      }
    }

    return {
      cityId: coordResult.cityId,
      cityName: coordResult.cityName,
      confidence: "high",
      shouldUpdate: true, // Always update with coordinate-based result
    };
  }

  // Strategy 2: Address parsing as fallback (MEDIUM confidence)
  // Only use if coordinates didn't match any city
  if (addressJson) {
    const addressResult = await resolveCityByAddressComponents(addressJson);
    
    if (addressResult) {
      console.log(
        `[cityResolver] Using address-based result (coordinates outside all city radii)`
      );
      
      return {
        cityId: addressResult.cityId,
        cityName: addressResult.cityName,
        confidence: "medium",
        shouldUpdate: !existingCityId, // Only update if no existing city
      };
    }
  }

  // Strategy 3: No resolution possible - return null
  // UI will prompt user to manually select city
  console.log("[cityResolver] ❌ Could not resolve cityId - manual selection required");
  
  return {
    cityId: null,
    confidence: null,
    shouldUpdate: false,
  };
}
