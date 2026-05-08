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
const METRO_SEARCH_RADIUS_METERS = 1000; // Maximum distance to consider metro station relevant

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

function extractNamedComponentFromAddressJson(
  addressJson: unknown,
  acceptedTypes: string[]
): string | null {
  if (!Array.isArray(addressJson)) return null;

  for (const component of addressJson) {
    const comp = component as Record<string, unknown>;
    const types = comp?.types;
    if (!Array.isArray(types)) continue;

    const matched = types.some((t: unknown) => typeof t === "string" && acceptedTypes.includes(t));
    if (!matched) continue;

    const longName = comp?.long_name;
    if (typeof longName === "string" && longName.trim().length > 0) {
      return longName.trim();
    }
  }

  return null;
}

function extractDistrictNameFromAddressJson(addressJson: unknown): string | null {
  // Google often uses sublocality for district-like entities.
  return extractNamedComponentFromAddressJson(addressJson, [
    "sublocality",
    "sublocality_level_1",
    "administrative_area_level_3",
  ]);
}

function extractMetroNameFromAddressJson(addressJson: unknown): string | null {
  return extractNamedComponentFromAddressJson(addressJson, [
    "transit_station",
    "subway_station",
    "train_station",
    "station",
    "bus_station",
    "bus_stop",
    "light_rail_station",
    "railway_station",
    "stop",
  ]);
}

function normalizeNameForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bрайон\b/g, " ")
    .replace(/\bр-?\s*н\b/g, " ")
    .trim();
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
    const city = await prisma.city.findUnique({
      where: { id: cityId },
      select: {
        metroMaxDistanceM: true,
        name: true,
      },
    });

    if (!city) {
      console.log(`[enrich-location] City ${cityId} not found`);
      return null;
    }
    // Some cities might have `metroMaxDistanceM` unset/falsey; use nullish coalescing.
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

    // Fallback: if we couldn't compute by coordinates, try extracting from `address_components`.
    // This helps when district centroids / metro station coordinates data is incomplete.
    let districtAutoId = districtResult?.districtId ?? null;
    let districtName = districtResult?.districtName ?? null;

    let metroAutoId = metroResult?.metroStationId ?? null;
    let metroName = metroResult?.metroName ?? null;
    let metroAutoDistanceM = metroResult?.distanceM ?? null;

    if (!districtAutoId) {
      const districtNameFromAddress = extractDistrictNameFromAddressJson(addressJson);
      if (districtNameFromAddress) {
        console.log("[enrich-location] Fallback districtNameFromAddress:", districtNameFromAddress);

        const allDistricts = await prisma.district.findMany({
          where: { cityId: cityResult.cityId },
          select: { id: true, name: true },
        });

        const normalizedTarget = normalizeNameForMatch(districtNameFromAddress);
        const districtByName =
          allDistricts.find((d) => normalizeNameForMatch(d.name) === normalizedTarget) ||
          allDistricts.find((d) => normalizeNameForMatch(d.name).includes(normalizedTarget) || normalizedTarget.includes(normalizeNameForMatch(d.name)));

        if (districtByName) {
          districtAutoId = districtByName.id;
          districtName = districtByName.name;
          console.log("[enrich-location] Fallback matched district:", { districtAutoId, districtName });
        } else {
          console.log("[enrich-location] Fallback district not matched in DB");
        }
      }
    }

    if (!metroAutoId) {
      const metroNameFromAddress = extractMetroNameFromAddressJson(addressJson);
      const allStations = await prisma.metroStation.findMany({
        where: { cityId: cityResult.cityId },
        select: { id: true, name: true, lat: true, lng: true },
      });

      const matchByTargetNormalized = (normalizedTarget: string) => {
        if (!normalizedTarget) return null;

        const normalizedStations = allStations.map((s) => ({
          ...s,
          normalizedName: normalizeNameForMatch(s.name),
        }));

        // Score: exact match wins; otherwise, use includes by match length.
        let best: (typeof normalizedStations)[number] | null = null;
        let bestScore = -1;

        for (const s of normalizedStations) {
          if (s.normalizedName === normalizedTarget) {
            return s;
          }

          const a = s.normalizedName;
          const b = normalizedTarget;

          const aIncludesB = a.includes(b);
          const bIncludesA = b.includes(a);

          if (aIncludesB || bIncludesA) {
            const len = Math.max(a.length, b.length);
            const score = len + (aIncludesB ? 10 : 0) + (bIncludesA ? 5 : 0);
            if (score > bestScore) {
              bestScore = score;
              best = s;
            }
          }
        }

        return best;
      };

      const tryExtracted = metroNameFromAddress ? normalizeNameForMatch(metroNameFromAddress) : null;
      if (metroNameFromAddress) {
        console.log("[enrich-location] Fallback metroNameFromAddress:", metroNameFromAddress);
      }

      let metroByName =
        tryExtracted && matchByTargetNormalized(tryExtracted) ? matchByTargetNormalized(tryExtracted) : null;

      // If types-based extraction didn't work, fall back to matching ANY `long_name` candidates from address_components.
      if (!metroByName) {
        const candidates: string[] = [];
        if (Array.isArray(addressJson)) {
          for (const component of addressJson) {
            const comp = component as Record<string, unknown>;
            const longName = comp?.long_name;
            if (typeof longName === "string") {
              const normalized = normalizeNameForMatch(longName);
              if (normalized.length >= 3) candidates.push(longName);
            }
          }
        }

        // Try candidates in order; first strong match wins.
        for (const candidate of candidates.slice(0, 20)) {
          const normalizedTarget = normalizeNameForMatch(candidate);
          metroByName = matchByTargetNormalized(normalizedTarget);
          if (metroByName) {
            console.log("[enrich-location] Fallback matched metro by long_name candidate:", {
              candidate,
              metroAutoId: metroByName.id,
              metroName: metroByName.name,
            });
            break;
          }
        }
      }

      if (metroByName) {
        metroAutoId = metroByName.id;
        metroName = metroByName.name;
        metroAutoDistanceM = Math.round(haversineMeters(lat, lng, metroByName.lat, metroByName.lng));
        console.log("[enrich-location] Fallback matched metro:", { metroAutoId, metroName, metroAutoDistanceM });
      } else {
        console.log("[enrich-location] Fallback metro not matched in DB");
      }
    }

    const response = {
      cityId: cityResult.cityId,
      cityName: cityResult.cityName,
      districtAutoId,
      districtName,
      metroAutoId,
      metroName,
      metroAutoDistanceM,
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
