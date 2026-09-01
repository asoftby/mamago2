import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";
/**
 * GET /api/business/places/location/matches
 * Find duplicate and nearby places by location
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

const NEARBY_RADIUS_METERS = 100;

// Haversine distance calculation
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


type PlaceSummary = {
  id: string;
  title: string;
  formattedAddr: string | null;
  customAddress: string | null;
  placeKind: string;
  parentPlaceId: string | null;
  lat: number | null;
  lng: number | null;
  distanceMeters?: number;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await checkBusinessToolPermission(user, "content.create"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const currentPlaceId = searchParams.get("placeId");
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const formattedAddr = searchParams.get("formattedAddr");
    const googlePlaceId = searchParams.get("googlePlaceId");

    if (!currentPlaceId) {
      return NextResponse.json(
        { error: "placeId is required" },
        { status: 400 }
      );
    }

    // For new places (placeId === "new"), we still check for duplicates
    // but exclude the "new" ID from database queries
    const isNewPlace = currentPlaceId === "new";

    const lat = latStr ? parseFloat(latStr) : null;
    const lng = lngStr ? parseFloat(lngStr) : null;

    let exactDuplicate: PlaceSummary | null = null;
    const matchesMap = new Map<string, PlaceSummary>();

    // A) Check for exact Google Place ID duplicate
    if (googlePlaceId) {
      const duplicate = await prisma.place.findFirst({
        where: {
          googlePlaceId,
          // Only exclude current place if it's not new
          ...(isNewPlace ? {} : { id: { not: currentPlaceId } }),
        },
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          customAddress: true,
          placeKind: true,
          parentPlaceId: true,
          lat: true,
          lng: true,
        },
      });

      if (duplicate) {
        exactDuplicate = duplicate;
      }
    }

    // B) Find nearby places (within 100m radius)
    if (lat !== null && lng !== null) {
      // Calculate bounding box (approximate)
      const dLat = NEARBY_RADIUS_METERS / 111320; // 1 degree latitude ≈ 111.32 km
      const dLng =
        NEARBY_RADIUS_METERS / (111320 * Math.cos((lat * Math.PI) / 180));

      const nearbyPlaces = await prisma.place.findMany({
        where: {
          // Only exclude current place if it's not new
          ...(isNewPlace ? {} : { id: { not: currentPlaceId } }),
          lat: {
            gte: lat - dLat,
            lte: lat + dLat,
          },
          lng: {
            gte: lng - dLng,
            lte: lng + dLng,
          },
        },
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          customAddress: true,
          placeKind: true,
          parentPlaceId: true,
          lat: true,
          lng: true,
        },
      });

      // Filter by exact haversine distance
      for (const place of nearbyPlaces) {
        if (place.lat !== null && place.lng !== null) {
          const distance = calculateDistance(lat, lng, place.lat, place.lng);

          if (distance <= NEARBY_RADIUS_METERS) {
            matchesMap.set(place.id, {
              ...place,
              distanceMeters: Math.round(distance),
            });
          }
        }
      }
    }

    // C) Find by address (soft match)
    if (formattedAddr) {
      // Search in both formattedAddr and customAddress
      const addressMatches = await prisma.place.findMany({
        where: {
          // Only exclude current place if it's not new
          ...(isNewPlace ? {} : { id: { not: currentPlaceId } }),
          OR: [
            {
              formattedAddr: {
                contains: formattedAddr,
                mode: "insensitive",
              },
            },
            {
              customAddress: {
                contains: formattedAddr,
                mode: "insensitive",
              },
            },
          ],
        },
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          customAddress: true,
          placeKind: true,
          parentPlaceId: true,
          lat: true,
          lng: true,
        },
        take: 20, // Limit address matches
      });

      // Add to matches if not already there
      for (const place of addressMatches) {
        if (!matchesMap.has(place.id)) {
          // Calculate distance if we have coordinates
          let distanceMeters: number | undefined;
          if (lat !== null && lng !== null && place.lat !== null && place.lng !== null) {
            distanceMeters = Math.round(
              calculateDistance(lat, lng, place.lat, place.lng)
            );
          }

          matchesMap.set(place.id, {
            ...place,
            distanceMeters,
          });
        }
      }
    }

    // Convert map to array and sort
    // Priority: exact duplicate first (if in matches), then by distance
    const matches = Array.from(matchesMap.values()).sort((a, b) => {
      // Sort by distance first (if available), then by creation date
      if (a.distanceMeters !== undefined && b.distanceMeters !== undefined) {
        return a.distanceMeters - b.distanceMeters;
      }
      if (a.distanceMeters !== undefined) return -1;
      if (b.distanceMeters !== undefined) return 1;
      return 0;
    });

    return NextResponse.json({
      exactDuplicate,
      matches,
      radiusMeters: NEARBY_RADIUS_METERS,
    });
  } catch (error) {
    console.error("[API] Location matches error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
