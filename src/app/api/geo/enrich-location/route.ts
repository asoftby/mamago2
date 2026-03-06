/**
 * POST /api/geo/enrich-location
 * 
 * Full geo enrichment without creating Place
 * Returns: cityId, districtAutoId, metroAutoId, metroAutoDistanceM
 * 
 * Used by wizard to show enriched data immediately after address selection
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCityId } from "@/services/place/cityResolver.service";
import prisma from "@/lib/prisma";

const EARTH_RADIUS_KM = 6371;
const METRO_SEARCH_RADIUS_METERS = 4000; // Default if city doesn't specify

/**
 * Calculate distance using Haversine formula
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
 * Find nearest district by centroid
 */
async function computeNearestDistrict(
  cityId: string,
  lat: number,
  lng: number
): Promise<{ districtId: string; districtName: string } | null> {
  try {
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
      console.log(`[enrich-location] No districts with centroids for city ${cityId}`);
      return null;
    }

    let nearestDistrict: { id: string; name: string; distance: number } | null = null;

    for (const district of districts) {
      if (district.centerLat === null || district.centerLng === null) continue;

      const distance = haversineMeters(
        lat,
        lng,
        district.centerLat,
        district.centerLng
      );

      if (!nearestDistrict || distance < nearestDistrict.distance) {
        nearestDistrict = { id: district.id, name: district.name, distance };
      }
    }

    if (nearestDistrict) {
      console.log(
        `[enrich-location] Nearest district: ${nearestDistrict.name} (${Math.round(nearestDistrict.distance)}m)`
      );
      return {
        districtId: nearestDistrict.id,
        districtName: nearestDistrict.name,
      };
    }

    return null;
  } catch (error) {
    console.error("[enrich-location] computeNearestDistrict error:", error);
    return null;
  }
}

/**
 * Find nearest metro station within radius
 */
async function computeNearestMetro(
  cityId: string,
  lat: number,
  lng: number
): Promise<{ metroStationId: string; metroName: string; distanceM: number } | null> {
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
      console.log(`[enrich-location] City ${cityId} not found`);
      return null;
    }

    if (!city.hasMetro) {
      console.log(`[enrich-location] City ${city.name} has no metro`);
      return null;
    }

    const maxDistance = city.metroMaxDistanceM || METRO_SEARCH_RADIUS_METERS;

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
      console.log(`[enrich-location] No metro stations for city ${city.name}`);
      return null;
    }

    console.log(`[enrich-location] Checking ${stations.length} metro stations (max distance: ${maxDistance}m)`);

    // Find nearest station within radius
    let nearestStation: { id: string; name: string; distance: number } | null = null;

    for (const station of stations) {
      const distance = haversineMeters(lat, lng, station.lat, station.lng);

      if (distance <= maxDistance) {
        if (!nearestStation || distance < nearestStation.distance) {
          nearestStation = { id: station.id, name: station.name, distance };
        }
      }
    }

    if (nearestStation) {
      console.log(
        `[enrich-location] Nearest metro: ${nearestStation.name} (${Math.round(nearestStation.distance)}m)`
      );
      return {
        metroStationId: nearestStation.id,
        metroName: nearestStation.name,
        distanceM: Math.round(nearestStation.distance),
      };
    }

    console.log(`[enrich-location] No metro station within ${maxDistance}m`);
    return null;
  } catch (error) {
    console.error("[enrich-location] computeNearestMetro error:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lat, lng, addressJson } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "lat and lng are required" },
        { status: 400 }
      );
    }

    console.log("[enrich-location] Enriching location:", { lat, lng, hasAddressJson: !!addressJson });

    // Step 1: Resolve cityId
    const cityResult = await resolveCityId({
      lat,
      lng,
      addressJson: addressJson || null,
    });

    if (!cityResult.cityId) {
      console.log("[enrich-location] ⚠️ Could not resolve cityId");
      return NextResponse.json({
        cityId: null,
        cityName: null,
        districtAutoId: null,
        districtName: null,
        metroAutoId: null,
        metroName: null,
        metroAutoDistanceM: null,
      });
    }

    console.log(`[enrich-location] ✅ Resolved city: ${cityResult.cityName} (${cityResult.cityId})`);

    // Step 2: Compute district and metro in parallel
    const [districtResult, metroResult] = await Promise.all([
      computeNearestDistrict(cityResult.cityId, lat, lng),
      computeNearestMetro(cityResult.cityId, lat, lng),
    ]);

    const response = {
      cityId: cityResult.cityId,
      cityName: cityResult.cityName,
      districtAutoId: districtResult?.districtId || null,
      districtName: districtResult?.districtName || null,
      metroAutoId: metroResult?.metroStationId || null,
      metroName: metroResult?.metroName || null,
      metroAutoDistanceM: metroResult?.distanceM || null,
    };

    console.log("[enrich-location] ✅ Enrichment complete:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[enrich-location] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
