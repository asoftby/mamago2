/**
 * Place Geo Enrichment Service
 * 
 * Enriches a place with district and metro data based on its coordinates.
 * MVP implementation:
 * - Metro: Haversine distance to nearest station within 1.5km
 * - District: Nearest district centroid (approximation until polygons available)
 */

import prisma from "@/lib/prisma";

const METRO_SEARCH_RADIUS_METERS = 1500;
const EARTH_RADIUS_KM = 6371;

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
function haversineMeters(
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
  const distanceKm = EARTH_RADIUS_KM * c;

  return distanceKm * 1000; // Convert to meters
}

/**
 * Resolve cityId for a place
 * MVP logic:
 * 1. If place has cityId, use it
 * 2. Else if only one city in DB, use it
 * 3. Else try to find Minsk by slug
 * 4. Else return null
 */
async function resolveCityId(placeCityId: string | null): Promise<string | null> {
  if (placeCityId) {
    return placeCityId;
  }

  // Fallback: check if there's only one city
  const cities = await prisma.city.findMany({
    where: { isLegacyNonCity: false },
    select: { id: true, slug: true },
  });

  if (cities.length === 1) {
    console.log(`[placeGeoEnrichment] Using single city: ${cities[0].id}`);
    return cities[0].id;
  }

  // Fallback: try to find Minsk
  const minsk = cities.find((c) => c.slug === "minsk" || c.slug === "minsk");
  if (minsk) {
    console.log(`[placeGeoEnrichment] Defaulting to Minsk: ${minsk.id}`);
    return minsk.id;
  }

  console.warn("[placeGeoEnrichment] Could not resolve cityId");
  return null;
}

/**
 * Find nearest metro station within radius
 * Returns station ID and distance in meters
 * Respects city.hasMetro and city.metroMaxDistanceM configuration
 */
async function computeNearestMetro(
  cityId: string,
  lat: number,
  lng: number
): Promise<{ metroStationId: string; distanceM: number } | null> {
  try {
    // Check if city has metro
    const city = await prisma.city.findUnique({
      where: { id: cityId },
      select: {
        hasMetro: true,
        metroMaxDistanceM: true,
        name: true,
      },
    });

    if (!city) {
      console.log(`[placeGeoEnrichment] City ${cityId} not found`);
      return null;
    }

    if (!city.hasMetro) {
      console.log(`[placeGeoEnrichment] City ${city.name} has no metro (hasMetro=false)`);
      return null;
    }

    const maxDistance = city.metroMaxDistanceM ?? METRO_SEARCH_RADIUS_METERS;

    // Get all metro stations for the city
    const stations = await prisma.metroStation.findMany({
      where: { cityId },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
      },
    });

    if (stations.length === 0) {
      console.log(`[placeGeoEnrichment] No metro stations found for city ${city.name}`);
      return null;
    }

    // Calculate distances and find nearest within radius
    let nearestStation: { id: string; distance: number } | null = null;

    for (const station of stations) {
      const distance = haversineMeters(lat, lng, station.lat, station.lng);

      if (distance <= maxDistance) {
        if (!nearestStation || distance < nearestStation.distance) {
          nearestStation = { id: station.id, distance };
        }
      }
    }

    if (!nearestStation) {
      console.log(`[placeGeoEnrichment] No metro station within ${maxDistance}m`);
      return null;
    }

    return {
      metroStationId: nearestStation.id,
      distanceM: Math.round(nearestStation.distance),
    };
  } catch (error) {
    console.error("[placeGeoEnrichment] computeNearestMetro error:", error);
    return null;
  }
}

/**
 * Find nearest district by centroid (MVP approximation)
 * Returns district ID
 */
