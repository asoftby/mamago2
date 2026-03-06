/**
 * Geo Enrichment Service
 * 
 * Automatically determines district and nearest metro station
 * based on coordinates (lat/lng).
 */

import prisma from "@/lib/prisma";

const METRO_SEARCH_RADIUS_METERS = 2500; // 2.5km radius
const EARTH_RADIUS_KM = 6371;

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(
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
 * Find nearest metro station within radius
 * Returns station ID and distance in meters
 */
export async function findNearestMetro(
  lat: number,
  lng: number,
  cityId: string
): Promise<{ id: string; distanceM: number } | null> {
  try {
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
      return null;
    }

    // Calculate distances and find nearest
    let nearestStation: { id: string; distance: number } | null = null;

    for (const station of stations) {
      const distance = calculateDistance(lat, lng, station.lat, station.lng);

      if (distance <= METRO_SEARCH_RADIUS_METERS) {
        if (!nearestStation || distance < nearestStation.distance) {
          nearestStation = { id: station.id, distance };
        }
      }
    }

    if (!nearestStation) {
      return null;
    }

    return {
      id: nearestStation.id,
      distanceM: Math.round(nearestStation.distance),
    };
  } catch (error) {
    console.error("[geoEnrichment] findNearestMetro error:", error);
    return null;
  }
}

/**
 * Determine district by coordinates
 * 
 * TODO: Implement point-in-polygon check if district polygons exist
 * For now, returns null (manual selection required)
 */
export async function findDistrictByCoordinates(
  lat: number,
  lng: number,
  cityId: string
): Promise<string | null> {
  try {
    // TODO: Implement point-in-polygon check when district boundaries are available
    // For now, we don't have polygon data, so return null
    // User will need to select district manually
    
    return null;
  } catch (error) {
    console.error("[geoEnrichment] findDistrictByCoordinates error:", error);
    return null;
  }
}

/**
 * Enrich place with geo data (district + metro)
 * Returns IDs and distance for auto-determined values
 */
export async function enrichPlaceGeoData(
  lat: number,
  lng: number,
  cityId: string
): Promise<{
  districtAutoId: string | null;
  metroAutoId: string | null;
  metroAutoDistanceM: number | null;
}> {
  const [districtAutoId, metroResult] = await Promise.all([
    findDistrictByCoordinates(lat, lng, cityId),
    findNearestMetro(lat, lng, cityId),
  ]);

  return {
    districtAutoId,
    metroAutoId: metroResult?.id || null,
    metroAutoDistanceM: metroResult?.distanceM || null,
  };
}

/**
 * Calculate distance to a specific metro station
 * Used when user manually selects a metro station
 */
export async function calculateMetroDistance(
  lat: number,
  lng: number,
  metroStationId: string
): Promise<number | null> {
  try {
    const station = await prisma.metroStation.findUnique({
      where: { id: metroStationId },
      select: { lat: true, lng: true },
    });

    if (!station) {
      return null;
    }

    const distance = calculateDistance(lat, lng, station.lat, station.lng);
    return Math.round(distance);
  } catch (error) {
    console.error("[geoEnrichment] calculateMetroDistance error:", error);
    return null;
  }
}