async function computeNearestDistrict(
  cityId: string,
  lat: number,
  lng: number
): Promise<{ districtId: string } | null> {
  try {
    // Get all districts with centroids for the city
    const districts = await prisma.district.findMany({
      where: {
        cityId,
        centerLat: { not: null },
        centerLng: { not: null },
      },
      select: {
        id: true,
        name: true,
        centerLat: true,
        centerLng: true,
      },
    });

    if (districts.length === 0) {
      console.log(`[placeGeoEnrichment] No districts with centroids found for city ${cityId}`);
      return null;
    }

    // Find nearest district centroid
    let nearestDistrict: { id: string; distance: number } | null = null;

    for (const district of districts) {
      if (district.centerLat === null || district.centerLng === null) continue;

      const distance = haversineMeters(
        lat,
        lng,
        district.centerLat,
        district.centerLng
      );

      if (!nearestDistrict || distance < nearestDistrict.distance) {
        nearestDistrict = { id: district.id, distance };
      }
    }

    if (!nearestDistrict) {
      return null;
    }

    return {
      districtId: nearestDistrict.id,
    };
  } catch (error) {
    console.error("[placeGeoEnrichment] computeNearestDistrict error:", error);
    return null;
  }
}

/**
 * Enrich a place with geo data (district + metro)
 * 
 * @param placeId - The place to enrich
 * @returns Updated place with districtAutoId, metroAutoId, metroAutoDistanceM
 * 
 * IMPORTANT: Does NOT overwrite manual selections (districtManualId, metroManualId)
 */
export async function enrichPlaceGeo(placeId: string) {
  try {
    // Get place with current coordinates
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        lat: true,
        lng: true,
        cityId: true,
        districtManualId: true,
        metroManualId: true,
      },
    });

    if (!place) {
      throw new Error(`Place ${placeId} not found`);
    }

    if (!place.lat || !place.lng) {
      console.warn(`[placeGeoEnrichment] Place ${placeId} has no coordinates, clearing auto fields`);
      
      // Clear auto fields when no coordinates
      await prisma.place.update({
        where: { id: placeId },
        data: {
          districtAutoId: null,
          metroAutoId: null,
          metroAutoDistanceM: null,
        },
      });
      
      return null;
    }

    // Resolve cityId
    const cityId = await resolveCityId(place.cityId);
    
    if (!cityId) {
      console.warn(`[placeGeoEnrichment] Could not resolve cityId for place ${placeId}, skipping enrichment`);
      return null;
    }

    // Update place.cityId if it was resolved from fallback
    if (!place.cityId && cityId) {
      await prisma.place.update({
        where: { id: placeId },
        data: { cityId },
      });
    }

    // Compute district and metro in parallel
    const [districtResult, metroResult] = await Promise.all([
      computeNearestDistrict(cityId, place.lat, place.lng),
      computeNearestMetro(cityId, place.lat, place.lng),
    ]);

    // Update place with auto-computed values
    // IMPORTANT: Do NOT touch manual selections
    const updatedPlace = await prisma.place.update({
      where: { id: placeId },
      data: {
        districtAutoId: districtResult?.districtId || null,
        metroAutoId: metroResult?.metroStationId || null,
        metroAutoDistanceM: metroResult?.distanceM || null,
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        cityId: true,
        districtAutoId: true,
        districtManualId: true,
        metroAutoId: true,
        metroAutoDistanceM: true,
        metroManualId: true,
        metroManualDistanceM: true,
        districtAuto: {
          select: { id: true, name: true },
        },
        metroAuto: {
          select: { id: true, name: true },
        },
      },
    });

    console.log(`[placeGeoEnrichment] ✅ Enriched place ${placeId}:`, {
      cityId: updatedPlace.cityId,
      districtAutoId: updatedPlace.districtAutoId,
      districtName: updatedPlace.districtAuto?.name,
      metroAutoId: updatedPlace.metroAutoId,
      metroName: updatedPlace.metroAuto?.name,
      metroAutoDistanceM: updatedPlace.metroAutoDistanceM,
    });

    return updatedPlace;
  } catch (error) {
    console.error(`[placeGeoEnrichment] ❌ Error enriching place ${placeId}:`, error);
    throw error;
  }
}
